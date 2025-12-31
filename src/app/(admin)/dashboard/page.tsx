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
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { formatoQuetzal } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  Package,
  AlertTriangle,
  Receipt,
  PieChart as PieIcon,
  Tag,
  Archive,
  Activity,
} from "lucide-react";
import styles from "@/app/(admin)/dashboard/dashboard.module.css";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartFilter, setChartFilter] = useState("week");
  const [bottomView, setBottomView] = useState<"operativo" | "estancado">(
    "operativo"
  );

  useEffect(() => {
    fetch("/api/dashboard/summary")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error(err));
  }, []);

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
      <h1 className={styles.title}>Dashboard General</h1>

      <div className={styles.kpiGrid}>
        <KpiCard
          title="Ventas de hoy"
          value={formatoQuetzal.format(stats.ventasHoy)}
          icon={<DollarSign size={24} color="white" />}
          color="var(--color-primary)"
        />
        <KpiCard
          title="Ventas del mes"
          value={formatoQuetzal.format(stats.ventasMes)}
          icon={<TrendingUp size={24} color="white" />}
          color="#10b981"
        />
        <KpiCard
          title="Ticket promedio (Mes)"
          value={formatoQuetzal.format(stats.ticketPromedio)}
          icon={<Receipt size={24} color="white" />}
          color="#8b5cf6"
        />
        <KpiCard
          title="Descuentos (Mes)"
          value={formatoQuetzal.format(stats.totalDescuentos)}
          icon={<Tag size={24} color="white" />}
          color="#f59e0b"
        />
        <KpiCard
          title="Valor inventario"
          value={formatoQuetzal.format(stats.inventarioTotal)}
          icon={<Package size={24} color="white" />}
          color="#3b82f6"
        />
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
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
          <div style={{ flex: 1, minHeight: 0 }}>
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

        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Ventas por Categoría (Mes)</h3>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {stats.ventasPorCategoria && stats.ventasPorCategoria.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.ventasPorCategoria}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.ventasPorCategoria.map(
                      (entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      )
                    )}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatoQuetzal.format(value)}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94a3b8",
                }}
              >
                No hay datos de categorías
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.sectionHeader}>
        <h3 className={styles.chartTitle}>Detalle de Inventario</h3>
        <div className={styles.toggleContainer}>
          <button
            className={`${styles.toggleBtn} ${
              bottomView === "operativo" ? styles.active : ""
            }`}
            onClick={() => setBottomView("operativo")}
          >
            <Activity
              size={14}
              style={{ marginRight: 5, verticalAlign: "text-bottom" }}
            />
            Operativo
          </button>
          <button
            className={`${styles.toggleBtn} ${
              bottomView === "estancado" ? styles.active : ""
            }`}
            onClick={() => setBottomView("estancado")}
          >
            <Archive
              size={14}
              style={{ marginRight: 5, verticalAlign: "text-bottom" }}
            />
            Sin movimiento
          </button>
        </div>
      </div>

      <div className={styles.tablesGrid}>
        {bottomView === "operativo" ? (
          <>
            <div className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <AlertTriangle color="#ef4444" />
                <h3 style={{ margin: 0, color: "#ef4444", fontSize: "1rem" }}>
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
                      <th style={{ padding: 12, textAlign: "left" }}>
                        Producto
                      </th>
                      <th style={{ padding: 12, textAlign: "left" }}>Marca</th>
                      <th style={{ padding: 12, textAlign: "center" }}>
                        Stock
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.bajoStock.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          style={{ padding: 15, textAlign: "center" }}
                        >
                          Todo en orden
                        </td>
                      </tr>
                    ) : (
                      stats.bajoStock.map((p: any) => (
                        <tr
                          key={p.id}
                          style={{ borderBottom: "1px solid #f1f5f9" }}
                        >
                          <td style={{ padding: 12 }}>{p.nombre}</td>
                          <td style={{ padding: 12 }}>{p.marca || "-"}</td>
                          <td
                            style={{
                              padding: 12,
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

            <div className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <Package color="var(--color-secondary)" />
                <h3
                  style={{
                    margin: 0,
                    color: "var(--color-secondary)",
                    fontSize: "1rem",
                  }}
                >
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
                    <th style={{ padding: 12, textAlign: "left" }}>Producto</th>
                    <th style={{ padding: 12, textAlign: "right" }}>
                      Cant. Vendida
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topProductos.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        style={{ padding: 15, textAlign: "center" }}
                      >
                        Sin ventas este mes
                      </td>
                    </tr>
                  ) : (
                    stats.topProductos.map((p: any, i: number) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: 12 }}>
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
                            padding: 12,
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
          </>
        ) : (
          <div className={`${styles.tableCard} ${styles.fullWidthTable}`}>
            <div className={styles.tableHeader}>
              <Archive color="#64748b" />
              <h3 style={{ margin: 0, color: "#475569", fontSize: "1rem" }}>
                Productos sin movimiento (+90 días sin ventas)
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
                  <tr style={{ background: "#f8fafc", color: "#475569" }}>
                    <th style={{ padding: 12, textAlign: "left" }}>Producto</th>
                    <th style={{ padding: 12, textAlign: "left" }}>Marca</th>
                    <th style={{ padding: 12, textAlign: "center" }}>
                      Stock Actual
                    </th>
                    <th style={{ padding: 12, textAlign: "right" }}>
                      Última Venta
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.productosSinMovimiento.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          padding: 20,
                          textAlign: "center",
                          color: "#64748b",
                        }}
                      >
                        ¡Excelente! No hay productos estancados.
                      </td>
                    </tr>
                  ) : (
                    stats.productosSinMovimiento.map((p: any) => (
                      <tr
                        key={p.id}
                        style={{ borderBottom: "1px solid #f1f5f9" }}
                      >
                        <td style={{ padding: 12 }}>{p.nombre}</td>
                        <td style={{ padding: 12 }}>{p.marca || "-"}</td>
                        <td
                          style={{
                            padding: 12,
                            textAlign: "center",
                            fontWeight: "bold",
                            color: "#f59e0b",
                          }}
                        >
                          {p.stock}
                        </td>
                        <td
                          style={{
                            padding: 12,
                            textAlign: "right",
                            color: "#64748b",
                          }}
                        >
                          {p.ultima_venta
                            ? new Date(p.ultima_venta).toLocaleDateString(
                                "es-GT"
                              )
                            : "Nunca vendido"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
