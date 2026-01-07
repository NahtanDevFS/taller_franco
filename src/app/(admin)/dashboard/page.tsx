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
  Legend,
  PieChart,
  Pie,
} from "recharts";
import { formatoQuetzal } from "@/lib/utils";
import {
  DollarSign,
  Package,
  AlertTriangle,
  Receipt,
  Archive,
  Activity,
  TrendingUp,
  Wallet,
  Scale,
  Calendar,
} from "lucide-react";
import styles from "@/app/(admin)/dashboard/dashboard.module.css";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#00a2b8ff",
  "#00b83dff",
];

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [bottomView, setBottomView] = useState<"operativo" | "estancado">(
    "operativo"
  );

  const [dateRange, setDateRange] = useState({
    start: new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    ).toLocaleDateString("en-CA"),
    end: new Date().toLocaleDateString("en-CA"),
  });

  useEffect(() => {
    if (!dateRange.start || !dateRange.end) return;

    const queryParams = new URLSearchParams({
      startDate: dateRange.start,
      endDate: dateRange.end,
    }).toString();

    fetch(`/api/dashboard/summary?${queryParams}`)
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error(err));

    fetch(`/api/dashboard/chart?${queryParams}`)
      .then((res) => res.json())
      .then((data) => setChartData(data))
      .catch((err) => console.error(err));
  }, [dateRange]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateRange((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

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
          title="Valor Inventario"
          value={formatoQuetzal.format(stats.inventarioTotal)}
          icon={<Package size={24} color="white" />}
          color="#3b82f6"
        />
        <KpiCard
          title="Ticket Promedio (periodo)"
          value={formatoQuetzal.format(stats.ticketPromedio)}
          icon={<Receipt size={24} color="white" />}
          color="#8b5cf6"
        />
      </div>

      <div className={styles.financialSection}>
        <div className={styles.financialHeader}>
          <h3 className={styles.sectionTitleSmall}>Rentabilidad</h3>

          <div className={styles.dateFilterContainer}>
            <div className={styles.filterGroup}>
              <Calendar
                size={14}
                color="#64748b"
                className={styles.calendarIcon}
              />
              <span className={styles.dateLabel}>Desde:</span>
              <input
                type="date"
                name="start"
                value={dateRange.start}
                onChange={handleDateChange}
                className={styles.dateInput}
              />
            </div>

            <span className={styles.dateSeparator}>|</span>

            <div className={styles.filterGroup}>
              <span className={styles.dateLabel}>Hasta:</span>
              <input
                type="date"
                name="end"
                value={dateRange.end}
                onChange={handleDateChange}
                className={styles.dateInput}
              />
            </div>
          </div>
        </div>

        <div className={styles.financialGrid}>
          <div className={styles.financialCard}>
            <div className={styles.finHeader}>
              <span className={styles.finLabel}>Ingresos</span>
              <div className={styles.iconBox} style={{ background: "#d1fae5" }}>
                <TrendingUp size={16} color="#059669" />
              </div>
            </div>
            <div className={styles.finValue} style={{ color: "#059669" }}>
              {formatoQuetzal.format(stats.ventasMes)}
            </div>
            <div className={styles.finSubtext}>
              Desc: {formatoQuetzal.format(stats.totalDescuentos)}
            </div>
          </div>

          <div className={styles.financialCard}>
            <div className={styles.finHeader}>
              <span className={styles.finLabel}>Costos</span>
              <div className={styles.iconBox} style={{ background: "#fee2e2" }}>
                <Wallet size={16} color="#dc2626" />
              </div>
            </div>
            <div className={styles.finValue} style={{ color: "#dc2626" }}>
              - {formatoQuetzal.format(stats.costosMes)}
            </div>
            <div className={styles.finSubtext}>Costo mercadería</div>
          </div>

          <div className={styles.financialCard}>
            <div className={styles.finHeader}>
              <span className={styles.finLabel}>Impuestos (Est.)</span>
              <div className={styles.iconBox} style={{ background: "#fef3c7" }}>
                <Scale size={16} color="#d97706" />
              </div>
            </div>
            <div className={styles.finValue} style={{ color: "#d97706" }}>
              - {formatoQuetzal.format(stats.impuestosEstimados)}
            </div>
            <div className={styles.finSubtext}>5% SAT (Aprox)</div>
          </div>

          <div className={`${styles.financialCard} ${styles.netProfitCard}`}>
            <div className={styles.finHeader}>
              <span
                className={styles.finLabel}
                style={{ color: "rgba(255,255,255,0.9)" }}
              >
                Utilidad Neta
              </span>
              <div
                className={styles.iconBox}
                style={{ background: "rgba(255,255,255,0.2)" }}
              >
                <DollarSign size={16} color="white" />
              </div>
            </div>
            <div className={styles.finValue} style={{ color: "white" }}>
              {formatoQuetzal.format(stats.utilidadNeta)}
            </div>
            <div
              className={styles.finSubtext}
              style={{ color: "rgba(255,255,255,0.8)" }}
            >
              Margen Real: {stats.margenBeneficio}%
            </div>
          </div>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Tendencia de ingresos</h3>
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
            <h3 className={styles.chartTitle}>
              Ingresos por categoría (periodo)
            </h3>
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
            <Activity size={14} style={{ marginRight: 5 }} /> Operativo
          </button>
          <button
            className={`${styles.toggleBtn} ${
              bottomView === "estancado" ? styles.active : ""
            }`}
            onClick={() => setBottomView("estancado")}
          >
            <Archive size={14} style={{ marginRight: 5 }} /> Sin movimiento
          </button>
        </div>
      </div>

      <div className={styles.tablesGrid}>
        {bottomView === "operativo" ? (
          <>
            <div className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <AlertTriangle color="#ef4444" size={18} />
                <h3
                  style={{ margin: 0, color: "#ef4444", fontSize: "0.95rem" }}
                >
                  Alerta Stock Bajo
                </h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className={styles.compactTable}>
                  <thead>
                    <tr style={{ background: "#fef2f2", color: "#991b1b" }}>
                      <th>Producto</th>
                      <th>Marca</th>
                      <th style={{ textAlign: "center" }}>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.bajoStock.length === 0 ? (
                      <tr>
                        <td colSpan={3} className={styles.emptyCell}>
                          Todo en orden
                        </td>
                      </tr>
                    ) : (
                      stats.bajoStock.map((p: any) => (
                        <tr key={p.id}>
                          <td>{p.nombre}</td>
                          <td>{p.marca || "-"}</td>
                          <td
                            style={{
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
                <TrendingUp color="var(--color-secondary)" size={18} />
                <h3
                  style={{
                    margin: 0,
                    color: "var(--color-secondary)",
                    fontSize: "0.95rem",
                  }}
                >
                  Más Vendidos (Top 5)
                </h3>
              </div>
              <table className={styles.compactTable}>
                <thead>
                  <tr style={{ background: "#f0f9ff", color: "#0369a1" }}>
                    <th>Producto</th>
                    <th style={{ textAlign: "right" }}>Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topProductos.length === 0 ? (
                    <tr>
                      <td colSpan={2} className={styles.emptyCell}>
                        Sin ventas
                      </td>
                    </tr>
                  ) : (
                    stats.topProductos.map((p: any, i: number) => (
                      <tr key={i}>
                        <td>
                          <span
                            style={{
                              fontWeight: "bold",
                              marginRight: 8,
                              color: "#94a3b8",
                            }}
                          >
                            #{i + 1}
                          </span>
                          {p.nombre}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: "bold" }}>
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
          <div className={styles.tableCard} style={{ gridColumn: "1 / -1" }}>
            <div className={styles.tableHeader}>
              <Archive color="#64748b" size={18} />
              <h3 style={{ margin: 0, color: "#475569", fontSize: "1rem" }}>
                Productos sin movimiento (+90 días)
              </h3>
            </div>
            <table className={styles.compactTable}>
              <thead>
                <tr style={{ background: "#f8fafc", color: "#475569" }}>
                  <th>Producto</th>
                  <th>Marca</th>
                  <th style={{ textAlign: "center" }}>Stock</th>
                  <th style={{ textAlign: "right" }}>Última Venta</th>
                </tr>
              </thead>
              <tbody>
                {stats.productosSinMovimiento.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.emptyCell}>
                      No hay productos estancados
                    </td>
                  </tr>
                ) : (
                  stats.productosSinMovimiento.map((p: any) => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td>{p.marca}</td>
                      <td
                        style={{
                          textAlign: "center",
                          color: "#f59e0b",
                          fontWeight: "bold",
                        }}
                      >
                        {p.stock}
                      </td>
                      <td style={{ textAlign: "right", color: "#64748b" }}>
                        {p.ultima_venta
                          ? new Date(p.ultima_venta).toLocaleDateString()
                          : "Nunca"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, color }: any) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiIconWrapper} style={{ background: color }}>
        {icon}
      </div>
      <div>
        <p className={styles.kpiTitle}>{title}</p>
        <h2 className={styles.kpiValue}>{value}</h2>
      </div>
    </div>
  );
}
