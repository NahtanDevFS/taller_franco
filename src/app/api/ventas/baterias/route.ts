import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET: Listar historial de baterías
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    //Construcción dinámica de filtros
    let whereClauses = ["p.es_bateria = true", "v.estado = 'completada'"];
    let params = [];
    let pCount = 1;

    if (startDate) {
      whereClauses.push(`v.fecha_venta >= $${pCount}`);
      params.push(startDate);
      pCount++;
    }
    if (endDate) {
      whereClauses.push(`v.fecha_venta <= $${pCount}`);
      params.push(`${endDate} 23:59:59`); // Fin del día
      pCount++;
    }

    const whereString = whereClauses.join(" AND ");

    // Query de datos
    const sql = `
      SELECT 
        d.id,
        v.id as venta_id,
        v.fecha_venta,
        p.nombre as modelo_bateria,
        p.id as producto_id,
        d.precio_unitario,
        d.datos_extra->>'garantia_meses' as garantia,
        d.datos_extra->>'codigo_bateria' as codigo_unico,
        v.cliente as nombre_cliente
      FROM detalle_ventas d
      JOIN ventas v ON d.venta_id = v.id
      JOIN productos p ON d.producto_id = p.id
      WHERE ${whereString}
      ORDER BY v.fecha_venta DESC
      LIMIT $${pCount} OFFSET $${pCount + 1}
    `;

    //Query de conteo total
    const countSql = `
      SELECT COUNT(*)
      FROM detalle_ventas d
      JOIN ventas v ON d.venta_id = v.id
      JOIN productos p ON d.producto_id = p.id
      WHERE ${whereString}
    `;

    const [dataRes, countRes] = await Promise.all([
      pool.query(sql, [...params, limit, offset]),
      pool.query(countSql, params),
    ]);

    return NextResponse.json({
      data: dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      page,
      totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

//POST para registrar ventas de baterías
export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const {
      usuario_id,
      producto_id,
      precio,
      cliente,
      fecha_venta,
      codigo_unico,
      garantia_meses,
    } = body;

    await client.query("BEGIN");

    //verificar Stock
    const stockRes = await client.query(
      "SELECT stock FROM productos WHERE id = $1",
      [producto_id]
    );
    if (stockRes.rows.length === 0) throw new Error("Producto no encontrado");
    if (stockRes.rows[0].stock < 1) throw new Error("Sin stock disponible");

    //crear venta
    const ventaRes = await client.query(
      "INSERT INTO ventas (usuario_id, total, estado, cliente, fecha_venta) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [
        usuario_id,
        precio,
        "completada",
        cliente || "Consumidor Final",
        fecha_venta,
      ]
    );
    const ventaId = ventaRes.rows[0].id;

    //crear Detalle
    const datosExtra = JSON.stringify({
      garantia_meses: parseInt(garantia_meses),
      codigo_bateria: codigo_unico,
    });

    await client.query(
      `INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal, datos_extra)
       VALUES ($1, $2, 1, $3, $3, $4)`,
      [ventaId, producto_id, precio, datosExtra]
    );

    //restar stock
    await client.query("UPDATE productos SET stock = stock - 1 WHERE id = $1", [
      producto_id,
    ]);

    await client.query("COMMIT");
    return NextResponse.json({ message: "Batería registrada con éxito" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
