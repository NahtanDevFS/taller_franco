import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

//GET para listar seriales con datos de venta
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q") || "";

  try {
    const sql = `
      SELECT 
        es.id, 
        es.serial, 
        es.estado, 
        es.fecha_ingreso,
        p.nombre as producto_nombre, 
        p.codigo_barras,
        v.cliente as cliente_nombre,
        v.fecha_venta
      FROM existencias_serializadas es
      JOIN productos p ON es.producto_id = p.id
      LEFT JOIN ventas v ON es.venta_id = v.id
      WHERE es.activo = true
      AND (
        es.serial ILIKE $1 
        OR p.nombre ILIKE $1
        OR p.codigo_barras ILIKE $1
        OR v.cliente ILIKE $1 
      )
      ORDER BY es.fecha_ingreso DESC
      LIMIT 50
    `;

    const res = await pool.query(sql, [`%${search}%`]);

    return NextResponse.json(res.rows);
  } catch (error: any) {
    console.error("Error fetching seriales:", error);
    return NextResponse.json(
      { error: error.message || "Error al cargar seriales" },
      { status: 500 }
    );
  }
}

//PATCH para acciones de modificación (eliminar o dar de baja)
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const client = await pool.connect();

    try {
      if (action === "delete") {
        const sql = `
          UPDATE existencias_serializadas 
          SET activo = false, updated_at = NOW() 
          WHERE id = $1
        `;
        await client.query(sql, [id]);

        return NextResponse.json({
          message: "Serial dado de baja correctamente",
        });
      }

      return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error updating serial:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
