import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const search = searchParams.get("q") || ""; // Búsqueda por nombre
  const categoriaId = searchParams.get("cat") || ""; // Filtro Categoría
  const marcaId = searchParams.get("marca") || ""; // Filtro Marca
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    let whereClauses = [];
    let values = [];
    let paramCounter = 1;

    // Filtro por nombre (ILIKE es insensible a mayúsculas/minúsculas)
    if (search) {
      whereClauses.push(`p.nombre ILIKE $${paramCounter}`);
      values.push(`%${search}%`);
      paramCounter++;
    }

    // Filtro por categoría
    if (categoriaId) {
      whereClauses.push(`p.categoria_id = $${paramCounter}`);
      values.push(categoriaId);
      paramCounter++;
    }

    // filtro por marca
    if (marcaId) {
      whereClauses.push(`p.marca_id = $${paramCounter}`);
      values.push(marcaId);
      paramCounter++;
    }

    // Unir cláusulas (si hay filtros, agregamos 'WHERE ...', si no, string vacío)
    const whereString =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // query principal donde agregamos los parámetros de limit/offset al final del array de valores
    const sql = `
      SELECT p.*, m.nombre as marca_nombre, c.nombre as categoria_nombre 
      FROM productos p
      LEFT JOIN marcas m ON p.marca_id = m.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      ${whereString}
      ORDER BY p.created_at DESC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `;

    // consulta de conteo para paginación
    const countSql = `
      SELECT COUNT(*) 
      FROM productos p 
      ${whereString}
    `;

    // Ejecutamos ambas consultas
    // Para la principal necesitamos values + limit + offset
    const queryValues = [...values, limit, offset];

    // Para el count solo necesitamos los values de los filtros
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

// Helper para usar query
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
    } = body;

    // Limpiar Código de Barras: Si es "", lo volvemos NULL para no romper la restricción UNIQUE
    const finalCodigo =
      codigo_barras && codigo_barras.trim() !== "" ? codigo_barras : null;

    // Limpiar Categoría: Si es "", lo volvemos NULL para no romper el tipo INT
    const finalCategoriaId =
      categoria_id && categoria_id !== "" ? parseInt(categoria_id) : null;

    // Definir Marca ID inicial
    // Si viene marca_id lo convertimos a entero, si no, null
    let finalMarcaId = marca_id && marca_id !== "" ? parseInt(marca_id) : null;

    await client.query("BEGIN");

    // lógica para agregar una nueva marca
    if (nueva_marca_nombre && nueva_marca_nombre.trim() !== "") {
      // Verificar si ya existe para no duplicar por error
      const checkMarca = await client.query(
        "SELECT id FROM marcas WHERE nombre = $1",
        [nueva_marca_nombre]
      );

      if (checkMarca.rows.length > 0) {
        // Si ya existe usamos esa
        finalMarcaId = checkMarca.rows[0].id;
      } else {
        // Si no existe, la creamos
        const marcaRes = await client.query(
          "INSERT INTO marcas (nombre) VALUES ($1) RETURNING id",
          [nueva_marca_nombre]
        );
        finalMarcaId = marcaRes.rows[0].id;
      }
    }

    // query para insertar el producto
    const insertSql = `
      INSERT INTO productos 
      (nombre, codigo_barras, precio, stock, stock_minimo, marca_id, categoria_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const res = await client.query(insertSql, [
      nombre,
      finalCodigo, // Ahora es string o NULL
      precio,
      stock,
      stock_minimo,
      finalMarcaId, // Ahora es int o NULL
      finalCategoriaId, // Ahora es int o NULL
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
