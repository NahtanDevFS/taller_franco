import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { items } = await request.json();

    const result = await query(
      "UPDATE notas SET items = $1 WHERE id = $2 RETURNING *",
      [JSON.stringify(items), id],
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await query("DELETE FROM notas WHERE id = $1", [id]);
    return NextResponse.json({ message: "Eliminado correctamente" });
  } catch (error) {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
