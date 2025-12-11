import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = Promise<{ id: string }>;

//función para manejar la lógica compleja de convertir litros a botellas y limpiar parciales
async function restaurarStock(client: any, ventaId: string) {
  const oldDetailsRes = await client.query(
    `SELECT d.id, d.producto_id, d.cantidad, d.datos_extra, 
            p.tipo, p.es_liquido, p.capacidad
     FROM detalle_ventas d
     JOIN productos p ON d.producto_id = p.id
     WHERE d.venta_id = $1`,
    [ventaId]
  );

  for (const item of oldDetailsRes.rows) {
    if (item.tipo === "producto") {
      const datosExtra = item.datos_extra || {};

      //traer un item de inventario parcial
      if (datosExtra.es_item_parcial && datosExtra.parcial_id) {
        //devolver el líquido a la botella abierta
        await client.query(
          "UPDATE inventario_parcial SET cantidad_restante = cantidad_restante + $1, activo = true WHERE id = $2",
          [item.cantidad, datosExtra.parcial_id]
        );
      }
      //traer un item del inventario normal
      else {
        let cantidadARestar = 0;

        if (item.es_liquido && item.capacidad > 0) {
          //lógica para convertir por ejemplo, litros a una garrafa de aceite
          cantidadARestar = Math.ceil(item.cantidad / item.capacidad);
        } else {
          cantidadARestar = Math.ceil(item.cantidad);
        }

        await client.query(
          "UPDATE productos SET stock = stock + $1 WHERE id = $2",
          [cantidadARestar, item.producto_id]
        );

        if (datosExtra.created_parcial_id) {
          await client.query("DELETE FROM inventario_parcial WHERE id = $1", [
            datosExtra.created_parcial_id,
          ]);
        }
      }
    }
  }
}

//GET para obtener detalle de la venta
export async function GET(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  try {
    const ventaRes = await pool.query(
      `SELECT v.*, u.nombre as vendedor_nombre 
       FROM ventas v LEFT JOIN usuarios u ON v.usuario_id = u.id 
       WHERE v.id = $1`,
      [id]
    );

    if (ventaRes.rowCount === 0)
      return NextResponse.json(
        { error: "Venta no encontrada" },
        { status: 404 }
      );

    const detallesRes = await pool.query(
      `SELECT d.*, p.nombre as producto_nombre, p.codigo_barras 
       FROM detalle_ventas d 
       JOIN productos p ON d.producto_id = p.id 
       WHERE d.venta_id = $1`,
      [id]
    );

    return NextResponse.json({
      ...ventaRes.rows[0],
      detalles: detallesRes.rows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

//DELETE para anular una venta (eliminación lógica)
export async function DELETE(req: Request, { params }: { params: Params }) {
  const client = await pool.connect();
  const { id } = await params;

  try {
    await client.query("BEGIN");

    const ventaCheck = await client.query(
      "SELECT estado FROM ventas WHERE id = $1",
      [id]
    );
    if (ventaCheck.rowCount === 0) throw new Error("Venta no encontrada");
    if (ventaCheck.rows[0].estado === "anulada")
      throw new Error("Esta venta ya está anulada");

    await restaurarStock(client, id);

    await client.query("UPDATE ventas SET estado = 'anulada' WHERE id = $1", [
      id,
    ]);

    await client.query("COMMIT");
    return NextResponse.json({
      message: "Venta anulada y stock restaurado correctamente",
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

//PUT para editar una venta considerando la correcta actualización respecto al inventario de productos
export async function PUT(req: Request, { params }: { params: Params }) {
  const client = await pool.connect();
  const { id } = await params;

  try {
    const body = await req.json();
    const { items, total, cliente, estado, fecha_venta } = body;

    await client.query("BEGIN");

    await restaurarStock(client, id);

    await client.query("DELETE FROM detalle_ventas WHERE venta_id = $1", [id]);

    await client.query(
      `UPDATE ventas 
       SET total = $1, cliente = $2, estado = $3, fecha_venta = COALESCE($4, fecha_venta)
       WHERE id = $5`,
      [total, cliente, estado, fecha_venta, id]
    );

    for (const item of items) {
      const prodRes = await client.query(
        "SELECT stock, tipo, nombre, es_liquido, capacidad FROM productos WHERE id = $1",
        [item.producto_id]
      );
      if (prodRes.rows.length === 0)
        throw new Error(`Producto ${item.producto_id} no existe`);
      const prodDB = prodRes.rows[0];

      if (prodDB.tipo === "producto") {
        if (item.datos_extra?.es_item_parcial && item.datos_extra?.parcial_id) {
          const parcialId = item.datos_extra.parcial_id;
          await client.query(
            "UPDATE inventario_parcial SET cantidad_restante = cantidad_restante - $1 WHERE id = $2",
            [item.cantidad, parcialId]
          );
          await client.query(
            "UPDATE inventario_parcial SET activo = false WHERE id = $1 AND cantidad_restante <= 0.01",
            [parcialId]
          );
        } else {
          if (prodDB.stock < 1)
            throw new Error(`Sin stock de ${prodDB.nombre}`);

          if (prodDB.es_liquido && item.cantidad < prodDB.capacidad) {
            await client.query(
              "UPDATE productos SET stock = stock - 1 WHERE id = $1",
              [item.producto_id]
            );

            const remanente = prodDB.capacidad - item.cantidad;
            const codigoRef = `OPEN-${Date.now()}-${Math.floor(
              Math.random() * 1000
            )}`;

            const parcRes = await client.query(
              `INSERT INTO inventario_parcial (producto_id, cantidad_restante, codigo_referencia)
                 VALUES ($1, $2, $3) RETURNING id`,
              [item.producto_id, remanente, codigoRef]
            );

            if (!item.datos_extra) item.datos_extra = {};
            item.datos_extra.created_parcial_id = parcRes.rows[0].id;
          } else {
            let stockARestar = item.cantidad;
            let remanente = 0;

            if (prodDB.es_liquido && prodDB.capacidad > 0) {
              const botellas = Math.ceil(item.cantidad / prodDB.capacidad);
              stockARestar = botellas;
              remanente = botellas * prodDB.capacidad - item.cantidad;
            }

            await client.query(
              "UPDATE productos SET stock = stock - $1 WHERE id = $2",
              [Math.ceil(stockARestar), item.producto_id]
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
              if (!item.datos_extra) item.datos_extra = {};
              item.datos_extra.created_parcial_id = parcRes.rows[0].id;
            }
          }
        }
      }

      const datosExtra = item.datos_extra
        ? JSON.stringify(item.datos_extra)
        : null;
      await client.query(
        `INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal, datos_extra)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          item.producto_id,
          item.cantidad,
          item.precio,
          item.cantidad * item.precio,
          datosExtra,
        ]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ message: "Venta actualizada correctamente" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

//PATCH para cuando se modifica el estado de una venta
export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { estado } = body;
    if (!estado)
      return NextResponse.json({ error: "Estado requerido" }, { status: 400 });

    await client.query("BEGIN");
    const res = await client.query(
      "UPDATE ventas SET estado = $1 WHERE id = $2 RETURNING *",
      [estado, id]
    );
    if (res.rowCount === 0) throw new Error("Venta no encontrada");

    await client.query("COMMIT");
    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
