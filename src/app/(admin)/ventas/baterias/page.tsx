"use client";
import { useState, useEffect } from "react";
import { formatoQuetzal } from "@/lib/utils";

export default function VentasBateriasPage() {
  const [baterias, setBaterias] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/ventas/baterias")
      .then((res) => res.json())
      .then((data) => setBaterias(data));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ color: "var(--color-secondary)" }}>
        Registro de Baterías Vendidas
      </h1>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          background: "white",
          borderRadius: 8,
          marginTop: 20,
          boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
        }}
      >
        <thead style={{ background: "var(--color-primary)", color: "white" }}>
          <tr>
            <th style={{ padding: 12, textAlign: "left" }}>Modelo</th>
            <th style={{ padding: 12, textAlign: "left" }}>Garantía</th>
            <th style={{ padding: 12, textAlign: "left" }}>Fecha Venta</th>
            <th style={{ padding: 12, textAlign: "left" }}>Código Único</th>
            <th style={{ padding: 12, textAlign: "left" }}>Cliente</th>
          </tr>
        </thead>
        <tbody>
          {baterias.map((b) => (
            <tr key={b.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 12, fontWeight: "bold" }}>
                {b.modelo_bateria}
              </td>
              <td style={{ padding: 12 }}>
                {b.garantia ? `${b.garantia} Meses` : "-"}
              </td>
              <td style={{ padding: 12 }}>
                {new Date(b.fecha_venta).toLocaleDateString()}
              </td>
              <td
                style={{
                  padding: 12,
                  fontFamily: "monospace",
                  color: "var(--color-primary)",
                }}
              >
                {b.codigo_unico || "N/A"}
              </td>
              <td style={{ padding: 12 }}>
                {b.nombre_cliente || "Consumidor Final"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
