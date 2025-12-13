"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, User, UserCircle } from "lucide-react";
import { formatoQuetzal, formatUnit } from "@/lib/utils";
import ExportActions from "@/components/ventas/export/ExportActions";
import styles from "./ventaDetalle.module.css";
import { Toaster, toast } from "sonner";

export default function VentaDetallePage() {
  const { id } = useParams();
  const router = useRouter();
  const [venta, setVenta] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchVentaData();
  }, [id]);

  const fetchVentaData = async () => {
    try {
      const res = await fetch(`/api/ventas/${id}`);
      if (!res.ok) throw new Error("Venta no encontrada");
      const data = await res.json();
      setVenta(data);
    } catch (error) {
      toast.error("Error al cargar la venta");
      router.push("/ventas");
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        Cargando detalle...
      </div>
    );
  if (!venta) return null;

  const descuento = Number(venta.descuento) || 0;
  const total = Number(venta.total) || 0;
  const subtotal = total + descuento;

  const getStatusBadgeClass = (estado: string) => {
    switch (estado) {
      case "anulada":
        return styles.badgeAnulada;
      case "pendiente":
        return styles.badgePendiente;
      default:
        return styles.badgeCompletada;
    }
  };

  return (
    <div className={styles.container}>
      <Toaster position="top-center" richColors />

      <div className={styles.header}>
        <Link href="/ventas" style={{ textDecoration: "none" }}>
          <button className={styles.backButton}>
            <ArrowLeft size={20} style={{ marginRight: 5 }} />
            Regresar
          </button>
        </Link>
        <h1 className={styles.title}>Detalle de Venta #{venta.id}</h1>
        <span
          className={`${styles.badge} ${getStatusBadgeClass(venta.estado)}`}
        >
          {venta.estado?.toUpperCase()}
        </span>
      </div>

      <div className={styles.infoGrid}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>
            <User size={14} style={{ display: "inline", marginRight: 4 }} />{" "}
            Cliente
          </div>
          <div className={styles.cardValue}>
            {venta.cliente || "Consumidor Final"}
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>
            <Calendar size={14} style={{ display: "inline", marginRight: 4 }} />{" "}
            Fecha
          </div>
          <div className={styles.cardValue}>
            {new Date(venta.fecha_venta).toLocaleString()}
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>
            <UserCircle
              size={14}
              style={{ display: "inline", marginRight: 4 }}
            />{" "}
            Vendedor
          </div>
          <div className={styles.cardValue}>
            {venta.vendedor_nombre || "Sistema"}
          </div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead className={styles.tableHeader}>
            <tr>
              <th>CANT.</th>
              <th>PRODUCTO / SERVICIO</th>
              <th style={{ textAlign: "right" }}>PRECIO UNIT.</th>
              <th style={{ textAlign: "right" }}>SUBTOTAL</th>
            </tr>
          </thead>
          <tbody>
            {venta.detalles?.map((item: any, i: number) => (
              <tr key={i} className={styles.tableRow}>
                <td className={styles.tableCell}>
                  <strong>{item.cantidad}</strong>
                  <span
                    style={{
                      fontSize: "0.85em",
                      color: "#64748b",
                      marginLeft: 4,
                    }}
                  >
                    {item.datos_extra?.es_liquido
                      ? formatUnit(
                          item.datos_extra.unidad_medida ||
                            item.datos_extra.descripcion_unidad
                        )
                      : item.datos_extra?.unidad_medida
                      ? formatUnit(item.datos_extra.unidad_medida)
                      : ""}
                  </span>
                </td>
                <td className={styles.tableCell}>
                  <div>{item.producto_nombre}</div>
                  {item.datos_extra?.codigo_bateria && (
                    <div className={styles.secondaryText}>
                      Serie: {item.datos_extra.codigo_bateria}
                    </div>
                  )}
                  {item.datos_extra?.es_item_parcial && (
                    <div
                      className={styles.secondaryText}
                      style={{ color: "var(--color-primary)" }}
                    >
                      (Granel)
                    </div>
                  )}
                </td>
                <td className={styles.tableCell} style={{ textAlign: "right" }}>
                  {formatoQuetzal.format(item.precio_unitario)}
                </td>
                <td
                  className={styles.tableCell}
                  style={{ textAlign: "right", fontWeight: "bold" }}
                >
                  {formatoQuetzal.format(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.summarySection}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryRow}>
            <span>Subtotal</span>
            <span>{formatoQuetzal.format(subtotal)}</span>
          </div>

          {descuento > 0 && (
            <div className={`${styles.summaryRow} ${styles.discountRow}`}>
              <span>Descuento aplicado</span>
              <span>- {formatoQuetzal.format(descuento)}</span>
            </div>
          )}

          <div className={styles.totalRow}>
            <span>TOTAL</span>
            <span>{formatoQuetzal.format(total)}</span>
          </div>
        </div>
      </div>

      <div className={styles.actionsFooter}>
        <h4 className={styles.actionsTitle}>Documentos y Exportación</h4>
        <ExportActions venta={venta} />
      </div>
    </div>
  );
}
