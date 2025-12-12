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
import { DollarSign, TrendingUp, Package, AlertTriangle } from "lucide-react";
import styles from "@/app/(admin)/dashboard/dashboard.module.css";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartFilter, setChartFilter] = useState("week"); //week, month, year

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

  if (!stats)
    return <div className={styles.container}>Cargando Dashboard...</div>;
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Dashboard general</h1>

      {/*sección de los KPIs*/}
      <div className={styles.kpiGrid}>
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
          color="#3b82f6"
        />
      </div>

      {/*sección de la gráfica de ventas*/}
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>Tendencia de Ventas</h3>
          <select
            value={chartFilter}
            onChange={(e) => setChartFilter(e.target.value)}
            className={styles.selectInput}
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

      {/*sección de tablas inferiores del la gráfica*/}
      <div className={styles.tablesGrid}>
        {/*sección de bajo stock*/}
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
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

        {/*sección de top 5 productos vendidos*/}
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
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

//componente para las cards
function KpiCard({ title, value, icon, color }: any) {
  return (
    <div className={styles.kpiCard}>
      <div
        className={styles.kpiIconWrapper}
        style={{
          background: color,
        }}
      >
        {icon}
      </div>
      <div>
        <p className={styles.kpiTitle}>{title}</p>
        <h2 className={styles.kpiValue}>{value}</h2>
      </div>
    </div>
  );
}
