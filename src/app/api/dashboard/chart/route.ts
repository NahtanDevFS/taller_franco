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
  const range = searchParams.get("range") || "week"; //day, week, month, year
  try {
    let truncType = "day"; //por defecto agrupar por día
    let interval = "INTERVAL '7 days'"; //por defecto última semana

    //lógica de filtros para postgresql
    switch (range) {
      case "day": // Ventas de hoy por hora
        truncType = "hour";
        interval = "INTERVAL '1 day'";
        break;
      case "week": // Últimos 7 días por día
        truncType = "day";
        interval = "INTERVAL '7 days'";
        break;
      case "month": // Este mes por día
        truncType = "day";
        interval = "INTERVAL '1 month'";
        break;
      case "year": // Este año por mes
        truncType = "month";
        interval = "INTERVAL '1 year'";
        break;
    }

    const sql = `
      SELECT 
        date_trunc($1, fecha_venta) as fecha, 
        SUM(total) as total 
      FROM ventas 
      WHERE estado = 'completada' 
      AND fecha_venta >= NOW() - ${interval}
      GROUP BY fecha 
      ORDER BY fecha ASC
    `;

    const res = await pool.query(sql, [truncType]);

    //formatear datos para Recharts
    const data = res.rows.map((row) => ({
      name: formatLabel(new Date(row.fecha), truncType),
      total: parseFloat(row.total),
    }));

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

//helper para que las etiquetas de la gráfica se vean bonitas
function formatLabel(date: Date, type: string) {
  const options: Intl.DateTimeFormatOptions = { timeZone: "America/Guatemala" };
  if (type === "hour")
    return date.toLocaleTimeString("es-GT", {
      ...options,
      hour: "2-digit",
      minute: "2-digit",
    });
  if (type === "month")
    return date.toLocaleDateString("es-GT", { ...options, month: "long" });
  return date.toLocaleDateString("es-GT", {
    ...options,
    weekday: "short",
    day: "numeric",
  });
}
