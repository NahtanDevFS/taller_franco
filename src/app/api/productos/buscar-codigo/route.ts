import { NextResponse } from "next/server";
import { query } from "@/lib/db";
//importamos los tipos que definimos antes para mantener el orden
//import { Producto } from "@/types/database";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const codigo = searchParams.get("codigo");

  if (!codigo) {
    return NextResponse.json(
      { error: "Código de barras requerido" },
      { status: 400 }
    );
  }

  try {
    const sql = `
      SELECT 
        p.*, 
        m.nombre as marca_nombre, 
        c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN marcas m ON p.marca_id = m.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.codigo_barras = $1
    `;

    const result = await query(sql, [codigo]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    const productoEncontrado = result.rows[0];

    return NextResponse.json(productoEncontrado);
  } catch (error) {
    console.error("Error en base de datos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
