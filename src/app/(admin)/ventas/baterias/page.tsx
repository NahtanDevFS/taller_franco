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
        }}
      >
        <thead style={{ background: "var(--color-primary)", color: "white" }}>
          <tr>
            <th style={{ padding: 10, textAlign: "left" }}>Fecha</th>
            <th style={{ padding: 10, textAlign: "left" }}>Modelo</th>
            <th style={{ padding: 10, textAlign: "left" }}>Código</th>
            <th style={{ padding: 10, textAlign: "left" }}>Garantía</th>
            <th style={{ padding: 10, textAlign: "left" }}>
              Persona que la compró
            </th>
            <th style={{ padding: 10, textAlign: "left" }}>Precio</th>
          </tr>
        </thead>
        <tbody>
          {baterias.map((b) => (
            <tr key={b.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 10 }}>
                {new Date(b.fecha_venta).toLocaleDateString()}
              </td>
              <td style={{ padding: 10 }}>
                <b>{b.modelo_bateria}</b>
                <br />
                <small style={{ color: "#666" }}>
                  {b.datos_extra?.codigo_bateria || "-"}
                </small>
              </td>
              <td style={{ padding: 10 }}>
                {b.datos_extra?.codigo_bateria || "-"}
              </td>
              <td style={{ padding: 10 }}>
                {b.datos_extra?.garantia_meses
                  ? `${b.datos_extra.garantia_meses} Meses`
                  : "-"}
              </td>
              <td style={{ padding: 10 }}>{b.vendedor}</td>
              <td style={{ padding: 10 }}>
                {formatoQuetzal.format(b.precio_unitario)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
