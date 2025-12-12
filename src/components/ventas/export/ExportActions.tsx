"use client";
import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { FileText, Printer, Sheet, Loader2 } from "lucide-react";
import { InvoiceDocument } from "./InvoiceDocument";
import { toast } from "sonner";

interface ExportActionsProps {
  venta: any;
}

export default function ExportActions({ venta }: ExportActionsProps) {
  const [loadingType, setLoadingType] = useState<"ticket" | "carta" | null>(
    null
  );

  const exportToExcel = () => {
    try {
      const rows = venta.detalles.map((d: any) => ({
        ID_Venta: venta.id,
        Fecha: new Date(venta.fecha_venta).toLocaleDateString(),
        Cliente: venta.cliente,
        Producto: d.producto_nombre,
        Codigo: d.codigo_barras || d.datos_extra?.codigo_bateria || "-",
        Cantidad: d.cantidad,
        Precio_Unit: parseFloat(d.precio_unitario),
        Subtotal: parseFloat(d.subtotal),
        Vendedor: venta.vendedor_nombre,
        Estado: venta.estado,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle");
      XLSX.writeFile(workbook, `Venta_${venta.id}.xlsx`);
      toast.success("Excel exportado correctamente");
    } catch (error) {
      console.error(error);
      toast.error("Error al generar Excel");
    }
  };

  //generar y descargar PDF bajo demanda
  const handleDownloadPDF = async (tipo: "ticket" | "carta") => {
    if (loadingType) return; // Evitar doble clic
    setLoadingType(tipo);

    try {
      //genera el blob manualmente solo al hacer clic
      const blob = await pdf(
        <InvoiceDocument venta={venta} tipo={tipo} />
      ).toBlob();

      const fileName =
        tipo === "ticket" ? `Ticket_${venta.id}.pdf` : `Nota_${venta.id}.pdf`;

      saveAs(blob, fileName);
      toast.success(`${tipo === "ticket" ? "Ticket" : "Factura"} generado`);
    } catch (error) {
      console.error("Error generando PDF:", error);
      toast.error("Error al generar el documento PDF");
    } finally {
      setLoadingType(null);
    }
  };

  const btnStyle = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    border: "1px solid #e2e8f0",
    backgroundColor: "white",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 500,
    transition: "all 0.2s",
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        marginTop: 15,
        padding: 15,
        background: "#f8fafc",
        borderRadius: 8,
        justifyContent: "flex-end",
        flexWrap: "wrap",
      }}
    >
      <button
        onClick={exportToExcel}
        style={{ ...btnStyle, color: "#166534", borderColor: "#bbf7d0" }}
        title="Descargar Excel"
      >
        <Sheet size={18} /> Excel
      </button>

      <button
        onClick={() => handleDownloadPDF("ticket")}
        disabled={loadingType !== null}
        style={{
          ...btnStyle,
          color: "#0f172a",
          opacity: loadingType ? 0.6 : 1,
          cursor: loadingType ? "not-allowed" : "pointer",
        }}
      >
        {loadingType === "ticket" ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Printer size={18} />
        )}
        Ticket
      </button>

      <button
        onClick={() => handleDownloadPDF("carta")}
        disabled={loadingType !== null}
        style={{
          ...btnStyle,
          color: "#ea580c",
          borderColor: "#fed7aa",
          opacity: loadingType ? 0.6 : 1,
          cursor: loadingType ? "not-allowed" : "pointer",
        }}
      >
        {loadingType === "carta" ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <FileText size={18} />
        )}
        PDF
      </button>
    </div>
  );
}
