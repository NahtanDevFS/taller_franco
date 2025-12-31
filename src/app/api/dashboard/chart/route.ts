import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  //recibir fechas del filtro global
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");

  if (!startDateStr || !endDateStr) {
    return NextResponse.json({ error: "Fechas requeridas" }, { status: 400 });
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  try {
    //calcular la diferencia en días para decidir la agrupación
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let truncType = "day"; //por defecto

    //lógica dinámica de agrupación
    if (diffDays <= 2) {
      //si el rango es de 1 o 2 días, mostramos detalle por hora
      truncType = "hour";
    } else if (diffDays <= 90) {
      //hasta 3 meses, mostramos por día
      truncType = "day";
    } else {
      //más de 3 meses, mostramos por mes para no saturar la gráfica
      truncType = "month";
    }

    const sql = `
      SELECT 
        date_trunc($1, fecha_venta) as fecha, 
        SUM(total) as total 
      FROM ventas 
      WHERE estado = 'completada' 
      AND fecha_venta >= $2 AND fecha_venta <= $3
      GROUP BY fecha 
      ORDER BY fecha ASC
    `;

    const res = await pool.query(sql, [truncType, startDateStr, endDateStr]);

    //formatear datos para Recharts
    const data = res.rows.map((row) => ({
      name: formatLabel(new Date(row.fecha), truncType),
      total: parseFloat(row.total),
      date: row.fecha, //guardamos la fecha original por si acaso
    }));

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

//helper para etiquetas bonitas
function formatLabel(date: Date, type: string) {
  const options: Intl.DateTimeFormatOptions = { timeZone: "America/Guatemala" };

  if (type === "hour") {
    return date.toLocaleTimeString("es-GT", {
      ...options,
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (type === "month") {
    return date.toLocaleDateString("es-GT", {
      ...options,
      month: "long",
      year: "2-digit",
    });
  }

  //para días
  return date.toLocaleDateString("es-GT", {
    ...options,
    weekday: "short",
    day: "numeric",
  });
}
