import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function POST(
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
    const { servicio_realizado, detalle_servicio } = body;

    if (!servicio_realizado) {
      return NextResponse.json(
        { error: "El nombre del servicio es obligatorio" },
        { status: 400 }
      );
    }

    const sql = `
      INSERT INTO detalle_orden_servicio (orden_id, servicio_realizado, detalle_servicio)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const res = await pool.query(sql, [
      id,
      servicio_realizado,
      detalle_servicio || "",
    ]);
    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
