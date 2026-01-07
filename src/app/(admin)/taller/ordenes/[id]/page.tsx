"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import {
  Trash2,
  ArrowLeft,
  Edit,
  Save,
  X,
  CheckCircle,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import styles from "./ordenDetalle.module.css";

export default function OrdenTrabajoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [orden, setOrden] = useState<any>(null);
  const [detalles, setDetalles] = useState<any[]>([]);

  const [newItemService, setNewItemService] = useState("");
  const [newItemDetail, setNewItemDetail] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ servicio: "", detalle: "" });

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/taller/ordenes/${id}`);
      if (!res.ok) throw new Error("Error cargando orden");
      const json = await res.json();
      setOrden(json.orden);
      setDetalles(json.detalles);
    } catch (e) {
      console.error(e);
      toast.error("Error cargando la orden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemService.trim()) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/taller/ordenes/${id}/detalles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servicio_realizado: newItemService,
          detalle_servicio: newItemDetail,
        }),
      });

      if (!res.ok) throw new Error("Error agregando ítem");

      const nuevoItem = await res.json();
      setDetalles([...detalles, nuevoItem]);
      setNewItemService("");
      setNewItemDetail("");
      toast.success("Servicio agregado");
    } catch (error) {
      toast.error("No se pudo agregar");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item: any) => {
    setEditingItem(item.id);
    setEditForm({
      servicio: item.servicio_realizado,
      detalle: item.detalle_servicio,
    });
  };

  const saveEdit = async (itemId: number) => {
    try {
      const res = await fetch(`/api/taller/detalles/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servicio_realizado: editForm.servicio,
          detalle_servicio: editForm.detalle,
        }),
      });
      if (res.ok) {
        setDetalles(
          detalles.map((d) =>
            d.id === itemId
              ? {
                  ...d,
                  servicio_realizado: editForm.servicio,
                  detalle_servicio: editForm.detalle,
                }
              : d
          )
        );
        setEditingItem(null);
        toast.success("Actualizado");
      }
    } catch (e) {
      toast.error("Error al guardar");
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm("¿Borrar esta línea de trabajo?")) return;
    try {
      const res = await fetch(`/api/taller/detalles/${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error");
      setDetalles(detalles.filter((d) => d.id !== itemId));
      toast.success("Eliminado");
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handleFinalizar = async () => {
    if (!confirm("¿Cerrar Orden de Servicio? Se marcará como terminada."))
      return;
    try {
      const res = await fetch(`/api/taller/ordenes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "terminado" }),
      });
      if (!res.ok) throw new Error("Error");
      toast.success("Orden Finalizada Exitosamente");
      fetchData();
      router.push(`/taller/vehiculos/${orden.vehiculo_id}`);
    } catch (error) {
      toast.error("Error al finalizar");
    }
  };

  const handleResume = async () => {
    if (!confirm("¿Reabrir esta orden para editarla?")) return;
    try {
      const res = await fetch(`/api/taller/ordenes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "en_proceso" }),
      });
      if (res.ok) {
        toast.success("Orden reabierta");
        fetchData();
      }
    } catch (e) {
      toast.error("Error al reabrir");
    }
  };

  if (loading)
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
        Cargando Hoja de Trabajo...
      </div>
    );
  if (!orden)
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        Orden no encontrada
      </div>
    );

  const isTerminado =
    orden.estado === "terminado" || orden.estado === "cancelado";

  const esMillas = orden.notas_generales?.includes("[UNIDAD: MI]");
  const unidadLabel = esMillas ? "MI" : "KM";

  return (
    <div className={styles.container}>
      <Toaster position="top-right" richColors />

      <Link
        href={`/taller/vehiculos/${orden.vehiculo_id}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: "1.5rem",
          color: "#64748b",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        <ArrowLeft size={18} /> Volver al Expediente
      </Link>

      <div className={styles.headerPanel}>
        <div className={styles.headerContent}>
          <span className={styles.placa}>{orden.placa}</span>
          <h2 className={styles.vehiculoTitle}>
            {orden.marca} {orden.modelo}{" "}
            <small style={{ fontWeight: 400 }}>({orden.anio})</small>
          </h2>
          <div className={styles.metaInfo}>
            <strong>Cliente:</strong> {orden.cliente_nombre || "Desconocido"}{" "}
            <br />
            <strong>Ingreso:</strong>{" "}
            {new Date(orden.fecha_ingreso).toLocaleString()} <br />
            <strong>{esMillas ? "Millas" : "Km"} Inicial:</strong>{" "}
            {orden.kilometraje_actual.toLocaleString()}
            <span
              style={{
                fontSize: "0.8em",
                color: "#64748b",
                marginLeft: "4px",
                fontWeight: 600,
              }}
            >
              {unidadLabel}
            </span>
          </div>
        </div>
        <div className={`${styles.statusBadge} ${styles[orden.estado]}`}>
          {orden.estado.replace("_", " ")}
        </div>
      </div>

      <div className={styles.workList}>
        {detalles.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              background: "#f8fafc",
              borderRadius: 8,
              color: "#94a3b8",
              border: "1px dashed #cbd5e1",
            }}
          >
            No hay servicios registrados en esta orden.
          </div>
        )}

        {detalles.map((d) => (
          <div key={d.id} className={styles.workItem}>
            {editingItem === d.id ? (
              <div className={styles.editModeContainer}>
                <input
                  className={styles.input}
                  value={editForm.servicio}
                  onChange={(e) =>
                    setEditForm({ ...editForm, servicio: e.target.value })
                  }
                  placeholder="Servicio"
                  autoFocus
                />
                <input
                  className={styles.input}
                  value={editForm.detalle}
                  onChange={(e) =>
                    setEditForm({ ...editForm, detalle: e.target.value })
                  }
                  placeholder="Detalles técnicos"
                />
                <div className={styles.editActions}>
                  <button
                    onClick={() => saveEdit(d.id)}
                    className={styles.btnSave}
                  >
                    <Save
                      size={16}
                      style={{ marginRight: 5, verticalAlign: "middle" }}
                    />{" "}
                    Guardar
                  </button>
                  <button
                    onClick={() => setEditingItem(null)}
                    className={styles.btnCancel}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.workContent}>
                <div className={styles.workTitle}>{d.servicio_realizado}</div>
                {d.detalle_servicio && (
                  <div className={styles.workDetail}>{d.detalle_servicio}</div>
                )}

                {!isTerminado && (
                  <div className={styles.itemActions}>
                    <button
                      onClick={() => startEdit(d)}
                      className={`${styles.iconBtn} ${styles.editBtn}`}
                      title="Editar"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(d.id)}
                      className={`${styles.iconBtn} ${styles.deleteBtn}`}
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!isTerminado && (
        <form onSubmit={handleAddItem} className={styles.addForm}>
          <div className={styles.inputGroup}>
            <input
              className={styles.input}
              placeholder="¿Qué servicio se realiza? (Ej: Cambio de Aceite)"
              value={newItemService}
              onChange={(e) => setNewItemService(e.target.value)}
              required
            />
            <input
              className={styles.input}
              placeholder="Detalles Técnicos (Ej: 10w30 Castrol, Filtro Fram PH3593A)"
              value={newItemDetail}
              onChange={(e) => setNewItemDetail(e.target.value)}
            />
          </div>
          <button type="submit" className={styles.btnAdd} disabled={adding}>
            {adding ? "Guardando..." : "+ Agregar Ítem"}
          </button>
        </form>
      )}

      <div className={styles.footerActions}>
        {isTerminado ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              flexDirection: "column",
              width: "100%",
            }}
          >
            <p
              style={{
                color: "#166534",
                fontWeight: "bold",
                background: "#dcfce7",
                padding: "10px",
                borderRadius: "6px",
                width: "100%",
                textAlign: "center",
              }}
            >
              ✓ Orden Cerrada y Archivada
            </p>
            <button onClick={handleResume} className={styles.btnResume}>
              <RotateCcw
                size={16}
                style={{ marginRight: 6, verticalAlign: "middle" }}
              />
              Reabrir Orden
            </button>
          </div>
        ) : (
          <button className={styles.btnFinish} onClick={handleFinalizar}>
            <CheckCircle size={20} />
            Finalizar y Cerrar Orden
          </button>
        )}
      </div>
    </div>
  );
}
