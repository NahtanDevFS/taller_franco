import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ id: string }>;

//GET
export async function GET(request: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;

    const sql = `
      SELECT 
        id, codigo_barras, nombre, descripcion, precio, costo, stock, stock_minimo,
        categoria_id, marca_id, url_imagen, tipo, created_at, updated_at,
        permite_fraccion, requiere_serial, tiene_garantia, atributos,
        
        permite_fraccion as es_liquido,
        tiene_garantia as es_bateria,
        COALESCE((atributos->>'capacidad')::numeric, 1) as capacidad,
        COALESCE(atributos->>'unidad_medida', 'Unidades') as unidad_medida
      FROM productos 
      WHERE id = $1
    `;

    const res = await pool.query(sql, [id]);

    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

//PUT
export async function PUT(request: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await pool.connect();

  try {
    const body = await request.json();
    const { id } = await params;
    const {
      nombre,
      codigo_barras,
      precio,
      costo,
      stock,
      stock_minimo,
      marca_id,
      nueva_marca_nombre,
      categoria_id,
      permite_fraccion,
      requiere_serial,
      tiene_garantia,
      atributos,
    } = body;

    const finalAtributos = atributos || {};

    const finalCodigo =
      codigo_barras && codigo_barras.trim() !== "" ? codigo_barras : null;

    const finalCategoriaId =
      categoria_id && categoria_id !== "" ? parseInt(categoria_id) : null;

    let finalMarcaId = marca_id && marca_id !== "" ? parseInt(marca_id) : null;

    await client.query("BEGIN");

    if (nueva_marca_nombre && nueva_marca_nombre.trim() !== "") {
      const checkMarca = await client.query(
        "SELECT id FROM marcas WHERE nombre = $1",
        [nueva_marca_nombre]
      );
      if (checkMarca.rows.length > 0) {
        finalMarcaId = checkMarca.rows[0].id;
      } else {
        const marcaRes = await client.query(
          "INSERT INTO marcas (nombre) VALUES ($1) RETURNING id",
          [nueva_marca_nombre]
        );
        finalMarcaId = marcaRes.rows[0].id;
      }
    }

    const sql = `
      UPDATE productos 
      SET 
        nombre = $1, codigo_barras = $2, precio = $3, costo = $4, stock = $5, stock_minimo = $6, 
        marca_id = $7, categoria_id = $8, 
        permite_fraccion = $9, requiere_serial = $10, tiene_garantia = $11, atributos = $12
      WHERE id = $13
      RETURNING *
    `;

    const res = await client.query(sql, [
      nombre,
      finalCodigo,
      precio,
      costo || 0,
      stock,
      stock_minimo,
      finalMarcaId,
      finalCategoriaId,
      permite_fraccion ?? false,
      requiere_serial ?? false,
      tiene_garantia ?? false,
      JSON.stringify(finalAtributos),
      id,
    ]);

    if (res.rowCount === 0) {
      throw new Error("Producto no encontrado");
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

//DELETE
export async function DELETE(request: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    //si el producto ya tiene ventas asociadas, esto fallará por la foreign key, para mantener la integridad de los datos históricos
    await pool.query("DELETE FROM productos WHERE id = $1", [id]);

    return NextResponse.json({ message: "Producto eliminado" });
  } catch (error: any) {
    //código 23503 es violación de Foreign Key en postgres (tiene ventas)
    if (error.code === "23503") {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar: Este producto ya tiene historial de ventas",
        },
        { status: 409 } //este status corresponde a un conflicto
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
