"use client";
import { useState, useEffect } from "react";
import { formatoQuetzal } from "@/lib/utils";
import { Toaster, toast } from "sonner";
import Link from "next/link";
import { Eye, Ban, PlusCircle, ShoppingCart } from "lucide-react";
import styles from "./historial.module.css";

export default function HistorialVentasPage() {
  const [ventas, setVentas] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // useStates para ver los modales con los detalles de la venta
  const [selectedVenta, setSelectedVenta] = useState<any | null>(null);
  const [detallesVenta, setDetallesVenta] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchVentas = async () => {
    const res = await fetch(`/api/ventas?page=${page}`);
    const data = await res.json();
    if (data.data) {
      setVentas(data.data);
      setTotalPages(data.totalPages);
    }
  };

  useEffect(() => {
    fetchVentas();
  }, [page]);

  const handleAnular = async (id: number) => {
    if (
      !confirm("¿Seguro que deseas ANULAR esta venta? El stock será devuelto.")
    )
      return;

    const promise = fetch(`/api/ventas/${id}`, { method: "DELETE" });

    toast.promise(promise, {
      loading: "Anulando venta...",
      success: () => {
        fetchVentas(); // Recargar lista
        return "Venta anulada correctamente";
      },
      error: "Error al anular venta",
    });
  };

  const verDetalles = async (venta: any) => {
    setSelectedVenta(venta);
    setModalOpen(true);
    // Cargar productos de esa venta
    const res = await fetch(`/api/ventas/${venta.id}`);
    const data = await res.json();
    setDetallesVenta(data.detalles || []);
  };

  return (
    <div style={{ padding: 20 }}>
      <Toaster position="top-right" richColors />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h1 style={{ color: "var(--color-secondary)", margin: 0 }}>
          Historial de Ventas
        </h1>

        <Link href="/ventas/nueva" style={{ textDecoration: "none" }}>
          <button
            style={{
              backgroundColor: "var(--color-primary)",
              color: "white",
              border: "none",
              padding: "12px 20px",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 10,
              boxShadow: "0 4px 6px rgba(249, 115, 22, 0.2)",
            }}
          >
            <ShoppingCart size={20} />
            Nueva Venta (POS)
          </button>
        </Link>
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          background: "white",
          borderRadius: 8,
          boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
        }}
      >
        <thead>
          <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
            <th style={{ padding: 12 }}>ID Venta</th>
            <th style={{ padding: 12 }}>Fecha</th>
            <th style={{ padding: 12 }}>Vendedor</th>
            <th style={{ padding: 12 }}>Total</th>
            <th style={{ padding: 12 }}>Estado</th>
            <th style={{ padding: 12 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {ventas.map((v) => (
            <tr
              key={v.id}
              style={{
                borderBottom: "1px solid #eee",
                opacity: v.estado === "anulada" ? 0.6 : 1,
              }}
            >
              <td style={{ padding: 12 }}>#{v.id}</td>
              <td style={{ padding: 12 }}>
                {new Date(v.fecha_venta).toLocaleString()}
              </td>
              <td style={{ padding: 12 }}>{v.vendedor_nombre || "N/A"}</td>
              <td style={{ padding: 12, fontWeight: "bold" }}>
                {formatoQuetzal.format(v.total)}
              </td>
              <td style={{ padding: 12 }}>
                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    background: v.estado === "anulada" ? "#fee2e2" : "#dcfce7",
                    color: v.estado === "anulada" ? "#ef4444" : "#166534",
                    fontSize: "0.85rem",
                  }}
                >
                  {v.estado?.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: 12 }}>
                <button
                  onClick={() => verDetalles(v)}
                  title="Ver Detalles"
                  style={{
                    marginRight: 10,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: "var(--color-secondary)",
                  }}
                >
                  <Eye size={18} />
                </button>
                {v.estado !== "anulada" && (
                  <button
                    onClick={() => handleAnular(v.id)}
                    title="Anular Venta"
                    style={{
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      color: "#ef4444",
                    }}
                  >
                    <Ban size={18} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* MODAL DETALLES */}
      {modalOpen && selectedVenta && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              padding: 25,
              borderRadius: 8,
              width: 600,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <h2>Detalle Venta #{selectedVenta.id}</h2>
            <div style={{ marginBottom: 20 }}>
              {detallesVenta.map((d, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <span>
                    {d.cantidad}x {d.producto_nombre}
                  </span>
                  <span>{formatoQuetzal.format(d.subtotal)}</span>
                </div>
              ))}
              <div
                style={{
                  textAlign: "right",
                  marginTop: 10,
                  fontWeight: "bold",
                  fontSize: "1.2rem",
                }}
              >
                Total: {formatoQuetzal.format(selectedVenta.total)}
              </div>
            </div>

            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
            >
              {selectedVenta.estado !== "anulada" && (
                <button
                  onClick={() =>
                    alert(
                      "Aquí abriríamos un modal secundario con el buscador de productos para agregar items a esta venta ID: " +
                        selectedVenta.id
                    )
                  }
                  style={{
                    background: "var(--color-primary)",
                    color: "white",
                    border: "none",
                    padding: "10px 15px",
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <PlusCircle size={16} /> Agregar Productos Extra
                </button>
              )}
              <button
                onClick={() => setModalOpen(false)}
                style={{ padding: "10px 15px", cursor: "pointer" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
