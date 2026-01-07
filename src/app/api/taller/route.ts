import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  try {
    if (!q) {
      const sqlRecent = `
        SELECT v.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono
        FROM vehiculos v
        LEFT JOIN clientes c ON v.cliente_id = c.id
        WHERE v.activo = true
        ORDER BY v.updated_at DESC
        LIMIT 5
      `;
      const res = await pool.query(sqlRecent);
      return NextResponse.json({ data: res.rows });
    }

    const sqlSearch = `
      SELECT v.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono
      FROM vehiculos v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      WHERE v.placa ILIKE $1 OR c.nombre ILIKE $1 AND v.activo = true
      ORDER BY v.placa ASC
      LIMIT 10
    `;
    const res = await pool.query(sqlSearch, [`%${q}%`]);

    return NextResponse.json({ data: res.rows });
  } catch (error: any) {
    console.error("Error buscando vehículos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await pool.connect();

  try {
    const body = await request.json();

    await client.query("BEGIN");

    let clienteId = body.cliente_id;

    if (!clienteId && body.nuevo_cliente_nombre) {
      const insertClienteSql = `
        INSERT INTO clientes (nombre, telefono, nit_rfc)
        VALUES ($1, $2, $3)
        RETURNING id
      `;
      const resC = await client.query(insertClienteSql, [
        body.nuevo_cliente_nombre,
        body.nuevo_cliente_telefono || null,
        body.nuevo_cliente_nit || null,
      ]);
      clienteId = resC.rows[0].id;
    }

    const insertVehiculoSql = `
      INSERT INTO vehiculos (cliente_id, placa, marca, modelo, color, vin, anio, notas)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const resV = await client.query(insertVehiculoSql, [
      clienteId,
      body.placa.toUpperCase(),
      body.marca,
      body.modelo,
      body.color,
      body.vin,
      body.anio ? parseInt(body.anio) : null,
      body.notas,
    ]);

    await client.query("COMMIT");
    return NextResponse.json(resV.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error creando vehículo:", error);
    return NextResponse.json(
      { error: error.message || "Error al crear ingreso" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
