"use client";
import { useState, useEffect } from "react";
import { formatoQuetzal } from "@/lib/utils";
import { Toaster, toast } from "sonner";
import Link from "next/link";
import {
  Eye,
  Ban,
  ShoppingCart,
  Filter,
  X,
  Banknote,
  Edit,
} from "lucide-react";
import styles from "../productos/productos.module.css";
import stylesHistorial from "./historialVentas.module.css";

export default function HistorialVentasPage() {
  const [ventas, setVentas] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAnuladas, setShowAnuladas] = useState(false);

  const fetchVentas = async (p = page) => {
    const params = new URLSearchParams({
      page: p.toString(),
      startDate,
      endDate,
      showAnuladas: showAnuladas.toString(),
    });

    const res = await fetch(`/api/ventas?${params}`);
    const data = await res.json();
    if (data.data) {
      setVentas(data.data);
      setTotalPages(data.totalPages);
    }
  };

  useEffect(() => {
    fetchVentas(page);
  }, [page]);

  useEffect(() => {
    setPage(1);
    fetchVentas(1);
  }, [showAnuladas]);

  const handleFilter = () => {
    setPage(1);
    fetchVentas(1);
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setShowAnuladas(false);
    setPage(1);
    fetch(`/api/ventas?page=1`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setVentas(data.data);
          setTotalPages(data.totalPages);
        }
      });
  };

  const handlePagar = async (venta: any) => {
    if (!confirm(`¿Confirmar pago de la venta #${venta.id}?`)) return;

    toast.promise(
      fetch(`/api/ventas/${venta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "completada" }),
      }).then(async (res) => {
        if (!res.ok) throw new Error("Error al procesar");
        fetchVentas();
      }),
      {
        loading: "Procesando pago...",
        success: "Pago registrado exitosamente",
        error: "Error al registrar pago",
      },
    );
  };

  const handleAnular = async (id: number) => {
    if (!confirm("¿Seguro que deseas anular esta venta?")) return;

    toast.promise(
      fetch(`/api/ventas/${id}`, { method: "DELETE" }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error al anular");
        }
        return fetchVentas();
      }),
      {
        loading: "Anulando venta...",
        success: "Venta anulada correctamente",
        error: (err) => `Error: ${err.message}`,
      },
    );
  };

  const getStatusBadgeClass = (estado: string) => {
    switch (estado) {
      case "anulada":
        return stylesHistorial.badgeAnulada;
      case "pendiente":
        return stylesHistorial.badgePendiente;
      default:
        return stylesHistorial.badgeCompletada;
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Toaster position="top-right" richColors />
      <div className={stylesHistorial.header}>
        <h1 className={stylesHistorial.titleVentas}>Historial de ventas</h1>
        <Link href="/ventas/nueva" style={{ textDecoration: "none" }}>
          <button className={stylesHistorial.buttonPOS}>
            <ShoppingCart size={20} /> Nueva venta (POS)
          </button>
        </Link>
      </div>

      <div className={`${styles.filterBar} ${stylesHistorial.filterContainer}`}>
        <span style={{ fontWeight: "bold", color: "var(--color-text-muted)" }}>
          Filtrar por fecha:
        </span>
        <div className={stylesHistorial.dateGroup}>
          <span className={stylesHistorial.dateLabel}>Desde:</span>
          <input
            type="date"
            className={stylesHistorial.dateInput}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className={stylesHistorial.dateGroup}>
          <span style={{ fontSize: "0.9rem" }}>Hasta:</span>
          <input
            type="date"
            className={stylesHistorial.dateInput}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <button
          onClick={handleFilter}
          className={styles.btnPrimary}
          style={{
            padding: "8px 15px",
            display: "flex",
            gap: 5,
            alignItems: "center",
          }}
        >
          <Filter size={16} /> Filtrar
        </button>
        {(startDate || endDate) && (
          <button
            onClick={clearFilters}
            className={styles.clearBtn}
            title="Limpiar filtros"
          >
            <X size={18} />
          </button>
        )}
        <div style={{ height: 24, width: 1, background: "#cbd5e1" }}></div>
        <label className={stylesHistorial.checkboxContainer}>
          <input
            type="checkbox"
            checked={showAnuladas}
            onChange={(e) => setShowAnuladas(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <span
            className={showAnuladas ? stylesHistorial.checkboxLabelAnulada : ""}
          >
            Mostrar Anuladas
          </span>
        </label>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
              <th className={stylesHistorial.tableCell}>ID</th>
              <th className={stylesHistorial.tableCell}>Fecha</th>
              <th className={stylesHistorial.tableCell}>Cliente</th>
              <th className={stylesHistorial.tableCell}>Total</th>
              <th className={stylesHistorial.tableCell}>Estado</th>
              <th className={stylesHistorial.tableCell}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ventas.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 20, textAlign: "center" }}>
                  No se encontraron registros.
                </td>
              </tr>
            ) : (
              ventas.map((v) => (
                <tr
                  key={v.id}
                  className={
                    v.estado === "anulada" ? stylesHistorial.rowAnulada : ""
                  }
                >
                  <td className={stylesHistorial.tableCell}>#{v.id}</td>
                  <td className={stylesHistorial.tableCell}>
                    {new Date(v.fecha_venta).toLocaleString()}
                  </td>
                  <td className={stylesHistorial.tableCell}>
                    {v.cliente || "CF"}
                  </td>
                  <td style={{ padding: 12, fontWeight: "bold" }}>
                    {formatoQuetzal.format(v.total)}
                  </td>
                  <td style={{ padding: 12 }}>
                    <span
                      className={`${
                        stylesHistorial.badge
                      } ${getStatusBadgeClass(v.estado)}`}
                    >
                      {v.estado?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: 12 }}>
                    <Link href={`/ventas/${v.id}`}>
                      <button
                        className={`${stylesHistorial.actionBtn} ${stylesHistorial.btnView}`}
                        title="Ver Detalle"
                      >
                        <Eye size={18} />
                      </button>
                    </Link>

                    <Link href={`/ventas/nueva?id=${v.id}`}>
                      <button
                        title="Editar"
                        style={{
                          marginRight: 10,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--color-secondary)",
                        }}
                      >
                        <Edit size={18} />
                      </button>
                    </Link>

                    {v.estado === "pendiente" && (
                      <button
                        onClick={() => handlePagar(v)}
                        title="Registrar Pago"
                        style={{
                          marginRight: 10,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#16a34a",
                        }}
                      >
                        <Banknote size={18} />
                      </button>
                    )}
                    {v.estado !== "anulada" && (
                      <button
                        onClick={() => handleAnular(v.id)}
                        title="Anular Venta"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#ef4444",
                        }}
                      >
                        <Ban size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 20,
          display: "flex",
          justifyContent: "center",
          gap: 15,
          alignItems: "center",
        }}
      >
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
          style={{
            padding: "8px 15px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: page === 1 ? "#f3f4f6" : "white",
            cursor: page === 1 ? "not-allowed" : "pointer",
          }}
        >
          &lt; Anterior
        </button>
        <span style={{ fontWeight: "bold", color: "#64748b" }}>
          Página {page} de {totalPages}
        </span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
          style={{
            padding: "8px 15px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: page === totalPages ? "#f3f4f6" : "white",
            cursor: page === totalPages ? "not-allowed" : "pointer",
          }}
        >
          Siguiente &gt;
        </button>
      </div>
    </div>
  );
}
