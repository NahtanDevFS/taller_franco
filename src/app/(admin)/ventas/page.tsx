"use client";
import { useState, useEffect } from "react";
import { formatoQuetzal } from "@/lib/utils";
import { Toaster, toast } from "sonner";
import Link from "next/link";
import {
  Eye,
  Ban,
  PlusCircle,
  ShoppingCart,
  Search,
  Trash2,
  Plus,
  Minus,
  Save,
  Filter,
  X,
  Banknote,
} from "lucide-react";
import styles from "../productos/productos.module.css";
import stylesHistorial from "./historialVentas.module.css";

export default function HistorialVentasPage() {
  const [ventas, setVentas] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Estados para filtros de fecha
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAnuladas, setShowAnuladas] = useState(false);

  // useStates para ver los modales
  const [selectedVenta, setSelectedVenta] = useState<any | null>(null);
  const [detallesVenta, setDetallesVenta] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Estados para agregar productos extra
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [itemsToAdd, setItemsToAdd] = useState<any[]>([]);

  // Función para cargar ventas con filtros
  const fetchVentas = async (p = page) => {
    const params = new URLSearchParams({
      page: p.toString(),
      startDate,
      endDate,
      showAnuladas: showAnuladas.toString(),
    });

    const res = await fetch(`/api/ventas?${params}`);
    const data = await res.json();
    if (data.data) {
      setVentas(data.data);
      setTotalPages(data.totalPages);
    }
  };

  // Recargar cuando cambia la página
  useEffect(() => {
    fetchVentas(page);
  }, [page]);

  // Recargar al cambiar el checkbox de anuladas (reseteando a pág 1)
  useEffect(() => {
    setPage(1);
    fetchVentas(1);
  }, [showAnuladas]);

  const handleFilter = () => {
    setPage(1); // Volver a la primera página al filtrar
    fetchVentas(1);
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setShowAnuladas(false);
    setPage(1);
    // Forzamos el fetch con valores vacíos
    fetch(`/api/ventas?page=1`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setVentas(data.data);
          setTotalPages(data.totalPages);
        }
      });
  };

  const handlePagar = async (venta: any) => {
    if (
      !confirm(
        `¿Confirmar pago de la venta #${venta.id} por ${formatoQuetzal.format(
          venta.total
        )}?`
      )
    )
      return;

    toast.promise(
      fetch(`/api/ventas/${venta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "completada" }),
      }).then(async (res) => {
        if (!res.ok) throw new Error("Error al procesar");
        fetchVentas(); // Recargar la tabla
      }),
      {
        loading: "Procesando pago...",
        success: "Pago registrado exitosamente",
        error: "Error al registrar pago",
      }
    );
  };

  const handleAnular = async (id: number) => {
    if (
      !confirm("¿Seguro que deseas anular esta venta? El stock será devuelto.")
    )
      return;

    const promise = fetch(`/api/ventas/${id}`, { method: "DELETE" });

    toast.promise(promise, {
      loading: "Anulando venta...",
      success: () => {
        fetchVentas();
        return "Venta anulada correctamente";
      },
      error: "Error al anular venta",
    });
  };

  const verDetalles = async (venta: any) => {
    setSelectedVenta(venta);
    setModalOpen(true);
    cargarDetalles(venta.id);
  };

  const cargarDetalles = async (id: number) => {
    const res = await fetch(`/api/ventas/${id}`);
    const data = await res.json();
    setDetallesVenta(data.detalles || []);
  };

  //lógica apara agregar productos extra a una venta ya hecha
  const abrirModalAgregar = () => {
    setAddModalOpen(true);
    setSearchTerm("");
    setSearchResults([]);
    setItemsToAdd([]);
  };

  const buscarProductos = async (term: string) => {
    setSearchTerm(term);
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    const res = await fetch(`/api/productos?q=${term}`);
    const data = await res.json();
    if (data.data) {
      setSearchResults(data.data);
    }
  };

  const agregarAlCarritoTemporal = (producto: any) => {
    if (producto.stock <= 0) {
      toast.error("Producto sin stock");
      return;
    }
    setItemsToAdd((prev) => {
      const existing = prev.find((i) => i.id === producto.id);
      if (existing) {
        if (existing.cantidad + 1 > producto.stock) {
          toast.warning("Stock insuficiente");
          return prev;
        }
        return prev.map((i) =>
          i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
    toast.success("Agregado");
  };

  const removerDelCarritoTemporal = (id: number) => {
    setItemsToAdd((prev) => prev.filter((i) => i.id !== id));
  };

  const guardarNuevosItems = async () => {
    if (itemsToAdd.length === 0) return;
    if (!selectedVenta) return;

    try {
      const payload = {
        items_nuevos: itemsToAdd.map((item) => ({
          producto_id: item.id,
          cantidad: item.cantidad,
          precio: parseFloat(item.precio),
          datos_extra: item.es_bateria ? { garantia_meses: 12 } : null,
        })),
      };

      const res = await fetch(`/api/ventas/${selectedVenta.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Error al agregar productos");

      toast.success("Productos agregados exitosamente");
      setAddModalOpen(false);
      cargarDetalles(selectedVenta.id);
      fetchVentas();
    } catch (error) {
      toast.error("Error al guardar los nuevos productos");
      console.error(error);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Toaster position="top-right" richColors />

      {/* CABECERA */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h1
          className={stylesHistorial.titleVentas}
          style={{ color: "var(--color-secondary)", margin: 0 }}
        >
          Historial de ventas
        </h1>
        <Link href="/ventas/nueva" style={{ textDecoration: "none" }}>
          <button
            className={stylesHistorial.buttonPOS}
            style={{
              backgroundColor: "var(--color-primary)",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 6px rgba(249, 115, 22, 0.2)",
            }}
          >
            <ShoppingCart size={20} /> Nueva Venta (POS)
          </button>
        </Link>
      </div>

      {/* BARRA DE FILTROS DE FECHA */}
      <div className={styles.filterBar} style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{ fontWeight: "bold", color: "var(--color-text-muted)" }}
          >
            Filtrar por fecha:
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: "0.9rem" }}>Desde:</span>
            <input
              type="date"
              className={styles.input}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: "8px", maxWidth: 150 }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: "0.9rem" }}>Hasta:</span>
            <input
              type="date"
              className={styles.input}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: "8px", maxWidth: 150 }}
            />
          </div>

          <button
            onClick={handleFilter}
            className={styles.btnPrimary}
            style={{
              padding: "8px 15px",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Filter size={16} /> Filtrar
          </button>

          {(startDate || endDate) && (
            <button
              onClick={clearFilters}
              className={styles.clearBtn}
              title="Limpiar filtros"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div style={{ height: 24, width: 1, background: "#cbd5e1" }}></div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            userSelect: "none",
            background: "white",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
          }}
        >
          <input
            type="checkbox"
            checked={showAnuladas}
            onChange={(e) => setShowAnuladas(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <span
            style={{
              fontSize: "0.9rem",
              color: showAnuladas ? "#ef4444" : "inherit",
              fontWeight: showAnuladas ? "bold" : "normal",
            }}
          >
            Mostrar Anuladas
          </span>
        </label>
      </div>

      {/* TABLA DE VENTAS */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
              <th style={{ padding: 12 }}>ID</th>
              <th style={{ padding: 12 }}>Fecha</th>
              <th style={{ padding: 12 }}>Vendedor</th>
              <th style={{ padding: 12 }}>Cliente</th>
              <th style={{ padding: 12 }}>Total</th>
              <th style={{ padding: 12 }}>Estado</th>
              <th style={{ padding: 12 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ventas.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 20, textAlign: "center" }}>
                  No se encontraron registros en este periodo.
                </td>
              </tr>
            ) : (
              ventas.map((v) => (
                <tr
                  key={v.id}
                  style={{
                    borderBottom: "1px solid #eee",
                    opacity: v.estado === "anulada" ? 0.6 : 1,
                  }}
                >
                  <td style={{ padding: 12 }}>#{v.id}</td>
                  <td style={{ padding: 12 }}>
                    {new Date(v.fecha_venta).toLocaleString()}
                  </td>
                  <td style={{ padding: 12 }}>{v.vendedor_nombre || "N/A"}</td>
                  <td style={{ padding: 12 }}>{v.cliente || "CF"}</td>
                  <td style={{ padding: 12, fontWeight: "bold" }}>
                    {formatoQuetzal.format(v.total)}
                  </td>
                  <td style={{ padding: 12 }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        fontSize: "0.85rem",
                        background:
                          v.estado === "anulada"
                            ? "#fee2e2"
                            : v.estado === "pendiente"
                            ? "#fef9c3"
                            : "#dcfce7",
                        color:
                          v.estado === "anulada"
                            ? "#ef4444"
                            : v.estado === "pendiente"
                            ? "#854d0e"
                            : "#166534",
                        border:
                          v.estado === "pendiente"
                            ? "1px solid #fde047"
                            : "none",
                      }}
                    >
                      {v.estado?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: 12 }}>
                    <button
                      onClick={() => verDetalles(v)}
                      title="Ver Detalles"
                      style={{
                        marginRight: 10,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--color-secondary)",
                      }}
                    >
                      <Eye size={18} />
                    </button>
                    {v.estado === "pendiente" && (
                      <button
                        onClick={() => handlePagar(v)}
                        title="Registrar Pago"
                        style={{
                          marginRight: 10,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#16a34a", // Verde
                        }}
                      >
                        <Banknote size={18} />
                      </button>
                    )}
                    {v.estado !== "anulada" && (
                      <button
                        onClick={() => handleAnular(v.id)}
                        title="Anular Venta"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#ef4444",
                        }}
                      >
                        <Ban size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINACIÓN */}
      <div
        style={{
          marginTop: 20,
          display: "flex",
          justifyContent: "center",
          gap: 15,
          alignItems: "center",
        }}
      >
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
          style={{
            padding: "8px 15px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: page === 1 ? "#f3f4f6" : "white",
            cursor: page === 1 ? "not-allowed" : "pointer",
          }}
        >
          &lt; Anterior
        </button>
        <span style={{ fontWeight: "bold", color: "#64748b" }}>
          Página {page} de {totalPages}
        </span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
          style={{
            padding: "8px 15px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: page === totalPages ? "#f3f4f6" : "white",
            cursor: page === totalPages ? "not-allowed" : "pointer",
          }}
        >
          Siguiente &gt;
        </button>
      </div>

      {/* MODAL DETALLES */}
      {modalOpen && selectedVenta && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              padding: 25,
              borderRadius: 8,
              width: 600,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <h2 style={{ color: "var(--color-secondary)", marginTop: 0 }}>
              Detalle Venta #{selectedVenta.id}
            </h2>
            <div style={{ marginBottom: 20 }}>
              {detallesVenta.map((d, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <span>
                    {d.cantidad}x {d.producto_nombre}
                  </span>
                  <span>{formatoQuetzal.format(d.subtotal)}</span>
                </div>
              ))}
              <div
                style={{
                  textAlign: "right",
                  marginTop: 10,
                  fontWeight: "bold",
                  fontSize: "1.2rem",
                  color: "var(--color-primary)",
                }}
              >
                Total Actual:{" "}
                {formatoQuetzal.format(
                  detallesVenta.reduce(
                    (acc, item) => acc + parseFloat(item.subtotal),
                    0
                  )
                )}
              </div>
            </div>
            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
            >
              {selectedVenta.estado !== "anulada" && (
                <button
                  onClick={abrirModalAgregar}
                  style={{
                    background: "var(--color-primary)",
                    color: "white",
                    border: "none",
                    padding: "10px 15px",
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <PlusCircle size={16} /> Agregar Productos Extra
                </button>
              )}
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  padding: "10px 15px",
                  cursor: "pointer",
                  border: "1px solid #ccc",
                  background: "transparent",
                  borderRadius: 6,
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AGREGAR EXTRA */}
      {addModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1100,
          }}
        >
          <div
            style={{
              background: "white",
              padding: 25,
              borderRadius: 8,
              width: 500,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              gap: 15,
            }}
          >
            <h3 style={{ margin: 0, color: "var(--color-secondary)" }}>
              Agregar a Venta #{selectedVenta.id}
            </h3>

            <div style={{ position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  padding: "0 10px",
                }}
              >
                <Search size={18} color="#888" />
                <input
                  autoFocus
                  placeholder="Buscar producto..."
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "none",
                    outline: "none",
                  }}
                  value={searchTerm}
                  onChange={(e) => buscarProductos(e.target.value)}
                />
              </div>
              {searchResults.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "white",
                    border: "1px solid #eee",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                    maxHeight: 200,
                    overflowY: "auto",
                    zIndex: 10,
                  }}
                >
                  {searchResults.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        agregarAlCarritoTemporal(p);
                        setSearchTerm("");
                        setSearchResults([]);
                      }}
                      style={{
                        padding: 10,
                        cursor: "pointer",
                        borderBottom: "1px solid #f0f0f0",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{p.nombre}</span>
                      <span style={{ fontWeight: "bold" }}>
                        {formatoQuetzal.format(p.precio)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                minHeight: 150,
                background: "#f8fafc",
                borderRadius: 6,
                padding: 10,
              }}
            >
              {itemsToAdd.length === 0 ? (
                <p
                  style={{ textAlign: "center", color: "#888", marginTop: 20 }}
                >
                  Busca y selecciona productos para agregar.
                </p>
              ) : (
                itemsToAdd.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
                        {item.nombre}
                      </div>
                      <small style={{ color: "#64748b" }}>
                        {formatoQuetzal.format(item.precio)} c/u
                      </small>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <span style={{ fontWeight: "bold" }}>
                        x{item.cantidad}
                      </span>
                      <button
                        onClick={() => removerDelCarritoTemporal(item.id)}
                        style={{
                          color: "#ef4444",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 15,
                  fontWeight: "bold",
                }}
              >
                <span>Total a Agregar:</span>
                <span>
                  {formatoQuetzal.format(
                    itemsToAdd.reduce(
                      (acc, i) => acc + i.precio * i.cantidad,
                      0
                    )
                  )}
                </span>
              </div>
              <div
                style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
              >
                <button
                  onClick={() => setAddModalOpen(false)}
                  style={{
                    padding: "10px 15px",
                    border: "1px solid #ccc",
                    background: "white",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarNuevosItems}
                  disabled={itemsToAdd.length === 0}
                  style={{
                    padding: "10px 15px",
                    border: "none",
                    background:
                      itemsToAdd.length === 0
                        ? "#cbd5e1"
                        : "var(--color-primary)",
                    color: "white",
                    borderRadius: 6,
                    cursor: itemsToAdd.length === 0 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Save size={16} /> Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
