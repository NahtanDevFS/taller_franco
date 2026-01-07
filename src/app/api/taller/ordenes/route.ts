import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { vehiculo_id, kilometraje, notas_generales } = body;

    if (!vehiculo_id || !kilometraje) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const sql = `
      INSERT INTO ordenes_servicio (vehiculo_id, kilometraje_actual, estado, fecha_ingreso, notas_generales)
      VALUES ($1, $2, 'en_proceso', NOW(), $3)
      RETURNING id
    `;

    const res = await pool.query(sql, [
      vehiculo_id,
      kilometraje,
      notas_generales || null,
    ]);

    return NextResponse.json({ id: res.rows[0].id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
