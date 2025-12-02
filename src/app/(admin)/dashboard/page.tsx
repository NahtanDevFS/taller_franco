"use client";
import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatoQuetzal } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  Package,
  AlertTriangle,
  Calendar,
} from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartFilter, setChartFilter] = useState("week"); // week, month, year

  //Este useEffect carga los KPIs y tablas
  useEffect(() => {
    fetch("/api/dashboard/summary")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error(err));
  }, []);

  //cargar gráfica cuando cambie el filtro
  useEffect(() => {
    fetch(`/api/dashboard/chart?range=${chartFilter}`)
      .then((res) => res.json())
      .then((data) => setChartData(data))
      .catch((err) => console.error(err));
  }, [chartFilter]);

  if (!stats) return <div style={{ padding: 20 }}>Cargando Dashboard...</div>;
  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ color: "var(--color-secondary)", marginBottom: 20 }}>
        Dashboard general
      </h1>

      {/* sección de los KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 20,
          marginBottom: 30,
        }}
      >
        <KpiCard
          title="Ventas de Hoy"
          value={formatoQuetzal.format(stats.ventasHoy)}
          icon={<DollarSign size={24} color="white" />}
          color="var(--color-primary)"
        />

        <KpiCard
          title="Ventas del Mes"
          value={formatoQuetzal.format(stats.ventasMes)}
          icon={<TrendingUp size={24} color="white" />}
          color="#10b981"
        />

        <KpiCard
          title="Valor Inventario"
          value={formatoQuetzal.format(stats.inventarioTotal)}
          icon={<Package size={24} color="white" />}
          color="#3b82f6" // Azul
        />
      </div>

      {/* sección de la gráfica de ventas*/}
      <div
        style={{
          background: "white",
          padding: 20,
          borderRadius: 8,
          boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
          marginBottom: 30,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: 0, color: "var(--color-secondary)" }}>
            Tendencia de Ventas
          </h3>
          <select
            value={chartFilter}
            onChange={(e) => setChartFilter(e.target.value)}
            style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
          >
            <option value="day">Hoy (Por horas)</option>
            <option value="week">Última Semana</option>
            <option value="month">Este Mes</option>
            <option value="year">Este Año</option>
          </select>
        </div>

        <div style={{ height: 300, width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(val) => `Q${val}`}
              />
              <Tooltip
                formatter={(value: number) => formatoQuetzal.format(value)}
              />
              <Bar
                dataKey="total"
                fill="var(--color-secondary)"
                radius={[4, 4, 0, 0]}
              >
                {/* Truco visual: La barra actual de otro color */}
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      index === chartData.length - 1
                        ? "var(--color-primary)"
                        : "var(--color-secondary)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/*sección de tablas inferiores del la gráfica */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 20,
        }}
      >
        {/* sección de bajo stock */}
        <div
          style={{
            background: "white",
            padding: 20,
            borderRadius: 8,
            boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 15,
            }}
          >
            <AlertTriangle color="#ef4444" />
            <h3 style={{ margin: 0, color: "#ef4444" }}>
              Alerta de Stock Bajo
            </h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.9rem",
              }}
            >
              <thead>
                <tr style={{ background: "#fef2f2", color: "#991b1b" }}>
                  <th style={{ padding: 8, textAlign: "left" }}>Producto</th>
                  <th style={{ padding: 8, textAlign: "left" }}>Marca</th>
                  <th style={{ padding: 8, textAlign: "center" }}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {stats.bajoStock.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      style={{ padding: 10, textAlign: "center" }}
                    >
                      Todo en orden
                    </td>
                  </tr>
                ) : (
                  stats.bajoStock.map((p: any) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: 8 }}>{p.nombre}</td>
                      <td style={{ padding: 8 }}>{p.marca || "-"}</td>
                      <td
                        style={{
                          padding: 8,
                          textAlign: "center",
                          fontWeight: "bold",
                          color: "#ef4444",
                        }}
                      >
                        {p.stock} / {p.stock_minimo}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* sección de top 5 productos vendidos */}
        <div
          style={{
            background: "white",
            padding: 20,
            borderRadius: 8,
            boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 15,
            }}
          >
            <Package color="var(--color-secondary)" />
            <h3 style={{ margin: 0, color: "var(--color-secondary)" }}>
              Top 5 Más Vendidos (Mes)
            </h3>
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.9rem",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#f0f9ff",
                  color: "var(--color-secondary)",
                }}
              >
                <th style={{ padding: 8, textAlign: "left" }}>Producto</th>
                <th style={{ padding: 8, textAlign: "right" }}>
                  Cant. Vendida
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.topProductos.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ padding: 10, textAlign: "center" }}>
                    Sin ventas este mes
                  </td>
                </tr>
              ) : (
                stats.topProductos.map((p: any, i: number) => (
                  <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: 8 }}>
                      <span
                        style={{
                          fontWeight: "bold",
                          marginRight: 10,
                          color: "#64748b",
                        }}
                      >
                        #{i + 1}
                      </span>
                      {p.nombre}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        textAlign: "right",
                        fontWeight: "bold",
                      }}
                    >
                      {p.cantidad_vendida}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Componente para las cards
function KpiCard({ title, value, icon, color }: any) {
  return (
    <div
      style={{
        background: "white",
        padding: 20,
        borderRadius: 8,
        boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
        display: "flex",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div
        style={{
          background: color,
          padding: 15,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
          {title}
        </p>
        <h2
          style={{
            margin: "5px 0 0 0",
            fontSize: "1.5rem",
            color: "var(--color-text)",
          }}
        >
          {value}
        </h2>
      </div>
    </div>
  );
}
