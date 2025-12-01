import { NextResponse } from "next/server";
import { pool, query } from "@/lib/db";

//GET para el historial de ventas paginado
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;
  //para filtro por rango de fechas
  const startDate = searchParams.get("startDate"); // YYYY-MM-DD
  const endDate = searchParams.get("endDate"); // YYYY-MM-DD
  const showAnuladas = searchParams.get("showAnuladas") === "true";

  try {
    let filterConditions = [];
    let filterParams = [];
    let pCount = 1;

    // Si no se piden anuladas, filtramos solo las completadas y si se piden, no aplicamos filtro de estado se muestran también las anuladas
    if (!showAnuladas) {
      filterConditions.push("v.estado = 'completada'");
    }

    // Construcción dinámica del where
    if (startDate) {
      filterConditions.push(`v.fecha_venta >= $${pCount}`);
      filterParams.push(startDate);
      pCount++;
    }
    if (endDate) {
      filterConditions.push(`v.fecha_venta <= $${pCount}`);
      // Agregamos hora final para cubrir todo el día seleccionado
      filterParams.push(`${endDate} 23:59:59`);
      pCount++;
    }

    const whereString =
      filterConditions.length > 0
        ? `WHERE ${filterConditions.join(" AND ")}`
        : "";

    // Query de Datos
    const sql = `
      SELECT v.*, u.nombre as vendedor_nombre, v.cliente,
      (SELECT COUNT(*) FROM detalle_ventas WHERE venta_id = v.id) as cantidad_items
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      ${whereString}
      ORDER BY v.fecha_venta DESC
      LIMIT $${pCount} OFFSET $${pCount + 1}
    `;

    // Query de conteo (total para paginación)
    const countSql = `SELECT COUNT(*) FROM ventas v ${whereString}`;

    const [ventasRes, countRes] = await Promise.all([
      query(sql, [...filterParams, limit, offset]),
      query(countSql, filterParams),
    ]);

    return NextResponse.json({
      data: ventasRes.rows,
      total: parseInt(countRes.rows[0].count),
      page,
      totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

//POST para registrar una nueva venta
export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { usuario_id, items, total, cliente } = body;

    await client.query("BEGIN");

    // crear la nueva venta
    const ventaRes = await client.query(
      "INSERT INTO ventas (usuario_id, total, estado, cliente) VALUES ($1, $2, $3, $4) RETURNING id",
      [usuario_id, total, "completada", cliente || "CF"]
    );
    const ventaId = ventaRes.rows[0].id;

    // Insertar detalles y restar el stock de la tabla de productos
    for (const item of items) {
      // Validar stock (doble check)
      const stockRes = await client.query(
        "SELECT stock FROM productos WHERE id = $1",
        [item.producto_id]
      );
      if (stockRes.rows[0].stock < item.cantidad) {
        throw new Error(
          `Stock insuficiente para producto ID ${item.producto_id}`
        );
      }

      const datosExtra = item.datos_extra
        ? JSON.stringify(item.datos_extra)
        : null;

      await client.query(
        `
        INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal, datos_extra)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          ventaId,
          item.producto_id,
          item.cantidad,
          item.precio,
          item.cantidad * item.precio,
          datosExtra,
        ]
      );

      await client.query(
        "UPDATE productos SET stock = stock - $1 WHERE id = $2",
        [item.cantidad, item.producto_id]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ message: "Venta registrada", id: ventaId });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
