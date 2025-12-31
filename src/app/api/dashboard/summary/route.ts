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

    //consulta para las ventas, ticket promedio y descuentos del mes actual
    const ventasMesQuery = `
      SELECT 
        COALESCE(SUM(total), 0) as total,
        COALESCE(AVG(total), 0) as ticket_promedio,
        COALESCE(SUM(descuento), 0) as total_descuentos
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

    //ventas por categoría del mes actual
    const ventasPorCategoriaQuery = `
      SELECT c.nombre, COALESCE(SUM(dv.subtotal), 0) as total
      FROM detalle_ventas dv
      JOIN ventas v ON dv.venta_id = v.id
      JOIN productos p ON dv.producto_id = p.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE v.estado = 'completada'
      AND date_trunc('month', v.fecha_venta) = date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Guatemala')
      GROUP BY c.nombre
      ORDER BY total DESC
    `;

    //productos sin movimiento (hueso), es decir, con stock > 0 y sin ventas en los últimos 90 días
    const productosSinMovimientoQuery = `
      SELECT p.id, p.nombre, p.stock, m.nombre as marca, MAX(v.fecha_venta) as ultima_venta
      FROM productos p
      LEFT JOIN detalle_ventas dv ON p.id = dv.producto_id
      LEFT JOIN ventas v ON dv.venta_id = v.id
      LEFT JOIN marcas m ON p.marca_id = m.id
      WHERE p.stock > 0 AND p.tipo = 'producto'
      GROUP BY p.id, p.nombre, p.stock, m.nombre
      HAVING MAX(v.fecha_venta) < NOW() - INTERVAL '90 days' 
      OR MAX(v.fecha_venta) IS NULL
      ORDER BY ultima_venta ASC NULLS FIRST
      LIMIT 50
    `;

    const [hoyRes, mesRes, invRes, lowStockRes, topRes, catRes, huesoRes] =
      await Promise.all([
        pool.query(ventasHoyQuery),
        pool.query(ventasMesQuery),
        pool.query(inventarioQuery),
        pool.query(bajoStockQuery),
        pool.query(topProductosQuery),
        pool.query(ventasPorCategoriaQuery),
        pool.query(productosSinMovimientoQuery),
      ]);

    return NextResponse.json({
      ventasHoy: parseFloat(hoyRes.rows[0].total),
      ventasMes: parseFloat(mesRes.rows[0].total),
      ticketPromedio: parseFloat(mesRes.rows[0].ticket_promedio),
      totalDescuentos: parseFloat(mesRes.rows[0].total_descuentos),
      inventarioTotal: parseFloat(invRes.rows[0].total),
      bajoStock: lowStockRes.rows,
      topProductos: topRes.rows,
      ventasPorCategoria: catRes.rows.map((r) => ({
        name: r.nombre || "Sin Categoría",
        value: parseFloat(r.total),
      })),
      productosSinMovimiento: huesoRes.rows,
    });
  } catch (error: any) {
    console.error("Error dashboard summary:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
