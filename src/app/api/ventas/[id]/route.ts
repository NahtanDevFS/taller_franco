import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ id: string }>;

async function restaurarStock(client: any, ventaId: string) {
  const oldDetailsRes = await client.query(
    `SELECT d.id, d.producto_id, d.cantidad, d.datos_extra, 
            p.tipo, p.permite_fraccion, p.atributos, p.requiere_serial
     FROM detalle_ventas d
     JOIN productos p ON d.producto_id = p.id
     WHERE d.venta_id = $1`,
    [ventaId]
  );

  for (const item of oldDetailsRes.rows) {
    const datosExtra = item.datos_extra || {};

    const capacidad = parseFloat(item.atributos?.capacidad || 1);
    const esLiquido = item.permite_fraccion;

    if (item.requiere_serial) {
      const serial = datosExtra.numero_serie || datosExtra.codigo_bateria;

      if (serial) {
        await client.query(
          `UPDATE existencias_serializadas 
           SET estado = 'disponible', venta_id = NULL, updated_at = NOW() 
           WHERE producto_id = $1 AND serial = $2`,
          [item.producto_id, serial]
        );
      }
    } else if (item.tipo === "producto") {
      if (datosExtra.es_item_parcial && datosExtra.parcial_id) {
        await client.query(
          "UPDATE inventario_parcial SET cantidad_restante = cantidad_restante + $1, activo = true WHERE id = $2",
          [item.cantidad, datosExtra.parcial_id]
        );
      } else {
        let cantidadARestar = 0;

        if (esLiquido && capacidad > 0) {
          cantidadARestar = Math.ceil(item.cantidad / capacidad);
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      `SELECT 
          d.*, 
          p.nombre as producto_nombre, 
          p.codigo_barras,
          p.stock,             
          p.atributos,        
          p.permite_fraccion as es_liquido, 
          p.tipo,
          p.requiere_serial,
          p.tiene_garantia as es_bateria
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    console.error("Error anulando venta:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

//PUT para editar una venta considerando la correcta actualización respecto al inventario de productos
export async function PUT(req: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await pool.connect();
  const { id } = await params;

  try {
    const body = await req.json();
    const { items, total, descuento, cliente, estado, fecha_venta } = body;

    await client.query("BEGIN");

    await restaurarStock(client, id);

    await client.query("DELETE FROM detalle_ventas WHERE venta_id = $1", [id]);

    await client.query(
      `UPDATE ventas 
       SET total = $1, descuento = $2, cliente = $3, estado = $4, fecha_venta = COALESCE($5, fecha_venta)
       WHERE id = $6`,
      [total, descuento, cliente, estado, fecha_venta, id]
    );

    for (const item of items) {
      const prodRes = await client.query(
        "SELECT stock, tipo, nombre, costo, permite_fraccion, atributos, requiere_serial FROM productos WHERE id = $1",
        [item.producto_id]
      );
      if (prodRes.rows.length === 0)
        throw new Error(`Producto ${item.producto_id} no existe`);

      const prodDB = prodRes.rows[0];
      const prodAttrs = prodDB.atributos || {};

      let costoSnapshot = parseFloat(prodDB.costo) || 0;

      const capacidad = parseFloat(prodAttrs.capacidad || 1);
      const unidadMedida = prodAttrs.unidad_medida || "Unidades";
      const esLiquido = prodDB.permite_fraccion;

      let createdParcialId = null;
      let datosExtraObj = item.datos_extra || {};

      if (prodDB.tipo === "producto") {
        if (prodDB.requiere_serial) {
          const serial = datosExtraObj.numero_serie;
          if (!serial)
            throw new Error(
              `El producto ${prodDB.nombre} requiere un número de serie`
            );

          const serialCheck = await client.query(
            "SELECT estado FROM existencias_serializadas WHERE serial = $1 AND producto_id = $2",
            [serial, item.producto_id]
          );

          if (serialCheck.rowCount === 0)
            throw new Error(`Serial ${serial} no existe en inventario`);

          if (serialCheck.rows[0].estado !== "disponible") {
            throw new Error(`El serial ${serial} ya no está disponible`);
          }

          await client.query(
            `UPDATE existencias_serializadas 
             SET estado = 'vendido', venta_id = $1, updated_at = NOW() 
             WHERE serial = $2 AND producto_id = $3`,
            [id, serial, item.producto_id]
          );
        } else if (datosExtraObj.es_item_parcial && datosExtraObj.parcial_id) {
          const parcialId = datosExtraObj.parcial_id;
          if (esLiquido && capacidad > 0) {
            costoSnapshot = costoSnapshot / capacidad;
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
          if (prodDB.stock < 1)
            throw new Error(`Sin stock de ${prodDB.nombre}`);

          if (esLiquido && item.cantidad < capacidad) {
            if (capacidad > 0) {
              costoSnapshot = costoSnapshot / capacidad;
            }
            await client.query(
              "UPDATE productos SET stock = stock - 1 WHERE id = $1",
              [item.producto_id]
            );
            const remanente = capacidad - item.cantidad;
            const codigoRef = `OPEN-${Date.now()}-${Math.floor(
              Math.random() * 1000
            )}`;
            const parcRes = await client.query(
              `INSERT INTO inventario_parcial (producto_id, cantidad_restante, codigo_referencia)
                VALUES ($1, $2, $3) RETURNING id`,
              [item.producto_id, remanente, codigoRef]
            );
            datosExtraObj.created_parcial_id = parcRes.rows[0].id;
          } else {
            let stockARestar = item.cantidad;
            let remanente = 0;

            if (esLiquido && capacidad > 0) {
              costoSnapshot = costoSnapshot / capacidad;
              const botellas = Math.ceil(item.cantidad / capacidad);
              stockARestar = botellas;
              remanente = botellas * capacidad - item.cantidad;
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
              datosExtraObj.created_parcial_id = parcRes.rows[0].id;
            }
          }
        }
      }

      if (esLiquido) {
        datosExtraObj.unidad_medida =
          unidadMedida || datosExtraObj.descripcion_unidad;
        datosExtraObj.es_liquido = true;
      }

      const datosExtraJson = JSON.stringify(datosExtraObj);

      await client.query(
        `INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal, datos_extra)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          item.producto_id,
          item.cantidad,
          item.precio,
          costoSnapshot,
          item.cantidad * item.precio,
          datosExtraJson,
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
