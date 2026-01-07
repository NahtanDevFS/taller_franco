"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Toaster, toast } from "sonner";
import { ArrowLeft, Edit2, Trash2, Calendar, Gauge } from "lucide-react";
import styles from "./detalleVehiculo.module.css";

interface VehiculoData {
  vehiculo: {
    id: number;
    placa: string;
    marca: string;
    modelo: string;
    color: string;
    anio: number;
    vin: string;
    notas: string;
    cliente_id: number;
    cliente_nombre: string;
    cliente_telefono: string;
  };
  historial: {
    id: number;
    fecha_ingreso: string;
    kilometraje_actual: number;
    estado: string;
    resumen_trabajos: string;
    notas_generales: string;
  }[];
}

export default function VehiculoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [data, setData] = useState<VehiculoData | null>(null);
  const [loading, setLoading] = useState(true);

  const [showVisitModal, setShowVisitModal] = useState(false);
  const [newKm, setNewKm] = useState("");
  const [unit, setUnit] = useState<"km" | "mi">("km");
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/taller/vehiculos/${id}`);
      if (!res.ok) throw new Error("Error cargando datos");
      const json = await res.json();
      setData(json);

      if (json.historial && json.historial.length > 0) {
        const lastOrder = json.historial[0];
        setNewKm(lastOrder.kilometraje_actual.toString());
        if (lastOrder.notas_generales?.includes("[UNIDAD: MI]")) {
          setUnit("mi");
        } else {
          setUnit("km");
        }
      }
    } catch (error) {
      toast.error("No se pudo cargar el vehículo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKm) return toast.error("Ingresa el kilometraje");
    setCreating(true);

    try {
      const notasExtra = unit === "mi" ? "[UNIDAD: MI]" : "";

      const res = await fetch("/api/taller/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehiculo_id: id,
          kilometraje: parseInt(newKm),
          notas_generales: notasExtra,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      toast.success("Visita iniciada");
      router.push(`/taller/ordenes/${json.id}`);
    } catch (error: any) {
      toast.error(error.message);
      setCreating(false);
    }
  };

  const handleDeleteOrder = async (e: React.MouseEvent, orderId: number) => {
    e.preventDefault();
    if (!confirm("¿Anular esta orden del historial?")) return;
    try {
      const res = await fetch(`/api/taller/ordenes/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ estado: "cancelado" }),
      });
      if (res.ok) {
        toast.success("Orden anulada");
        fetchData();
      }
    } catch (e) {
      toast.error("Error al anular");
    }
  };

  if (loading)
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
        Cargando expediente...
      </div>
    );
  if (!data)
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        Vehículo no encontrado
      </div>
    );

  const { vehiculo, historial } = data;

  return (
    <div className={styles.container}>
      <Toaster position="top-right" richColors />

      <Link
        href="/taller"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: "1.5rem",
          color: "#64748b",
          textDecoration: "none",
          fontWeight: 500,
          fontSize: "0.95rem",
        }}
      >
        <ArrowLeft size={18} /> Volver al Tablero
      </Link>

      <div className={styles.header}>
        <div>
          <h1 className={styles.placaTitle}>{vehiculo.placa}</h1>
          <p className={styles.subTitle}>Expediente Técnico Digital</p>
        </div>
        <button
          className={styles.btnPrimary}
          onClick={() => setShowVisitModal(true)}
        >
          <Calendar size={18} />
          Nueva Visita
        </button>
      </div>

      <div className={styles.gridInfo}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>Datos del Vehículo</span>
            <Link
              href={`/taller/nuevo/${id}`}
              className={styles.iconBtn}
              title="Editar Datos"
            >
              <Edit2 size={16} />
            </Link>
          </div>

          <div className={styles.dataRow}>
            <span className={styles.dataLabel}>Marca/Modelo</span>
            <span className={styles.dataValue}>
              {vehiculo.marca} {vehiculo.modelo}
            </span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.dataLabel}>Año / Color</span>
            <span className={styles.dataValue}>
              {vehiculo.anio || "-"} / {vehiculo.color}
            </span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.dataLabel}>VIN</span>
            <span className={styles.dataValue}>{vehiculo.vin || "N/A"}</span>
          </div>
          {vehiculo.notas && (
            <div
              style={{
                marginTop: "1rem",
                fontSize: "0.9rem",
                color: "#475569",
                background: "#f8fafc",
                padding: "10px",
                borderRadius: "6px",
                fontStyle: "italic",
                border: "1px solid #f1f5f9",
              }}
            >
              "{vehiculo.notas}"
            </div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>Propietario Actual</span>
            <Link
              href={`/taller/nuevo/${id}`}
              className={styles.iconBtn}
              title="Editar Dueño"
            >
              <Edit2 size={16} />
            </Link>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.dataLabel}>Nombre</span>
            <span className={styles.dataValue}>{vehiculo.cliente_nombre}</span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.dataLabel}>Teléfono</span>
            <span className={styles.dataValue}>
              {vehiculo.cliente_telefono || "No registrado"}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>
          Historial de Servicios ({historial.length})
        </h3>
      </div>

      <div className={styles.historyList}>
        {historial.length === 0 ? (
          <div
            style={{
              color: "#94a3b8",
              textAlign: "center",
              padding: "3rem",
              background: "#f8fafc",
              borderRadius: 8,
              border: "1px dashed #e2e8f0",
            }}
          >
            Sin historial registrado.
          </div>
        ) : (
          historial.map((orden) => {
            const esMillas = orden.notas_generales?.includes("[UNIDAD: MI]");
            const unidadDisplay = esMillas ? "mi" : "km";

            return (
              <div
                key={orden.id}
                className={styles.historyItem}
                data-status={orden.estado}
              >
                <Link
                  href={`/taller/ordenes/${orden.id}`}
                  className={styles.historyMain}
                >
                  <div className={styles.historyHeader}>
                    <span className={styles.dateBadge}>
                      {new Date(orden.fecha_ingreso).toLocaleDateString(
                        undefined,
                        {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }
                      )}
                    </span>
                    <span
                      className={`${styles.statusBadge} ${
                        styles[`status_${orden.estado}`]
                      }`}
                    >
                      {orden.estado.replace("_", " ")}
                    </span>
                  </div>

                  <div
                    style={{
                      marginBottom: "0.5rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Gauge size={16} color="#64748b" />
                    <span className={styles.kmText}>
                      {orden.kilometraje_actual.toLocaleString()}
                      <span className={styles.unitText}>{unidadDisplay}</span>
                    </span>
                  </div>

                  <div className={styles.historyDetails}>
                    {orden.resumen_trabajos || "Sin detalles registrados"}
                  </div>
                </Link>

                <button
                  onClick={(e) => handleDeleteOrder(e, orden.id)}
                  className={styles.deleteBtn}
                  title="Anular Orden"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {showVisitModal && (
        <div className={styles.modalOverlay}>
          <form onSubmit={handleCreateOrder} className={styles.modalContent}>
            <h3 style={{ marginTop: 0, color: "#1e293b" }}>Nueva Visita</h3>
            <p
              style={{
                color: "#64748b",
                fontSize: "0.95rem",
                marginBottom: "5px",
              }}
            >
              Registra el kilometraje actual del vehículo.
            </p>

            <div className={styles.inputGroup}>
              <input
                type="number"
                autoFocus
                className={styles.inputKm}
                value={newKm}
                onChange={(e) => setNewKm(e.target.value)}
                placeholder="0"
                required
              />
              <select
                className={styles.selectUnit}
                value={unit}
                onChange={(e) => setUnit(e.target.value as "km" | "mi")}
              >
                <option value="km">KM</option>
                <option value="mi">MI</option>
              </select>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => setShowVisitModal(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={creating}
              >
                {creating ? "Creando..." : "Crear Orden"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
