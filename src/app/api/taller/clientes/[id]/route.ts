import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

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
    const sql = `
      UPDATE clientes 
      SET nombre = COALESCE($1, nombre), 
          telefono = COALESCE($2, telefono),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const res = await pool.query(sql, [body.nombre, body.telefono, id]);
    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
