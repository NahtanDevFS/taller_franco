"use client";
import { useState, useEffect } from "react";
import { Toaster, toast } from "sonner";
import {
  Barcode,
  Plus,
  Trash2,
  Search,
  User,
  Calendar,
  ShieldCheck,
  X,
  Pencil,
} from "lucide-react";
import styles from "./seriales.module.css";
import BatchUpload from "@/components/inventario/BatchUpload";

type FilterType = "todos" | "disponible" | "vendido";

const formatDateUTC = (dateString: string) => {
  if (!dateString) return "---";
  const date = new Date(dateString);
  return `${date.getUTCDate().toString().padStart(2, "0")}/${(
    date.getUTCMonth() + 1
  )
    .toString()
    .padStart(2, "0")}/${date.getUTCFullYear()}`;
};

export default function SerialesPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [seriales, setSeriales] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState<FilterType>("todos");
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [selectedSerial, setSelectedSerial] = useState<any>(null);
  const [warrantyDate, setWarrantyDate] = useState("");

  const fetchSeriales = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/seriales?q=${search}&estado=${filterState}`
      );
      const data = await res.json();
      if (Array.isArray(data)) setSeriales(data);
    } catch (error) {
      toast.error("Error cargando seriales");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSeriales();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterState]);

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este serial del sistema? (Borrado lógico)")) return;
    try {
      const res = await fetch("/api/seriales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "delete" }),
      });
      if (res.ok) {
        toast.success("Serial eliminado correctamente");
        fetchSeriales();
      } else throw new Error();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const openWarrantyModal = (item: any) => {
    setSelectedSerial(item);

    let initialDate = "";
    if (item.fecha_inicio_garantia) {
      initialDate = item.fecha_inicio_garantia.split("T")[0];
    } else {
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      initialDate = new Date(now.getTime() - offset)
        .toISOString()
        .split("T")[0];
    }

    setWarrantyDate(initialDate);
    setShowModal(true);
  };

  const handleSaveWarranty = async () => {
    if (!selectedSerial || !warrantyDate) return;

    try {
      const res = await fetch("/api/seriales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSerial.id,
          action: "activate_warranty",
          fecha_inicio: warrantyDate,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(
          "Garantía actualizada: Vence el " +
            new Date(data.fecha_fin).toLocaleDateString()
        );
        fetchSeriales();
        setShowModal(false);
        setSelectedSerial(null);
      } else {
        toast.error(data.error || "Error al actualizar garantía");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  return (
    <div className={styles.container}>
      <Toaster position="top-right" richColors />

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Administrar Garantía</h3>
              <button
                onClick={() => setShowModal(false)}
                className={styles.closeBtn}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalSubtitle}>
                Producto: <strong>{selectedSerial?.producto_nombre}</strong>
                <br />
                Serial:{" "}
                <span style={{ fontFamily: "monospace" }}>
                  {selectedSerial?.serial}
                </span>
              </p>

              <div className={styles.formGroup}>
                <label>Fecha de Inicio de Garantía</label>
                <input
                  type="date"
                  className={styles.input}
                  value={warrantyDate}
                  onChange={(e) => setWarrantyDate(e.target.value)}
                />
                <small
                  style={{
                    color: "#64748b",
                    marginTop: "0.5rem",
                    display: "block",
                  }}
                >
                  La fecha de fin se calculará automáticamente según la
                  configuración del producto.
                </small>
              </div>

              <div className={styles.modalActions}>
                <button
                  className={styles.btnSecondary}
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button
                  className={styles.btnPrimary}
                  onClick={handleSaveWarranty}
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.header}>
        <h1 className={styles.title}>
          <Barcode size={32} /> Gestión de Seriales
        </h1>
        <button
          className={styles.btnPrimary}
          onClick={() => setShowUpload(!showUpload)}
        >
          {showUpload ? (
            "Cancelar Carga"
          ) : (
            <>
              <Plus size={20} /> Nuevo Lote
            </>
          )}
        </button>
      </div>

      {showUpload && (
        <BatchUpload
          onSuccess={() => {
            fetchSeriales();
            setShowUpload(false);
          }}
        />
      )}

      <div className={styles.actions}>
        <div className={styles.searchWrapper}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchBar}
            placeholder="Buscar serial, producto o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(["todos", "disponible", "vendido"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilterState(f)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                background: filterState === f ? "#2563eb" : "white",
                color: filterState === f ? "white" : "#64748b",
                cursor: "pointer",
                textTransform: "capitalize",
                fontWeight: 500,
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Serial Único</th>
              <th>Producto</th>
              <th>Estado</th>
              <th>Ingreso</th>
              <th>Vendido A</th>
              <th>
                <div>Inicio garantía</div> <div>dd/mm/yyyy</div>
              </th>
              <th>
                <div>Fin garantía</div> <div>dd/mm/yyyy</div>
              </th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center" }}>
                  Cargando...
                </td>
              </tr>
            ) : seriales.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "#64748b",
                  }}
                >
                  No se encontraron seriales activos.
                </td>
              </tr>
            ) : (
              seriales.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                    {item.serial}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>
                      {item.producto_nombre}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      {item.codigo_barras}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        item.estado === "disponible"
                          ? styles.statusDisponible
                          : styles.statusVendido
                      }`}
                    >
                      {item.estado}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {new Date(item.fecha_ingreso).toLocaleDateString()}
                  </td>
                  <td>
                    {item.estado === "vendido" && item.cliente_nombre ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontWeight: 500,
                          }}
                        >
                          <User size={14} /> {item.cliente_nombre}
                        </span>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: "0.8rem",
                            color: "#64748b",
                          }}
                        >
                          <Calendar size={12} />{" "}
                          {new Date(item.fecha_venta).toLocaleDateString()}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: "#cbd5e1" }}>---</span>
                    )}
                  </td>

                  <td>
                    {item.fecha_inicio_garantia ? (
                      <span className={styles.dateText}>
                        {formatDateUTC(item.fecha_inicio_garantia)}
                      </span>
                    ) : (
                      <span className={styles.placeholderText}>---</span>
                    )}
                  </td>
                  <td>
                    {item.fecha_fin_garantia ? (
                      <span className={styles.dateText}>
                        {formatDateUTC(item.fecha_fin_garantia)}
                      </span>
                    ) : (
                      <span className={styles.placeholderText}>---</span>
                    )}
                  </td>

                  <td>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {item.estado === "vendido" && (
                        <button
                          onClick={() => openWarrantyModal(item)}
                          className={styles.actionBtn}
                          title={
                            item.fecha_inicio_garantia
                              ? "Editar Garantía"
                              : "Activar Garantía"
                          }
                          style={{
                            color: item.fecha_inicio_garantia
                              ? "#2563eb"
                              : "#15803d",
                          }}
                        >
                          {item.fecha_inicio_garantia ? (
                            <Pencil size={18} />
                          ) : (
                            <ShieldCheck size={18} />
                          )}
                        </button>
                      )}

                      {item.estado === "disponible" && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
