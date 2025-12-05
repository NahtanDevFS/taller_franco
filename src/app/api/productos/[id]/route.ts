import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = Promise<{ id: string }>;

//PUT
export async function PUT(request: Request, { params }: { params: Params }) {
  const client = await pool.connect();

  try {
    const body = await request.json();
    const { id } = await params;
    const {
      nombre,
      codigo_barras,
      precio,
      stock,
      stock_minimo,
      marca_id,
      nueva_marca_nombre,
      categoria_id,
      es_bateria,
    } = body;

    //limpieza de datos
    const finalCodigo =
      codigo_barras && codigo_barras.trim() !== "" ? codigo_barras : null;
    const finalCategoriaId =
      categoria_id && categoria_id !== "" ? parseInt(categoria_id) : null;
    let finalMarcaId = marca_id && marca_id !== "" ? parseInt(marca_id) : null;

    await client.query("BEGIN");

    //si se quiere crear una marca durante la edición
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
        nombre = $1, 
        codigo_barras = $2, 
        precio = $3, 
        stock = $4, 
        stock_minimo = $5, 
        marca_id = $6, 
        categoria_id = $7,
        es_bateria = $8
      WHERE id = $9
      RETURNING *
    `;

    const res = await client.query(sql, [
      nombre,
      finalCodigo,
      precio,
      stock,
      stock_minimo,
      finalMarcaId,
      finalCategoriaId,
      es_bateria || false,
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
  try {
    const { id } = await params;
    //si el producto ya tiene ventas asociadas, esto fallará por la Foreign Key, eso es bueno para mantener la integridad de los datos históricos.
    await pool.query("DELETE FROM productos WHERE id = $1", [id]);

    return NextResponse.json({ message: "Producto eliminado" });
  } catch (error: any) {
    // Código 23503 es violación de Foreign Key en postgres (tiene ventas)
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
