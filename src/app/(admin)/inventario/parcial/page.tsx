"use client";
import { useState, useEffect } from "react";
import styles from "./parcial.module.css";
import { Toaster, toast } from "sonner";
import { Trash2, PackageOpen } from "lucide-react";

export default function InventarioParcialPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventario-parcial");
      const data = await res.json();
      if (Array.isArray(data)) {
        setItems(data);
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar inventario parcial");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleDarDeBaja = async (item: any) => {
    if (
      !confirm(
        `¿Dar de baja este remanente de ${item.producto_nombre}? (No se podrá recuperar)`
      )
    )
      return;

    const promise = fetch("/api/inventario-parcial", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    }).then(async (res) => {
      if (!res.ok) throw new Error("Error al dar de baja");
      fetchItems();
      return "Item dado de baja correctamente";
    });

    toast.promise(promise, {
      loading: "Procesando...",
      success: (msg) => `${msg}`,
      error: "Error al procesar",
    });
  };

  return (
    <div className={styles.container}>
      <Toaster position="top-right" richColors />

      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PackageOpen size={32} color="var(--color-secondary)" />
          <div>
            <h1 className={styles.title} style={{ margin: 0 }}>
              Inventario Parcial
            </h1>
            <small style={{ color: "#64748b" }}>
              Productos abiertos o fraccionados disponibles
            </small>
          </div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Cód. Ref</th>
              <th>Producto Original</th>
              <th>Restante</th>
              <th>Fecha Apertura</th>
              <th style={{ textAlign: "center" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 20 }}>
                  Cargando...
                </td>
              </tr>
            ) : items.length > 0 ? (
              items.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>
                    {item.codigo_referencia}
                  </td>
                  <td>
                    {item.producto_nombre}
                    <br />
                    <small style={{ color: "#94a3b8" }}>
                      Original: {item.codigo_original || "-"}
                    </small>
                  </td>
                  <td>
                    <span className={styles.badge}>
                      {parseFloat(item.cantidad_restante).toFixed(4)}{" "}
                      {item.unidad_medida}
                    </span>
                  </td>
                  <td>{new Date(item.created_at).toLocaleDateString()}</td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      onClick={() => handleDarDeBaja(item)}
                      className={`${styles.btnIcon} ${styles.btnDelete}`}
                      title="Dar de baja (Merma/Agotado)"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  style={{ textAlign: "center", padding: 30, color: "#64748b" }}
                >
                  <PackageOpen
                    size={48}
                    style={{ marginBottom: 10, opacity: 0.5 }}
                  />
                  <p>No hay productos abiertos en inventario actualmente.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
