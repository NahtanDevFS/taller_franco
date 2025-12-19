import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const sql = `
      SELECT 
        ip.id, 
        ip.cantidad_restante, 
        ip.codigo_referencia, 
        ip.created_at,
        p.nombre as producto_nombre,
        COALESCE(p.atributos->>'unidad_medida', 'Litros') as unidad_medida,
        p.codigo_barras as codigo_original
      FROM inventario_parcial ip
      JOIN productos p ON ip.producto_id = p.id
      WHERE ip.activo = true 
      AND ip.cantidad_restante > 0
      ORDER BY ip.created_at DESC
    `;

    const res = await pool.query(sql);
    return NextResponse.json(res.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

//PATCH para borrado lógico
export async function PATCH(request: Request) {
  const client = await pool.connect();
  try {
    const { id } = await request.json();

    if (!id)
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    await client.query("BEGIN");

    const res = await client.query(
      "UPDATE inventario_parcial SET activo = false WHERE id = $1 RETURNING *",
      [id]
    );

    if (res.rowCount === 0) throw new Error("Registro no encontrado");

    await client.query("COMMIT");
    return NextResponse.json({ message: "Item dado de baja correctamente" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
