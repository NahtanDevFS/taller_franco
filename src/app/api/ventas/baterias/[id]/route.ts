import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = Promise<{ id: string }>;

//PUT para ditar registro de batería y manejar cambio de producto y stock
export async function PUT(req: Request, { params }: { params: Params }) {
  const client = await pool.connect();
  const { id } = await params; //ID del detalle_venta

  try {
    const body = await req.json();
    const {
      codigo_unico,
      garantia_meses,
      fecha_venta,
      cliente,
      venta_id,
      producto_id, // Nuevo ID de producto
      precio, // Nuevo precio
    } = body;

    await client.query("BEGIN");

    //obtener datos actuales de la venta antes de tocar nada
    const currentRes = await client.query(
      "SELECT producto_id, precio_unitario, datos_extra FROM detalle_ventas WHERE id = $1",
      [id]
    );

    if (currentRes.rowCount === 0) throw new Error("Registro no encontrado");

    const oldDetail = currentRes.rows[0];
    const oldProdId = oldDetail.producto_id;
    const oldPrice = parseFloat(oldDetail.precio_unitario);
    const newPrice = parseFloat(precio);
    const newProdId = parseInt(producto_id);

    //preparar el nuevo JSON de datos
    const newDatosExtra = {
      ...(oldDetail.datos_extra || {}),
      codigo_bateria: codigo_unico,
      garantia_meses: parseInt(garantia_meses),
    };

    //si se cambió el modelo de la batería
    if (oldProdId !== newProdId) {
      //verificar stock de la nueva batería
      const stockCheck = await client.query(
        "SELECT stock FROM productos WHERE id = $1",
        [newProdId]
      );
      if (stockCheck.rows[0].stock < 1) {
        throw new Error(
          "No hay stock disponible del nuevo modelo seleccionado"
        );
      }

      //devolver stock del producto viejo (+1)
      await client.query(
        "UPDATE productos SET stock = stock + 1 WHERE id = $1",
        [oldProdId]
      );

      //restar stock del producto nuevo (-1)
      await client.query(
        "UPDATE productos SET stock = stock - 1 WHERE id = $1",
        [newProdId]
      );

      //actualizar el detalle con el nuevo producto y precio
      await client.query(
        "UPDATE detalle_ventas SET producto_id = $1, precio_unitario = $2, subtotal = $2, datos_extra = $3 WHERE id = $4",
        [newProdId, newPrice, JSON.stringify(newDatosExtra), id]
      );

      //ajustar el total de la Venta Padre (Total = Total - PrecioViejo + PrecioNuevo)
      await client.query(
        "UPDATE ventas SET total = total - $1 + $2, fecha_venta = $3, cliente = $4 WHERE id = $5",
        [oldPrice, newPrice, fecha_venta, cliente, venta_id]
      );
    } else {
      await client.query(
        "UPDATE detalle_ventas SET datos_extra = $1 WHERE id = $2",
        [JSON.stringify(newDatosExtra), id]
      );

      await client.query(
        "UPDATE ventas SET fecha_venta = $1, cliente = $2 WHERE id = $3",
        [fecha_venta, cliente, venta_id]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ message: "Registro actualizado correctamente" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

//DELETE para anular venta de batería
export async function DELETE(req: Request, { params }: { params: Params }) {
  const client = await pool.connect();
  const { id } = await params; // ID del detalle

  try {
    await client.query("BEGIN");

    //obtener info para revertir
    const res = await client.query(
      "SELECT venta_id, producto_id FROM detalle_ventas WHERE id = $1",
      [id]
    );
    if (res.rowCount === 0) throw new Error("Registro no encontrado");

    const { venta_id, producto_id } = res.rows[0];

    //devolver Stock
    await client.query("UPDATE productos SET stock = stock + 1 WHERE id = $1", [
      producto_id,
    ]);

    //marcar venta como anulada (en lugar de borrarla física, para historial)
    await client.query("UPDATE ventas SET estado = 'anulada' WHERE id = $1", [
      venta_id,
    ]);

    await client.query("COMMIT");
    return NextResponse.json({ message: "Venta anulada y stock devuelto" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
