import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

//GET para los cards de resumen de ventas
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    //consulta para las ventas del día
    const ventasHoyQuery = `
      SELECT COALESCE(SUM(total), 0) as total 
      FROM ventas 
      WHERE estado = 'completada' 
      AND date_trunc('day', fecha_venta) = date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'America/Guatemala')
    `;

    //consulta para las ventas del mes actual
    const ventasMesQuery = `
      SELECT COALESCE(SUM(total), 0) as total 
      FROM ventas 
      WHERE estado = 'completada' 
      AND date_trunc('month', fecha_venta) = date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Guatemala')
    `;

    //consulta con el total de inventario valorado (precio venta * stock)
    const inventarioQuery = `
      SELECT COALESCE(SUM(
        precio * (
          CASE 
            WHEN requiere_serial = true THEN (
              SELECT COUNT(*) FROM existencias_serializadas es 
              WHERE es.producto_id = p.id AND es.estado = 'disponible'
            )
            ELSE stock 
          END
        )
      ), 0) as total 
      FROM productos p
      WHERE p.tipo = 'producto'
    `;

    //productos con bajo Stock (limitado a 20)
    const bajoStockQuery = `
      WITH stock_real_calc AS (
        SELECT 
          p.id, 
          p.nombre, 
          p.stock_minimo, 
          p.marca_id, 
          p.categoria_id,
          CASE 
            WHEN p.requiere_serial = true THEN (
              SELECT COUNT(*)::int FROM existencias_serializadas es 
              WHERE es.producto_id = p.id AND es.estado = 'disponible'
            )
            ELSE p.stock 
          END as stock_actual
        FROM productos p
        WHERE p.tipo = 'producto'
      )
      SELECT 
        src.id, 
        src.nombre, 
        src.stock_actual as stock, 
        src.stock_minimo, 
        m.nombre as marca, 
        c.nombre as categoria
      FROM stock_real_calc src
      LEFT JOIN marcas m ON src.marca_id = m.id
      LEFT JOIN categorias c ON src.categoria_id = c.id
      WHERE src.stock_actual <= src.stock_minimo
      ORDER BY src.stock_actual ASC
      LIMIT 20
    `;

    //consulta con top 5 productos más vendidos del mes actual
    const topProductosQuery = `
      SELECT p.nombre, SUM(dv.cantidad) as cantidad_vendida
      FROM detalle_ventas dv
      JOIN ventas v ON dv.venta_id = v.id
      JOIN productos p ON dv.producto_id = p.id
      WHERE v.estado = 'completada'
      AND date_trunc('month', v.fecha_venta) = date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Guatemala')
      GROUP BY p.id, p.nombre
      ORDER BY cantidad_vendida DESC
      LIMIT 5
    `;

    const [hoyRes, mesRes, invRes, lowStockRes, topRes] = await Promise.all([
      pool.query(ventasHoyQuery),
      pool.query(ventasMesQuery),
      pool.query(inventarioQuery),
      pool.query(bajoStockQuery),
      pool.query(topProductosQuery),
    ]);

    return NextResponse.json({
      ventasHoy: parseFloat(hoyRes.rows[0].total),
      ventasMes: parseFloat(mesRes.rows[0].total),
      inventarioTotal: parseFloat(invRes.rows[0].total),
      bajoStock: lowStockRes.rows,
      topProductos: topRes.rows,
    });
  } catch (error: any) {
    console.error("Error dashboard summary:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
