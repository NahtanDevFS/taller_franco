import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    //ventas de hoy
    const ventasHoyQuery = `
      SELECT COALESCE(SUM(total), 0) as total 
      FROM ventas 
      WHERE estado = 'completada' 
      AND date_trunc('day', fecha_venta) = date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'America/Guatemala')
    `;

    //finanzas del mes, ingresos, descuentos, costos, cantidad de ventas, calcula costo usando el histórico si existe (>0), sino usa el actual del producto
    const finanzasMesQuery = `
      SELECT 
        COALESCE(SUM(v.total), 0) as ingresos_totales,
        COALESCE(SUM(v.descuento), 0) as total_descuentos,
        COALESCE(SUM(sub_costos.costo_total), 0) as costos_totales,
        COUNT(v.id) as cantidad_ventas
      FROM ventas v
      LEFT JOIN (
        SELECT 
          dv.venta_id, 
          SUM(
            dv.cantidad * CASE 
              WHEN dv.costo_unitario > 0 THEN dv.costo_unitario 
              
              WHEN p.permite_fraccion = true AND (p.atributos->>'capacidad')::numeric > 0 THEN 
                 p.costo / (p.atributos->>'capacidad')::numeric

              ELSE p.costo
            END
          ) as costo_total
        FROM detalle_ventas dv
        JOIN productos p ON dv.producto_id = p.id
        GROUP BY dv.venta_id
      ) as sub_costos ON v.id = sub_costos.venta_id
      WHERE v.estado = 'completada'
      AND date_trunc('month', v.fecha_venta) = date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Guatemala')
    `;

    //valor de inventario actual
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

    //stock bajo
    const bajoStockQuery = `
      WITH stock_real_calc AS (
        SELECT 
          p.id, p.nombre, p.stock_minimo, p.marca_id, 
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
      SELECT src.id, src.nombre, src.stock_actual as stock, src.stock_minimo, m.nombre as marca
      FROM stock_real_calc src
      LEFT JOIN marcas m ON src.marca_id = m.id
      WHERE src.stock_actual <= src.stock_minimo
      ORDER BY src.stock_actual ASC
      LIMIT 20
    `;

    //top 5 productos
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

    //productos sin movimiento (+90 días)
    const productosSinMovimientoQuery = `
      SELECT p.id, p.nombre, p.stock, m.nombre as marca, MAX(v.fecha_venta) as ultima_venta
      FROM productos p
      LEFT JOIN detalle_ventas dv ON p.id = dv.producto_id
      LEFT JOIN ventas v ON dv.venta_id = v.id
      LEFT JOIN marcas m ON p.marca_id = m.id
      WHERE p.stock > 0 AND p.tipo = 'producto'
      GROUP BY p.id, p.nombre, p.stock, m.nombre
      HAVING MAX(v.fecha_venta) < NOW() - INTERVAL '90 days' OR MAX(v.fecha_venta) IS NULL
      ORDER BY ultima_venta ASC NULLS FIRST
      LIMIT 50
    `;

    const [hoyRes, finanzasRes, invRes, lowStockRes, topRes, catRes, huesoRes] =
      await Promise.all([
        pool.query(ventasHoyQuery),
        pool.query(finanzasMesQuery),
        pool.query(inventarioQuery),
        pool.query(bajoStockQuery),
        pool.query(topProductosQuery),
        pool.query(ventasPorCategoriaQuery),
        pool.query(productosSinMovimientoQuery),
      ]);

    const finanzas = finanzasRes.rows[0];
    const ingresos = parseFloat(finanzas.ingresos_totales);
    const costos = parseFloat(finanzas.costos_totales);
    const descuentos = parseFloat(finanzas.total_descuentos);
    const cantidadVentas = parseInt(finanzas.cantidad_ventas || "0");

    // Impuesto 5% pequeño contribuyente sobre el ingreso bruto
    const TASA_IMPUESTO = 0.05;
    const impuestosEstimados = (ingresos - costos) * TASA_IMPUESTO;

    const utilidadBruta = ingresos - costos;
    const utilidadNeta = utilidadBruta - impuestosEstimados;

    const margen =
      ingresos > 0 ? ((utilidadNeta / ingresos) * 100).toFixed(1) : "0";
    const ticketPromedio = cantidadVentas > 0 ? ingresos / cantidadVentas : 0;

    return NextResponse.json({
      ventasHoy: parseFloat(hoyRes.rows[0].total),
      inventarioTotal: parseFloat(invRes.rows[0].total),

      ventasMes: ingresos,
      costosMes: costos,
      impuestosEstimados,
      utilidadNeta,
      margenBeneficio: margen,
      ticketPromedio,
      totalDescuentos: descuentos,

      bajoStock: lowStockRes.rows,
      topProductos: topRes.rows,
      ventasPorCategoria: catRes.rows.map((r) => ({
        name: r.nombre || "Sin Categoría",
        value: parseFloat(r.total),
      })),
      productosSinMovimiento: huesoRes.rows,
    });
  } catch (error: any) {
    console.error("Error dashboard:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
