import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Código requerido" }, { status: 400 });
  }

  const cleanCode = code.trim();

  try {
    const serialQuery = `
      SELECT 
        es.id as serial_id, 
        es.serial, 
        p.id as producto_id, 
        p.nombre, 
        p.precio, 
        p.codigo_barras,
        p.requiere_serial
      FROM existencias_serializadas es
      JOIN productos p ON es.producto_id = p.id
      WHERE es.serial = $1 
      AND es.estado = 'disponible'
    `;
    const serialRes = await pool.query(serialQuery, [cleanCode]);

    if (serialRes.rows.length > 0) {
      const item = serialRes.rows[0];
      return NextResponse.json({
        type: "SERIAL_DETECTED",
        action: "ADD_TO_CART",
        data: {
          product_id: item.producto_id,
          serial_id: item.serial_id,
          serial: item.serial,
          nombre: item.nombre,
          precio: parseFloat(item.precio),
          requiere_serial: true,
        },
      });
    }

    const productQuery = `
      SELECT id, nombre, precio, codigo_barras, requiere_serial, stock, es_liquido, permite_fraccion
      FROM productos 
      WHERE codigo_barras = $1
    `;
    const productRes = await pool.query(productQuery, [cleanCode]);

    if (productRes.rows.length > 0) {
      const product = productRes.rows[0];

      if (product.requiere_serial) {
        return NextResponse.json({
          type: "PARENT_PRODUCT_SERIALIZED",
          action: "OPEN_SELECTION_MODAL",
          data: {
            product_id: product.id,
            nombre: product.nombre,
          },
        });
      } else {
        return NextResponse.json({
          type: "STANDARD_PRODUCT",
          action: "ADD_TO_CART",
          data: {
            product_id: product.id,
            nombre: product.nombre,
            precio: parseFloat(product.precio),
            requiere_serial: false,
            es_liquido: product.permite_fraccion || product.es_liquido,
          },
        });
      }
    }

    return NextResponse.json(
      { error: "Código no encontrado" },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("Error en scan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
