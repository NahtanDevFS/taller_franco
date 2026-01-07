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
  const q = searchParams.get("q");

  if (!q || q.length < 2) return NextResponse.json([]);

  try {
    const sql = `
      SELECT id, nombre, telefono, nit_rfc 
      FROM clientes 
      WHERE nombre ILIKE $1 OR telefono ILIKE $1
      ORDER BY nombre ASC 
      LIMIT 5
    `;
    const res = await pool.query(sql, [`%${q}%`]);
    return NextResponse.json(res.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
