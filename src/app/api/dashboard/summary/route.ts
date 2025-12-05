import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

//GET para los cards de resumen de ventas
export async function GET() {
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
      SELECT COALESCE(SUM(stock * precio), 0) as total 
      FROM productos
    `;

    //productos con bajo Stock (limitado a 20)
    const bajoStockQuery = `
      SELECT p.id, p.nombre, p.stock, p.stock_minimo, m.nombre as marca, c.nombre as categoria
      FROM productos p
      LEFT JOIN marcas m ON p.marca_id = m.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.stock <= p.stock_minimo
      ORDER BY p.stock ASC
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
