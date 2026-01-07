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

  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");

  if (!startDateStr || !endDateStr) {
    return NextResponse.json({ error: "Fechas requeridas" }, { status: 400 });
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  try {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let truncType = "day";

    if (diffDays <= 2) {
      truncType = "hour";
    } else if (diffDays <= 90) {
      truncType = "day";
    } else {
      truncType = "month";
    }

    const sql = `
      SELECT 
        date_trunc($1, fecha_venta AT TIME ZONE 'America/Guatemala') as fecha, 
        SUM(total) as total 
      FROM ventas 
      WHERE estado = 'completada' 
      AND fecha_venta AT TIME ZONE 'America/Guatemala' >= $2::date 
      AND fecha_venta AT TIME ZONE 'America/Guatemala' < ($3::date + 1)
      GROUP BY fecha 
      ORDER BY fecha ASC
    `;

    const res = await pool.query(sql, [truncType, startDateStr, endDateStr]);

    const data = res.rows.map((row) => ({
      name: formatLabel(new Date(row.fecha), truncType),
      total: parseFloat(row.total),
      date: row.fecha,
    }));

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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

  return date.toLocaleDateString("es-GT", {
    ...options,
    weekday: "short",
    day: "numeric",
  });
}
