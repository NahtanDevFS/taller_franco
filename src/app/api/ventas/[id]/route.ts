import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = Promise<{ id: string }>;

//GET para obtener detalle de una venta específica con los productos de dicha venta
export async function GET(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  try {
    const ventaRes = await pool.query(
      `
      SELECT v.*, u.nombre as vendedor_nombre 
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
      `
      SELECT d.*, p.nombre as producto_nombre, p.codigo_barras 
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

//DELETE (que realmente funciona como un PUT) para eliminar lógicamente un producto (anular la venta) y devolver el stock
export async function DELETE(req: Request, { params }: { params: Params }) {
  const client = await pool.connect();
  const { id } = await params;

  try {
    await client.query("BEGIN");

    // obtener detalles para saber qué devolver
    const detalles = await client.query(
      "SELECT producto_id, cantidad FROM detalle_ventas WHERE venta_id = $1",
      [id]
    );

    // verificar si la venta ya estaba anulada
    const ventaCheck = await client.query(
      "SELECT estado FROM ventas WHERE id = $1",
      [id]
    );
    if (ventaCheck.rows[0].estado === "anulada") {
      throw new Error("Esta venta ya está anulada");
    }

    // devolver el stock
    for (const item of detalles.rows) {
      await client.query(
        "UPDATE productos SET stock = stock + $1 WHERE id = $2",
        [item.cantidad, item.producto_id]
      );
    }

    //marcar como anulada
    await client.query("UPDATE ventas SET estado = 'anulada' WHERE id = $1", [
      id,
    ]);

    await client.query("COMMIT");
    return NextResponse.json({ message: "Venta anulada y stock restaurado" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// PUT para agregar items a una venta existente
export async function PUT(req: Request, { params }: { params: Params }) {
  const client = await pool.connect();
  const { id } = await params;

  try {
    const body = await req.json();
    const { items, total, cliente, estado, fecha_venta } = body; //array de info de productos

    await client.query("BEGIN");

    //devuelve lo que ya se había vendido y obtenemos los detalles actuales antes de borrarlos
    const oldDetailsRes = await client.query(
      `SELECT d.producto_id, d.cantidad, p.tipo 
       FROM detalle_ventas d
       JOIN productos p ON d.producto_id = p.id
       WHERE d.venta_id = $1`,
      [id]
    );

    for (const oldItem of oldDetailsRes.rows) {
      //solo devolvemos stock si es un producto físico
      if (oldItem.tipo === "producto") {
        await client.query(
          "UPDATE productos SET stock = stock + $1 WHERE id = $2",
          [oldItem.cantidad, oldItem.producto_id]
        );
      }
    }
    //aquí limpio los detalles antiguos
    await client.query("DELETE FROM detalle_ventas WHERE venta_id = $1", [id]);

    //esto actualiza la cabecera de venta, en donde si se envía fecha_venta se actualiza, si no se mantiene la original gracias a coalesce
    await client.query(
      `UPDATE ventas 
       SET total = $1, cliente = $2, estado = $3, fecha_venta = COALESCE($4, fecha_venta)
       WHERE id = $5`,
      [total, cliente, estado, fecha_venta, id]
    );

    //aquí se vuelve a aplicar los nuevos items y restar el stock
    for (const item of items) {
      const prodRes = await client.query(
        "SELECT stock, tipo, nombre FROM productos WHERE id = $1",
        [item.producto_id]
      );

      if (prodRes.rows.length === 0)
        throw new Error(`Producto ${item.producto_id} no existe`);
      const prodDB = prodRes.rows[0];

      //valida el stock solo si es producto físico
      if (prodDB.tipo === "producto") {
        if (prodDB.stock < item.cantidad) {
          throw new Error(
            `Stock insuficiente para ${prodDB.nombre} (Disponible: ${prodDB.stock})`
          );
        }
      }

      const datosExtra = item.datos_extra
        ? JSON.stringify(item.datos_extra)
        : null;

      //insertar nuevo detalle
      await client.query(
        `INSERT INTO detalle_ventas 
         (venta_id, producto_id, cantidad, precio_unitario, subtotal, datos_extra)
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

      //restar stock solo si es producto físico
      if (prodDB.tipo === "producto") {
        await client.query(
          "UPDATE productos SET stock = stock - $1 WHERE id = $2",
          [item.cantidad, item.producto_id]
        );
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ message: "Venta sincronizada correctamente" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error sync venta:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// PATCH para actualizar el estado de una venta, este puede ser de pendiente a completada
export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    const body = await request.json();
    const { estado } = body;

    if (!estado) {
      return NextResponse.json({ error: "Estado requerido" }, { status: 400 });
    }

    await client.query("BEGIN");

    const res = await client.query(
      "UPDATE ventas SET estado = $1 WHERE id = $2 RETURNING *",
      [estado, id]
    );

    if (res.rowCount === 0) {
      throw new Error("Venta no encontrada");
    }

    await client.query("COMMIT");
    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
