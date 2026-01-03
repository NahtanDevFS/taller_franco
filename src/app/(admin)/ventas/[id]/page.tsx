"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  User,
  UserCircle,
  ShieldCheck,
  Box,
  Droplets,
} from "lucide-react";
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

  const getVencimientoGarantia = (fechaVenta: string, meses: number) => {
    if (!meses || meses <= 0) return null;
    const fecha = new Date(fechaVenta);
    fecha.setMonth(fecha.getMonth() + meses);
    return fecha.toLocaleDateString();
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
            {venta.detalles?.map((item: any, i: number) => {
              const extra = item.datos_extra || {};

              const serial = extra.numero_serie || extra.codigo_bateria;

              const mesesGarantia = extra.garantia_meses || 0;
              const fechaVence = getVencimientoGarantia(
                venta.fecha_venta,
                mesesGarantia
              );

              const unidad = extra.unidad_medida;

              return (
                <tr key={i} className={styles.tableRow}>
                  <td className={styles.tableCell}>
                    <strong>{item.cantidad}</strong>
                    {unidad && (
                      <div
                        style={{
                          fontSize: "0.75em",
                          color: "#64748b",
                          display: "flex",
                          alignItems: "center",
                          marginTop: 2,
                        }}
                      >
                        <Droplets size={10} style={{ marginRight: 2 }} />
                        {formatUnit(unidad)}
                      </div>
                    )}
                  </td>
                  <td className={styles.tableCell}>
                    <div style={{ fontWeight: 500 }}>
                      {extra.descripcion_personalizada
                        ? extra.descripcion_personalizada.toUpperCase()
                        : item.producto_nombre}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        marginTop: 4,
                      }}
                    >
                      {serial && (
                        <div
                          className={styles.secondaryText}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            color: "#ea580c",
                          }}
                        >
                          <Box size={12} style={{ marginRight: 4 }} />
                          <span
                            style={{ fontFamily: "monospace", fontWeight: 600 }}
                          >
                            SN: {serial}
                          </span>
                        </div>
                      )}

                      {mesesGarantia > 0 && (
                        <div
                          className={styles.secondaryText}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            color: "#16a34a",
                          }}
                        >
                          <ShieldCheck size={12} style={{ marginRight: 4 }} />
                          <span>
                            Garantía {mesesGarantia} meses (Vence: {fechaVence})
                          </span>
                        </div>
                      )}

                      {extra.es_item_parcial && (
                        <span
                          style={{
                            fontSize: "0.75em",
                            color: "#64748b",
                            fontStyle: "italic",
                          }}
                        >
                          (Venta a granel)
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className={styles.tableCell}
                    style={{ textAlign: "right" }}
                  >
                    {formatoQuetzal.format(item.precio_unitario)}
                  </td>
                  <td
                    className={styles.tableCell}
                    style={{ textAlign: "right", fontWeight: "bold" }}
                  >
                    {formatoQuetzal.format(item.subtotal)}
                  </td>
                </tr>
              );
            })}
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
