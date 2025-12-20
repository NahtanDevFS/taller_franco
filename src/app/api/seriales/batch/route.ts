import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

interface BatchBody {
  producto_id: number;
  seriales: string[];
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await pool.connect();

  try {
    const { producto_id, seriales }: BatchBody = await request.json();

    if (!producto_id || !seriales || seriales.length === 0) {
      return NextResponse.json(
        { error: "Faltan datos o la lista de seriales está vacía" },
        { status: 400 }
      );
    }

    const serialesLimpios = seriales
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const serialesUnicos = [...new Set(serialesLimpios)];

    await client.query("BEGIN");

    const prodCheck = await client.query(
      "SELECT id, nombre, requiere_serial FROM productos WHERE id = $1",
      [producto_id]
    );

    if (prodCheck.rows.length === 0) {
      throw new Error("El producto seleccionado no existe");
    }
    if (!prodCheck.rows[0].requiere_serial) {
      throw new Error(
        "Este producto no está configurado para manejar seriales"
      );
    }

    const placeholders = serialesUnicos.map((_, i) => `$${i + 1}`).join(",");
    const existingCheck = await client.query(
      `SELECT serial FROM existencias_serializadas WHERE serial IN (${placeholders})`,
      serialesUnicos
    );

    const existentesSet = new Set(existingCheck.rows.map((r) => r.serial));

    const nuevosSeriales = serialesUnicos.filter((s) => !existentesSet.has(s));

    if (nuevosSeriales.length > 0) {
      const values: any[] = [producto_id];
      const valueClauses = nuevosSeriales.map((serial, index) => {
        values.push(serial);
        return `($1, $${index + 2}, 'disponible')`;
      });

      const insertSql = `
        INSERT INTO existencias_serializadas (producto_id, serial, estado)
        VALUES ${valueClauses.join(", ")}
      `;

      await client.query(insertSql, values);
    }

    await client.query("COMMIT");

    return NextResponse.json({
      message: "Proceso completado",
      agregados: nuevosSeriales.length,
      omitidos: existentesSet.size,
      detalle_omitidos: Array.from(existentesSet),
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error en batch upload:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar seriales" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
