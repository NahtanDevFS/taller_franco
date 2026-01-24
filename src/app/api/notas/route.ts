import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const result = await query("SELECT * FROM notas ORDER BY created_at DESC");
    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener notas" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { items } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "La nota debe tener ítems" },
        { status: 400 },
      );
    }

    //esto insertal el array tal cual y postgres lo convierte a JSONB automáticamente con node-postgres
    const result = await query(
      "INSERT INTO notas (items) VALUES ($1) RETURNING *",
      [JSON.stringify(items)],
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al crear nota" }, { status: 500 });
  }
}
