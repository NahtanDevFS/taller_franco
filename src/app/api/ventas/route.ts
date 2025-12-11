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
      filterConditions.push("v.estado IN ('completada', 'pendiente')");
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
    const { usuario_id, items, total, cliente, estado } = body;

    await client.query("BEGIN");

    const estadoFinal = estado || "completada";

    const ventaRes = await client.query(
      "INSERT INTO ventas (usuario_id, total, estado, cliente) VALUES ($1, $2, $3, $4) RETURNING id",
      [usuario_id, total, estadoFinal, cliente || "CF"]
    );
    const ventaId = ventaRes.rows[0].id;

    // Insertar detalles y restar el stock
    for (const item of items) {
      // Obtener datos frescos del producto
      const prodRes = await client.query(
        "SELECT stock, tipo, nombre, es_liquido, capacidad FROM productos WHERE id = $1",
        [item.producto_id]
      );

      if (prodRes.rows.length === 0) {
        throw new Error(`Producto ID ${item.producto_id} no encontrado`);
      }

      const productoDB = prodRes.rows[0];

      //variable para rastrear si esta venta abrió una botella (creó un parcial), esto es crucial para que el botón "Anular" sepa qué borrar después
      let createdParcialId = null;

      if (productoDB.tipo === "producto") {
        if (item.datos_extra?.es_item_parcial && item.datos_extra?.parcial_id) {
          const parcialId = item.datos_extra.parcial_id;

          const parcCheck = await client.query(
            "SELECT cantidad_restante FROM inventario_parcial WHERE id=$1",
            [parcialId]
          );
          if (
            parcCheck.rows.length === 0 ||
            parcCheck.rows[0].cantidad_restante < item.cantidad
          ) {
            throw new Error(`El item abierto ya no tiene suficiente cantidad.`);
          }

          await client.query(
            "UPDATE inventario_parcial SET cantidad_restante = cantidad_restante - $1 WHERE id = $2",
            [item.cantidad, parcialId]
          );

          await client.query(
            "UPDATE inventario_parcial SET activo = false WHERE id = $1 AND cantidad_restante <= 0.01",
            [parcialId]
          );
        } else {
          if (productoDB.stock < 1) {
            throw new Error(
              `Stock insuficiente para ${productoDB.nombre}. Disponibles: ${productoDB.stock}`
            );
          }

          let stockARestar = item.cantidad;
          let remanente = 0;

          if (productoDB.es_liquido && productoDB.capacidad > 0) {
            //ejemplo de venta 7L, Capacidad 5L - 7 / 5 = 1.4 -> necesito 2 botellas
            const botellasNecesarias = Math.ceil(
              item.cantidad / productoDB.capacidad
            );
            stockARestar = botellasNecesarias;

            const totalLiquido = botellasNecesarias * productoDB.capacidad;
            remanente = totalLiquido - item.cantidad;
          }
          await client.query(
            "UPDATE productos SET stock = stock - $1 WHERE id = $2",
            [stockARestar, item.producto_id]
          );

          if (remanente > 0) {
            const codigoRef = `OPEN-${Date.now()}-${Math.floor(
              Math.random() * 1000
            )}`;
            const parcRes = await client.query(
              `INSERT INTO inventario_parcial (producto_id, cantidad_restante, codigo_referencia)
               VALUES ($1, $2, $3) RETURNING id`,
              [item.producto_id, remanente, codigoRef]
            );
            createdParcialId = parcRes.rows[0].id;
          }
        }
      }

      const datosExtraObj = item.datos_extra || {};

      if (createdParcialId) {
        datosExtraObj.created_parcial_id = createdParcialId;
      }

      const datosExtraJson = JSON.stringify(datosExtraObj);

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
          datosExtraJson,
        ]
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
