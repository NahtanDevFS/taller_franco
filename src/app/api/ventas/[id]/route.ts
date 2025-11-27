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

// PUT: Agregar items a una venta existente
export async function PUT(req: Request, { params }: { params: Params }) {
  const client = await pool.connect();
  const { id } = await params;

  try {
    const body = await req.json();
    const { items_nuevos } = body; // Array de nuevos productos a agregar

    await client.query("BEGIN");

    let totalAdicional = 0;

    for (const item of items_nuevos) {
      //validar Stock
      const stockRes = await client.query(
        "SELECT stock FROM productos WHERE id = $1",
        [item.producto_id]
      );
      if (stockRes.rows[0].stock < item.cantidad)
        throw new Error(`Sin stock para ${item.nombre}`);

      const subtotal = item.cantidad * item.precio;
      const datosExtra = item.datos_extra
        ? JSON.stringify(item.datos_extra)
        : null;

      //insertar detalle
      await client.query(
        `
        INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal, datos_extra)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [id, item.producto_id, item.cantidad, item.precio, subtotal, datosExtra]
      );

      //restar stock
      await client.query(
        "UPDATE productos SET stock = stock - $1 WHERE id = $2",
        [item.cantidad, item.producto_id]
      );

      totalAdicional += subtotal;
    }

    //actualizar total de la venta
    await client.query("UPDATE ventas SET total = total + $1 WHERE id = $2", [
      totalAdicional,
      id,
    ]);

    await client.query("COMMIT");
    return NextResponse.json({ message: "Productos agregados a la venta" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
