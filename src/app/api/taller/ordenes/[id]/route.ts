import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sqlOrden = `
      SELECT o.*, 
             v.placa, v.marca, v.modelo, v.color, v.anio,
             c.nombre as cliente_nombre, c.telefono as cliente_telefono
      FROM ordenes_servicio o
      JOIN vehiculos v ON o.vehiculo_id = v.id
      LEFT JOIN clientes c ON v.cliente_id = c.id
      WHERE o.id = $1 AND o.estado != 'cancelado'
    `;

    const sqlDetalles = `
      SELECT * FROM detalle_orden_servicio 
      WHERE orden_id = $1 
      ORDER BY created_at ASC
    `;

    const [resOrden, resDetalles] = await Promise.all([
      pool.query(sqlOrden, [id]),
      pool.query(sqlDetalles, [id]),
    ]);

    if (resOrden.rows.length === 0) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      orden: resOrden.rows[0],
      detalles: resDetalles.rows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();

    const campos = [];
    const valores = [];
    let contador = 1;

    if (body.estado) {
      campos.push(`estado = $${contador++}`);
      valores.push(body.estado);
    }
    if (body.notas_generales !== undefined) {
      campos.push(`notas_generales = $${contador++}`);
      valores.push(body.notas_generales);
    }

    if (campos.length === 0) return NextResponse.json({ ok: true });

    valores.push(id);
    const sql = `
      UPDATE ordenes_servicio 
      SET ${campos.join(", ")}, updated_at = NOW()
      WHERE id = $${contador}
      RETURNING *
    `;

    const res = await pool.query(sql, valores);
    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
