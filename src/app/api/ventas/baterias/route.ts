import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  try {
    // Join para traer solo los detalles que son baterías
    // y la info de la venta padre, en datos extra viene el detalle de la venta de la batería, como garantía y así
    const sql = `
      SELECT 
        d.id,
        v.fecha_venta,
        v.id as venta_id,
        p.nombre as modelo_bateria,
        d.precio_unitario,
        d.datos_extra->>'garantia_meses' as garantia,
        d.datos_extra->>'codigo_bateria' as codigo_unico,
        v.cliente as nombre_cliente
      FROM detalle_ventas d
      JOIN ventas v ON d.venta_id = v.id
      JOIN productos p ON d.producto_id = p.id
      WHERE p.es_bateria = true
      ORDER BY v.fecha_venta DESC
    `;

    const res = await pool.query(sql);
    return NextResponse.json(res.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
