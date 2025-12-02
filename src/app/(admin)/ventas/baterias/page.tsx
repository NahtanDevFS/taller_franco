"use client";
import { useState, useEffect, useCallback } from "react";
import { formatoQuetzal } from "@/lib/utils";
import { Toaster, toast } from "sonner";
import { Pencil, Trash2, X, Search, Filter } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "../../productos/productos.module.css";
import stylesHistorial from "../historialVentas.module.css";

export default function VentasBateriasPage() {
  const [baterias, setBaterias] = useState<any[]>([]);
  const [batteryProducts, setBatteryProducts] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Estados de Paginación y Filtros
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Estado para búsqueda dentro del modal
  const [searchTerm, setSearchTerm] = useState("");
  const [productsFound, setProductsFound] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  const formatDateTimeLocal = (date: Date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); // obtiene la hora local
    return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  };

  const initialForm = {
    id_detalle: null,
    venta_id: null,
    cliente: "",
    fecha_venta: formatDateTimeLocal(new Date()),
    codigo_unico: "",
    garantia_meses: 12,
    producto_id: "",
    precio: 0,
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);

      fetchVentas(1);
      fetchProductosBaterias();
    };
    init();
  }, []);

  // Función Fetch Principal con Filtros
  const fetchVentas = async (p = page) => {
    const params = new URLSearchParams({
      page: p.toString(),
      startDate,
      endDate,
    });

    const res = await fetch(`/api/ventas/baterias?${params}`);
    if (res.ok) {
      const data = await res.json();
      setBaterias(data.data || []);
      setTotalPages(data.totalPages || 1);
    }
  };

  // Recargar al cambiar página
  useEffect(() => {
    fetchVentas(page);
  }, [page]);

  const handleFilter = () => {
    setPage(1);
    fetchVentas(1);
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setPage(1);
    // Fetch manual para asegurar limpieza inmediata
    fetch(`/api/ventas/baterias?page=1`)
      .then((res) => res.json())
      .then((data) => {
        setBaterias(data.data || []);
        setTotalPages(data.totalPages || 1);
      });
  };

  const fetchProductosBaterias = async () => {
    const res = await fetch("/api/productos?type=all_batteries");
    if (res.ok) setBatteryProducts(await res.json());
  };

  // manejar el formulario
  const handleProductSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const prodId = e.target.value;
    const prod = batteryProducts.find((p) => p.id.toString() === prodId);
    setFormData({
      ...formData,
      producto_id: prodId,
      precio: prod ? parseFloat(prod.precio) : 0,
    });
  };

  const openNewModal = () => {
    setFormData({
      ...initialForm,
      fecha_venta: formatDateTimeLocal(new Date()),
    });
    setModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setFormData({
      id_detalle: item.id,
      venta_id: item.venta_id,
      cliente: item.nombre_cliente || "",
      fecha_venta: formatDateTimeLocal(new Date(item.fecha_venta)),
      codigo_unico: item.codigo_unico || "",
      garantia_meses: parseInt(item.garantia) || 12,
      producto_id: item.producto_id.toString(),
      precio: parseFloat(item.precio_unitario),
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.producto_id) {
      toast.error("Selecciona una batería");
      return;
    }

    const isEdit = !!formData.id_detalle;
    const url = isEdit
      ? `/api/ventas/baterias/${formData.id_detalle}`
      : "/api/ventas/baterias";
    const method = isEdit ? "PUT" : "POST";

    const payload = {
      ...formData,
      usuario_id: userId,
      fecha_venta: new Date(formData.fecha_venta).toISOString(),
    };

    const promise = fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error");
      }
      fetchVentas();
      setModalOpen(false);
      return isEdit ? "Registro actualizado" : "Venta registrada exitosamente";
    });

    toast.promise(promise, {
      loading: "Procesando...",
      success: (msg) => `${msg}`,
      error: (err) => `${err.message}`,
    });
  };

  const handleAnular = async (id: number) => {
    if (!confirm("¿Anular esta venta? Se devolverá el stock.")) return;
    toast.promise(
      fetch(`/api/ventas/baterias/${id}`, { method: "DELETE" }).then(
        async (res) => {
          if (!res.ok) throw new Error("Error");
          fetchVentas();
        }
      ),
      {
        loading: "Anulando...",
        success: "Venta anulada correctamente",
        error: "Error al anular",
      }
    );
  };

  return (
    <div className={styles.container}>
      <Toaster position="top-right" richColors />

      <div className={styles.header}>
        <h1
          className={stylesHistorial.titleVentas}
          style={{ color: "var(--color-secondary)" }}
        >
          Gestión de Baterías
        </h1>
        <button className={styles.btnPrimary} onClick={openNewModal}>
          + Nueva Venta Batería
        </button>
      </div>

      {/* BARRA DE FILTROS */}
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
      </div>

      {/* TABLA */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Fecha Venta</th>
              <th>Modelo</th>
              <th>Código</th>
              <th>Garantía</th>
              <th>Cliente</th>
              <th style={{ textAlign: "center" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {baterias.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 20, textAlign: "center" }}>
                  No hay registros en este periodo.
                </td>
              </tr>
            ) : (
              baterias.map((b) => (
                <tr key={b.id}>
                  <td>{new Date(b.fecha_venta).toLocaleDateString()}</td>
                  <td style={{ fontWeight: "bold" }}>{b.modelo_bateria}</td>
                  <td
                    style={{
                      fontFamily: "monospace",
                      color: "var(--color-primary)",
                    }}
                  >
                    {b.codigo_unico || "-"}
                  </td>
                  <td>{b.garantia} Meses</td>
                  <td>{b.nombre_cliente}</td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      onClick={() => openEditModal(b)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#3b82f6",
                        marginRight: 10,
                      }}
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => handleAnular(b.id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#ef4444",
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
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

      {/* MODAL */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h2 style={{ margin: 0, color: "var(--color-secondary)" }}>
                {formData.id_detalle ? "Editar Registro" : "Registrar Venta"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <X />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Modelo de Batería</label>
                {/* SELECT DESBLOQUEADO SIEMPRE */}
                <select
                  className={styles.input}
                  value={formData.producto_id}
                  onChange={handleProductSelect}
                  required
                >
                  <option value="">Seleccionar Batería...</option>
                  {batteryProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} - Stock: {p.stock}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>Fecha de Venta</label>
                  <input
                    type="datetime-local"
                    className={styles.input}
                    required
                    value={formData.fecha_venta}
                    onChange={(e) =>
                      setFormData({ ...formData, fecha_venta: e.target.value })
                    }
                  />
                </div>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>Garantía (Meses)</label>
                  <input
                    type="number"
                    className={styles.input}
                    required
                    value={formData.garantia_meses}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        garantia_meses: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Cliente</label>
                <input
                  className={styles.input}
                  placeholder="Nombre del cliente"
                  value={formData.cliente}
                  onChange={(e) =>
                    setFormData({ ...formData, cliente: e.target.value })
                  }
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Código Único / Grabado</label>
                <input
                  className={styles.input}
                  required
                  placeholder="Ej: A1-2023-XYZ"
                  value={formData.codigo_unico}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo_unico: e.target.value })
                  }
                  style={{ border: "2px solid var(--color-primary)" }}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Precio Venta</label>
                <input
                  className={styles.input}
                  type="number"
                  value={formData.precio}
                  disabled // El precio lo dicta el modelo, se llena solo
                  style={{ backgroundColor: "#f1f5f9" }}
                />
              </div>

              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: "10px 20px",
                    border: "1px solid #ccc",
                    background: "transparent",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  {formData.id_detalle ? "Guardar Cambios" : "Registrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
