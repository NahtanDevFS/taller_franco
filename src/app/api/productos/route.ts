import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  //si piden "all_batteries", devolvemos lista simple para el Select
  const allBatteries = searchParams.get("type") === "all_batteries";

  if (allBatteries) {
    try {
      const res = await pool.query(
        "SELECT id, nombre, precio, stock FROM productos WHERE es_bateria = true ORDER BY nombre ASC"
      );
      return NextResponse.json(res.rows);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const page = parseInt(searchParams.get("page") || "1");
  const search = searchParams.get("q") || "";
  const categoriaId = searchParams.get("cat") || "";
  const marcaId = searchParams.get("marca") || "";
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    let whereClauses = [];
    let values = [];
    let paramCounter = 1;

    if (search) {
      whereClauses.push(`p.nombre ILIKE $${paramCounter}`);
      values.push(`%${search}%`);
      paramCounter++;
    }
    if (categoriaId) {
      whereClauses.push(`p.categoria_id = $${paramCounter}`);
      values.push(categoriaId);
      paramCounter++;
    }
    if (marcaId) {
      whereClauses.push(`p.marca_id = $${paramCounter}`);
      values.push(marcaId);
      paramCounter++;
    }

    const whereString =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const sql = `
      SELECT p.*, m.nombre as marca_nombre, c.nombre as categoria_nombre 
      FROM productos p
      LEFT JOIN marcas m ON p.marca_id = m.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      ${whereString}
      ORDER BY p.created_at DESC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `;

    const countSql = `SELECT COUNT(*) FROM productos p ${whereString}`;

    const queryValues = [...values, limit, offset];
    const countValues = [...values];

    const [productosRes, countRes] = await Promise.all([
      pool.query(sql, queryValues),
      pool.query(countSql, countValues),
    ]);

    return NextResponse.json({
      data: productosRes.rows,
      total: parseInt(countRes.rows[0].count),
      page,
      totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
    });
  } catch (error: any) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

//helper para usar query
async function query(text: string, params: any[]) {
  return pool.query(text, params);
}

export async function POST(request: Request) {
  const client = await pool.connect();

  try {
    const body = await request.json();
    console.log("Datos recibidos:", body);

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

    //limpiar código de barras: si es "", lo volvemos NULL para no romper la restricción UNIQUE
    const finalCodigo =
      codigo_barras && codigo_barras.trim() !== "" ? codigo_barras : null;

    //limpiar categoría si es "", lo volvemos NULL para no romper el tipo INT
    const finalCategoriaId =
      categoria_id && categoria_id !== "" ? parseInt(categoria_id) : null;

    //definir marca ID inicial y si viene marca_id lo convertimos a entero, si no, null
    let finalMarcaId = marca_id && marca_id !== "" ? parseInt(marca_id) : null;

    await client.query("BEGIN");

    //lógica para agregar una nueva marca
    if (nueva_marca_nombre && nueva_marca_nombre.trim() !== "") {
      //verificar si ya existe para no duplicar por error
      const checkMarca = await client.query(
        "SELECT id FROM marcas WHERE nombre = $1",
        [nueva_marca_nombre]
      );

      if (checkMarca.rows.length > 0) {
        //si ya existe usamos esa
        finalMarcaId = checkMarca.rows[0].id;
      } else {
        //si no existe, la creamos
        const marcaRes = await client.query(
          "INSERT INTO marcas (nombre) VALUES ($1) RETURNING id",
          [nueva_marca_nombre]
        );
        finalMarcaId = marcaRes.rows[0].id;
      }
    }

    //query para insertar el producto
    const insertSql = `
      INSERT INTO productos 
      (nombre, codigo_barras, precio, stock, stock_minimo, marca_id, categoria_id, es_bateria)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const res = await client.query(insertSql, [
      nombre,
      finalCodigo,
      precio,
      stock,
      stock_minimo,
      finalMarcaId,
      finalCategoriaId,
      es_bateria || false,
    ]);

    await client.query("COMMIT");

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("ERROR SQL:", error);
    return NextResponse.json(
      { error: error.message || "Error al guardar producto" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
