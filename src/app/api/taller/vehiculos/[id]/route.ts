import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sqlVehiculo = `
      SELECT v.*, 
             c.nombre as cliente_nombre, 
             c.telefono as cliente_telefono,
             c.id as cliente_id
      FROM vehiculos v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      WHERE v.id = $1
    `;

    const sqlHistorial = `
      SELECT 
        o.id, 
        o.fecha_ingreso, 
        o.kilometraje_actual, 
        o.estado, 
        o.notas_generales,
        COALESCE(
          (SELECT STRING_AGG(d.servicio_realizado, ', ') 
           FROM detalle_orden_servicio d 
           WHERE d.orden_id = o.id), 
           'Sin detalles registrados'
        ) as resumen_trabajos
      FROM ordenes_servicio o
      WHERE o.vehiculo_id = $1 AND o.estado != 'cancelado'
      ORDER BY o.fecha_ingreso DESC
    `;

    const [resVehiculo, resHistorial] = await Promise.all([
      pool.query(sqlVehiculo, [id]),
      pool.query(sqlHistorial, [id]),
    ]);

    if (resVehiculo.rows.length === 0) {
      return NextResponse.json(
        { error: "Vehículo no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      vehiculo: resVehiculo.rows[0],
      historial: resHistorial.rows,
    });
  } catch (error: any) {
    console.error("Error fetching vehiculo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await pool.connect();

  try {
    const body = await request.json();
    await client.query("BEGIN");

    let finalClienteId = body.cliente_id;

    if (finalClienteId && body.actualizar_telefono && body.telefono_nuevo) {
      const nuevoTel = body.telefono_nuevo.trim();

      const checkTel = await client.query(
        "SELECT id FROM clientes WHERE telefono = $1 AND id != $2",
        [nuevoTel, finalClienteId]
      );

      if (checkTel.rows.length > 0) {
        throw new Error(`El teléfono ${nuevoTel} ya pertenece a otro cliente.`);
      }

      await client.query("UPDATE clientes SET telefono = $1 WHERE id = $2", [
        nuevoTel,
        finalClienteId,
      ]);
    }

    if (!finalClienteId && body.nuevo_cliente_nombre) {
      if (body.nuevo_cliente_telefono) {
        const checkTelNuevo = await client.query(
          "SELECT id FROM clientes WHERE telefono = $1",
          [body.nuevo_cliente_telefono.trim()]
        );
        if (checkTelNuevo.rows.length > 0) {
          throw new Error(
            `El teléfono ${body.nuevo_cliente_telefono} ya existe en la base de datos.`
          );
        }
      }

      const insertClienteSql = `
        INSERT INTO clientes (nombre, telefono, nit_rfc)
        VALUES ($1, $2, $3)
        RETURNING id
      `;
      const resC = await client.query(insertClienteSql, [
        body.nuevo_cliente_nombre,
        body.nuevo_cliente_telefono || null,
        body.nuevo_cliente_nit || null,
      ]);
      finalClienteId = resC.rows[0].id;
    }

    const updates = [];
    const values = [];
    let counter = 1;

    if (body.placa) {
      updates.push(`placa = $${counter++}`);
      values.push(body.placa.toUpperCase());
    }
    if (body.marca) {
      updates.push(`marca = $${counter++}`);
      values.push(body.marca);
    }
    if (body.modelo) {
      updates.push(`modelo = $${counter++}`);
      values.push(body.modelo);
    }
    if (body.color) {
      updates.push(`color = $${counter++}`);
      values.push(body.color);
    }
    if (body.anio) {
      updates.push(`anio = $${counter++}`);
      values.push(body.anio ? parseInt(body.anio) : null);
    }
    if (body.vin) {
      updates.push(`vin = $${counter++}`);
      values.push(body.vin);
    }
    if (body.notas) {
      updates.push(`notas = $${counter++}`);
      values.push(body.notas);
    }

    if (finalClienteId) {
      updates.push(`cliente_id = $${counter++}`);
      values.push(finalClienteId);
    }

    if (body.activo !== undefined) {
      updates.push(`activo = $${counter++}`);
      values.push(body.activo);
    }

    if (updates.length > 0) {
      values.push(id);
      const sql = `
            UPDATE vehiculos 
            SET ${updates.join(", ")}, updated_at = NOW()
            WHERE id = $${counter}
            RETURNING *
        `;
      const res = await client.query(sql, values);
      await client.query("COMMIT");
      return NextResponse.json(res.rows[0]);
    } else {
      await client.query("COMMIT");
      return NextResponse.json({ message: "Datos actualizados" });
    }
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sql = `UPDATE vehiculos SET activo = false WHERE id = $1`;
    await pool.query(sql, [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
