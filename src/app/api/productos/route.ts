import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);

  if (searchParams.get("type") === "all_batteries") {
    try {
      const sql = `
        SELECT 
            p.id, p.nombre, p.precio, 
            (SELECT COUNT(*)::int FROM existencias_serializadas es WHERE es.producto_id = p.id AND es.estado = 'disponible') as stock
        FROM productos p 
        WHERE requiere_serial = true OR tiene_garantia = true 
        ORDER BY p.nombre ASC
      `;
      const res = await pool.query(sql);
      return NextResponse.json(res.rows);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const page = parseInt(searchParams.get("page") || "1");
  const search = searchParams.get("q") || "";
  const categoriaId = searchParams.get("cat") || "";
  const marcaId = searchParams.get("marca") || "";
  const lowStock = searchParams.get("lowStock") === "true";
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    let whereConditions = [];
    let queryParams = [];

    if (search) {
      whereConditions.push(
        `(p.nombre ILIKE $param_ph OR p.codigo_barras ILIKE $param_ph)`
      );
      queryParams.push(`%${search}%`);
      queryParams.push(`%${search}%`);
    }

    if (categoriaId) {
      whereConditions.push(`p.categoria_id = $param_ph`);
      queryParams.push(categoriaId);
    }

    if (marcaId) {
      whereConditions.push(`p.marca_id = $param_ph`);
      queryParams.push(marcaId);
    }

    const whereString =
      whereConditions.length > 0 ? `AND ${whereConditions.join(" AND ")}` : "";

    const dynamicStockLogic = `
      CASE 
        WHEN p.requiere_serial = true THEN 
          (SELECT COUNT(*) FROM existencias_serializadas es WHERE es.producto_id = p.id AND es.estado = 'disponible')
        ELSE p.stock 
      END
    `;

    const commonColumns = `
      p.id,
      p.costo, 
      p.stock_minimo, p.marca_id, p.categoria_id, p.tipo,
      p.permite_fraccion, 
      p.requiere_serial, 
      p.tiene_garantia, 
      p.atributos,
      
      p.permite_fraccion as es_liquido,
      p.requiere_serial as es_bateria,
      
      COALESCE((p.atributos->>'capacidad')::numeric, 1) as capacidad,
      COALESCE(p.atributos->>'unidad_medida', 'Unidades') as unidad_medida,

      m.nombre as marca_nombre, c.nombre as categoria_nombre
    `;

    let paramCounter = 1;

    const whereProducts = whereString.replace(
      /\$param_ph/g,
      () => `$${paramCounter++}`
    );

    const wherePartials = whereString.replace(
      /\$param_ph/g,
      () => `$${paramCounter++}`
    );

    const allValues = [...queryParams, ...queryParams, limit, offset];

    const outerWhere = lowStock
      ? "WHERE unificados.stock <= unificados.stock_minimo"
      : "";

    const mainSql = `
      SELECT * FROM (
        SELECT 
          p.id, 
          p.nombre, 
          p.codigo_barras, 
          p.precio, 
          (${dynamicStockLogic}) as stock,
          ${commonColumns},
          'catalogo' as origen, 
          NULL::int as parcial_id,
          p.created_at as fecha_orden
        FROM productos p
        LEFT JOIN marcas m ON p.marca_id = m.id
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.tipo = 'producto' 
        ${whereProducts}

        UNION ALL

        SELECT 
          p.id, 
          ('[ABIERTO] ' || p.nombre) as nombre, 
          ip.codigo_referencia as codigo_barras, 
          p.precio, 
          ip.cantidad_restante as stock, 
          ${commonColumns},
          'parcial' as origen, 
          ip.id as parcial_id,
          ip.created_at as fecha_orden
        FROM inventario_parcial ip
        JOIN productos p ON ip.producto_id = p.id
        LEFT JOIN marcas m ON p.marca_id = m.id
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE ip.activo = true 
        AND ip.cantidad_restante > 0
        ${wherePartials}
      ) AS unificados
       ${outerWhere}
      ORDER BY fecha_orden DESC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `;

    const countValues = [...queryParams, ...queryParams];

    let countParamCounter = 1;
    const countWhereProd = whereString.replace(
      /\$param_ph/g,
      () => `$${countParamCounter++}`
    );
    const countWherePart = whereString.replace(
      /\$param_ph/g,
      () => `$${countParamCounter++}`
    );

    const lowStockCondProd = lowStock
      ? `AND (${dynamicStockLogic}) <= p.stock_minimo`
      : "";
    const lowStockCondPart = lowStock
      ? `AND ip.cantidad_restante <= p.stock_minimo`
      : "";

    const countSql = `
      SELECT COUNT(*) as total FROM (
        SELECT p.id FROM productos p WHERE p.tipo = 'producto' ${countWhereProd}
        UNION ALL
        SELECT ip.id FROM inventario_parcial ip 
        JOIN productos p ON ip.producto_id = p.id 
        WHERE ip.activo = true AND ip.cantidad_restante > 0 ${countWherePart} ${lowStockCondPart}
      ) as total_rows
    `;

    const [dataRes, countRes] = await Promise.all([
      pool.query(mainSql, allValues),
      pool.query(countSql, countValues),
    ]);

    const dataLimpia = dataRes.rows.map((p) => ({
      ...p,
      stock: parseFloat(p.stock) || 0,
      precio: parseFloat(p.precio) || 0,
      costo: parseFloat(p.costo) || 0,
      capacidad: parseFloat(p.capacidad),
    }));

    return NextResponse.json({
      data: dataLimpia,
      total: parseInt(countRes.rows[0].total),
      page,
      totalPages: Math.ceil(parseInt(countRes.rows[0].total) / limit),
    });
  } catch (error: any) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

interface ProductBody {
  nombre: string;
  codigo_barras?: string;
  precio: number | string;
  costo?: number | string;
  stock: number | string;
  stock_minimo: number | string;
  marca_id?: string | number;
  nueva_marca_nombre?: string;
  categoria_id?: string | number;
  permite_fraccion?: boolean;
  requiere_serial?: boolean;
  tiene_garantia?: boolean;
  atributos?: any;
  //legacy
  es_bateria?: boolean;
  es_liquido?: boolean;
  capacidad?: string | number;
  unidad_medida?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await pool.connect();

  try {
    const body: ProductBody = await request.json();

    const productData = normalizeProductInput(body);

    await client.query("BEGIN");

    const finalMarcaId = await resolveMarcaId(
      client,
      productData.marca_id,
      body.nueva_marca_nombre
    );

    const insertSql = `
      INSERT INTO productos 
      (nombre, codigo_barras, precio, costo, stock, stock_minimo, marca_id, categoria_id, 
       permite_fraccion, requiere_serial, tiene_garantia, atributos)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const res = await client.query(insertSql, [
      productData.nombre,
      productData.codigo_barras,
      productData.precio,
      productData.costo,
      productData.stock,
      productData.stock_minimo,
      finalMarcaId,
      productData.categoria_id,
      productData.permite_fraccion,
      productData.requiere_serial,
      productData.tiene_garantia,
      JSON.stringify(productData.atributos),
    ]);

    await client.query("COMMIT");

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("ERROR SQL EN POST PRODUCTO:", error);
    return NextResponse.json(
      { error: error.message || "Error al guardar producto" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

function normalizeProductInput(body: ProductBody) {
  const permite_fraccion = body.permite_fraccion ?? body.es_liquido ?? false;
  const tiene_garantia = body.tiene_garantia ?? body.es_bateria ?? false;
  const requiere_serial = body.requiere_serial ?? false;

  let atributos = body.atributos || {};

  if (!body.atributos) {
    if (body.capacidad)
      atributos.capacidad = parseFloat(body.capacidad.toString());
    if (body.unidad_medida) atributos.unidad_medida = body.unidad_medida;
    if (body.es_bateria) atributos.tipo_legacy = "bateria";
  }

  return {
    nombre: body.nombre,
    codigo_barras: body.codigo_barras?.trim() ? body.codigo_barras : null,
    precio: body.precio,
    costo: body.costo ? parseFloat(body.costo.toString()) : 0,
    stock: body.stock,
    stock_minimo: body.stock_minimo,
    categoria_id: body.categoria_id
      ? parseInt(body.categoria_id.toString())
      : null,
    marca_id: body.marca_id ? parseInt(body.marca_id.toString()) : null,
    permite_fraccion,
    requiere_serial,
    tiene_garantia,
    atributos,
  };
}

async function resolveMarcaId(
  client: any,
  marcaId: number | null,
  nuevaMarcaNombre?: string
): Promise<number | null> {
  if (!nuevaMarcaNombre?.trim()) {
    return marcaId;
  }

  const nombreNormalizado = nuevaMarcaNombre.trim();

  const checkMarca = await client.query(
    "SELECT id FROM marcas WHERE nombre = $1",
    [nombreNormalizado]
  );

  if (checkMarca.rows.length > 0) {
    return checkMarca.rows[0].id;
  }

  const marcaRes = await client.query(
    "INSERT INTO marcas (nombre) VALUES ($1) RETURNING id",
    [nombreNormalizado]
  );

  return marcaRes.rows[0].id;
}
