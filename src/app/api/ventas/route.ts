import { NextResponse } from "next/server";
import { pool, query } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

//GET para el historial de ventas paginado
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;
  const startDate = searchParams.get("startDate"); // YYYY-MM-DD
  const endDate = searchParams.get("endDate"); // YYYY-MM-DD
  const showAnuladas = searchParams.get("showAnuladas") === "true";

  try {
    let filterConditions = [];
    let filterParams = [];
    let pCount = 1;

    if (!showAnuladas) {
      filterConditions.push("v.estado IN ('completada', 'pendiente')");
    }

    if (startDate) {
      filterConditions.push(`v.fecha_venta >= $${pCount}`);
      filterParams.push(startDate);
      pCount++;
    }
    if (endDate) {
      filterConditions.push(`v.fecha_venta <= $${pCount}`);
      filterParams.push(`${endDate} 23:59:59`);
      pCount++;
    }

    const whereString =
      filterConditions.length > 0
        ? `WHERE ${filterConditions.join(" AND ")}`
        : "";

    const sql = `
      SELECT v.*, u.nombre as vendedor_nombre, v.cliente,
      (SELECT COUNT(*) FROM detalle_ventas WHERE venta_id = v.id) as cantidad_items
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      ${whereString}
      ORDER BY v.fecha_venta DESC
      LIMIT $${pCount} OFFSET $${pCount + 1}
    `;

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await pool.connect();
  try {
    const body = await request.json();
    const {
      usuario_id,
      items,
      total,
      cliente,
      estado,
      idempotency_key,
      descuento = 0,
    } = body;

    //si el frontend no mandó llave (cache viejo), generamos una para que no falle el insert, aunque perdemos la protección de idempotencia en ese caso específico
    const transactionKey = idempotency_key || crypto.randomUUID();

    await client.query("BEGIN");

    const estadoFinal = estado || "completada";

    const ventaRes = await client.query(
      `INSERT INTO ventas (usuario_id, total, estado, cliente, idempotency_key, descuento) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id`,
      [
        usuario_id,
        total,
        estadoFinal,
        cliente || "CF",
        transactionKey,
        descuento,
      ]
    );
    const ventaId = ventaRes.rows[0].id;

    for (const item of items) {
      const prodRes = await client.query(
        `SELECT stock, tipo, nombre, costo,
                permite_fraccion, atributos, requiere_serial 
         FROM productos WHERE id = $1`,
        [item.producto_id]
      );

      if (prodRes.rows.length === 0) {
        throw new Error(`Producto ID ${item.producto_id} no encontrado`);
      }

      const productoDB = prodRes.rows[0];
      const prodAttrs = productoDB.atributos || {};

      let costoSnapshot = parseFloat(productoDB.costo) || 0;

      const esLiquido = productoDB.permite_fraccion;
      const capacidad = parseFloat(prodAttrs.capacidad || 1);
      const unidadMedida = prodAttrs.unidad_medida || "Unidades";

      const datosExtraObj = item.datos_extra || {};
      let createdParcialId = null;

      if (productoDB.requiere_serial) {
        const serialVendido = datosExtraObj.numero_serie;

        if (!serialVendido) {
          throw new Error(
            `El producto ${productoDB.nombre} requiere un número de serie.`
          );
        }

        const updateSerialRes = await client.query(
          `UPDATE existencias_serializadas 
           SET estado = 'vendido', venta_id = $1, updated_at = NOW()
           WHERE serial = $2 AND producto_id = $3 AND estado = 'disponible'`,
          [ventaId, serialVendido, item.producto_id]
        );

        if (updateSerialRes.rowCount === 0) {
          throw new Error(
            `El serial ${serialVendido} de ${productoDB.nombre} no está disponible o ya fue vendido.`
          );
        }
      } else if (productoDB.tipo === "producto") {
        if (datosExtraObj.es_item_parcial && datosExtraObj.parcial_id) {
          const parcialId = datosExtraObj.parcial_id;
          const parcCheck = await client.query(
            "SELECT cantidad_restante FROM inventario_parcial WHERE id=$1",
            [parcialId]
          );

          if (
            parcCheck.rows.length === 0 ||
            parseFloat(parcCheck.rows[0].cantidad_restante) < item.cantidad
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

          if (esLiquido && capacidad > 0) {
            costoSnapshot = costoSnapshot / capacidad;
            const botellasNecesarias = Math.ceil(item.cantidad / capacidad);
            stockARestar = botellasNecesarias;
            const totalLiquido = botellasNecesarias * capacidad;
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

      if (createdParcialId) {
        datosExtraObj.created_parcial_id = createdParcialId;
      }

      if (esLiquido) {
        datosExtraObj.unidad_medida =
          unidadMedida || datosExtraObj.descripcion_unidad;
        datosExtraObj.es_liquido = true;
      }

      await client.query(
        `INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal, datos_extra)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          ventaId,
          item.producto_id,
          item.cantidad,
          item.precio,
          costoSnapshot,
          item.cantidad * item.precio,
          JSON.stringify(datosExtraObj),
        ]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ message: "Venta registrada", id: ventaId });
  } catch (error: any) {
    await client.query("ROLLBACK");

    if (
      error.code === "23505" &&
      error.constraint?.includes("idempotency_key")
    ) {
      return NextResponse.json(
        {
          error: "DUPLICATE_TRANSACTION",
          message: "Esta venta ya fue procesada previamente",
        },
        { status: 409 }
      );
    }
    console.error("Error al procesar venta:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
