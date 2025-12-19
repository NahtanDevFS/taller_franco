"use client";
import { useState, useEffect } from "react";
import { Toaster, toast } from "sonner";
import { Barcode, Plus, Trash2, Search, User, Calendar } from "lucide-react";
import styles from "./seriales.module.css";
import BatchUpload from "@/components/inventario/BatchUpload";

export default function SerialesPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [seriales, setSeriales] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSeriales = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/seriales?q=${search}`);
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
  }, [search]);

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
      } else {
        throw new Error();
      }
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <div className={styles.container}>
      <Toaster position="top-right" richColors />

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

      <div className={styles.actions} style={{ marginBottom: "1rem" }}>
        <div style={{ position: "relative" }}>
          <Search
            size={18}
            style={{
              position: "absolute",
              left: 10,
              top: 10,
              color: "#94a3b8",
            }}
          />
          <input
            type="text"
            className={styles.searchBar}
            style={{ paddingLeft: "2.5rem" }}
            placeholder="Buscar serial, producto o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
              <th>Vendido A (Cliente)</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center" }}>
                  Cargando...
                </td>
              </tr>
            ) : seriales.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
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
                    {item.producto_nombre}
                    <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
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
                  <td style={{ fontSize: "0.9rem" }}>
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
                    {item.estado === "disponible" && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "#ef4444",
                        }}
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
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
