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
  const estadoFilter = searchParams.get("estado") || "todos";

  try {
    const conditions = [`es.activo = true`];
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(
        es.serial ILIKE $${paramIndex} 
        OR p.nombre ILIKE $${paramIndex}
        OR p.codigo_barras ILIKE $${paramIndex}
        OR v.cliente ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (estadoFilter !== "todos") {
      conditions.push(`es.estado = $${paramIndex}`);
      params.push(estadoFilter);
      paramIndex++;
    }

    const sql = `
      SELECT 
        es.id, 
        es.serial, 
        es.estado, 
        es.fecha_ingreso,
        es.fecha_inicio_garantia,
        es.fecha_fin_garantia,
        p.nombre as producto_nombre, 
        p.codigo_barras,
        v.cliente as cliente_nombre,
        v.fecha_venta
      FROM existencias_serializadas es
      JOIN productos p ON es.producto_id = p.id
      LEFT JOIN ventas v ON es.venta_id = v.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY es.fecha_ingreso DESC
      LIMIT 50
    `;

    const res = await pool.query(sql, params);
    return NextResponse.json(res.rows);
  } catch (error: any) {
    console.error("Error fetching seriales:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    const { id, action, fecha_inicio } = body;

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

      if (action === "activate_warranty") {
        if (!fecha_inicio) throw new Error("Fecha de inicio requerida");

        const prodRes = await client.query(
          `SELECT p.atributos 
           FROM existencias_serializadas es
           JOIN productos p ON es.producto_id = p.id
           WHERE es.id = $1`,
          [id]
        );

        if (prodRes.rows.length === 0) throw new Error("Serial no encontrado");

        const atributos = prodRes.rows[0].atributos || {};
        const mesesGarantia = parseInt(atributos.garantia_meses || "0");

        if (mesesGarantia <= 0) {
          return NextResponse.json(
            { error: "Este producto no tiene garantía configurada" },
            { status: 400 }
          );
        }

        const startDate = new Date(fecha_inicio + "T12:00:00Z");

        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + mesesGarantia);

        await client.query(
          `UPDATE existencias_serializadas 
           SET fecha_inicio_garantia = $1, 
               fecha_fin_garantia = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [startDate.toISOString(), endDate.toISOString(), id]
        );

        return NextResponse.json({
          message: "Garantía activada correctamente",
          fecha_fin: endDate.toISOString(),
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
