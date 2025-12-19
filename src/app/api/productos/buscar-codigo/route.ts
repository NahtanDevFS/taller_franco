import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

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
    const sqlSerial = `
      SELECT 
        p.*, 
        m.nombre as marca_nombre, 
        c.nombre as categoria_nombre,
        es.serial as numero_serie_detectado, -- Devolvemos el serial encontrado
        true as encontrado_por_serial
      FROM existencias_serializadas es
      JOIN productos p ON es.producto_id = p.id
      LEFT JOIN marcas m ON p.marca_id = m.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE es.serial = $1 
      AND es.activo = true 
      AND es.estado = 'disponible'
    `;

    const resultSerial = await pool.query(sqlSerial, [codigo]);

    if (resultSerial.rows.length > 0) {
      const producto = resultSerial.rows[0];

      const stockRes = await pool.query(
        "SELECT COUNT(*)::int as total FROM existencias_serializadas WHERE producto_id = $1 AND estado = 'disponible'",
        [producto.id]
      );

      return NextResponse.json({
        ...producto,
        stock: parseInt(stockRes.rows[0].total) || 0,
        precio: parseFloat(producto.precio),
        requiere_serial: true,
      });
    }

    const sqlProducto = `
      SELECT 
        p.*, 
        m.nombre as marca_nombre, 
        c.nombre as categoria_nombre,
        CASE 
          WHEN p.requiere_serial = true THEN 
            (SELECT COUNT(*)::int FROM existencias_serializadas es WHERE es.producto_id = p.id AND es.estado = 'disponible')
          ELSE p.stock 
        END as stock_real
      FROM productos p
      LEFT JOIN marcas m ON p.marca_id = m.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.codigo_barras = $1 
    `;

    const resultProducto = await pool.query(sqlProducto, [codigo]);

    if (resultProducto.rows.length === 0) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    const producto = resultProducto.rows[0];

    return NextResponse.json({
      ...producto,
      stock: parseInt(producto.stock_real) || 0,
      precio: parseFloat(producto.precio),
      numero_serie_detectado: null,
    });
  } catch (error: any) {
    console.error("Error en búsqueda de código:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
