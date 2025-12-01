"use client";
import { useState, useEffect, useCallback } from "react";
import styles from "./productos.module.css";
import { calcularPrecioVenta, formatoQuetzal } from "@/lib/utils";
import { Toaster, toast } from "sonner";
import { Search, X } from "lucide-react";

export default function ProductosPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [marcas, setMarcas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [filterMarca, setFilterMarca] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const initialFormState = {
    nombre: "",
    codigo_barras: "",
    costo: 0,
    precio: 0,
    stock: 0,
    stock_minimo: 5,
    marca_id: "",
    nueva_marca_nombre: "",
    categoria_id: "",
    es_bateria: false, // Nuevo estado
  };

  const [formData, setFormData] = useState(initialFormState);
  const [isManualMarca, setIsManualMarca] = useState(false);

  // FETCH PRODUCTOS (Con filtros)
  const fetchProductos = useCallback(async () => {
    const params = new URLSearchParams({
      page: page.toString(),
      q: searchTerm,
      cat: filterCategoria,
      marca: filterMarca,
    });
    const res = await fetch(`/api/productos?${params}`);
    const data = await res.json();
    if (data.data) {
      setProductos(data.data);
      setTotalPages(data.totalPages);
    }
  }, [page, searchTerm, filterCategoria, filterMarca]);

  // FETCH METADATA (Categorías y Marcas)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [resMarcas, resCat] = await Promise.all([
          fetch("/api/marcas"),
          fetch("/api/categorias"),
        ]);
        if (resMarcas.ok) setMarcas(await resMarcas.json());
        if (resCat.ok) setCategorias(await resCat.json());
      } catch (e) {
        console.error(e);
      }
    };
    fetchMetadata();
  }, []);

  // DEBOUNCE SEARCH
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProductos();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchProductos]);

  // MANEJO DE COSTO (Fórmula)
  const handleCostoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const costo = parseFloat(e.target.value) || 0;
    const precioSugerido = calcularPrecioVenta(costo);
    setFormData((prev) => ({ ...prev, costo, precio: precioSugerido }));
  };

  // CAMBIO DE CATEGORÍA (Automático: Batería ID 6)
  const handleCategoriaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const catId = e.target.value;
    const isBattery = catId === "6"; // ID 6 = Baterías
    setFormData((prev) => ({
      ...prev,
      categoria_id: catId,
      es_bateria: isBattery, // Auto-select
    }));
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setIsManualMarca(false);
    setModalOpen(true);
  };

  const handleEdit = (producto: any) => {
    setEditingId(producto.id);
    setFormData({
      nombre: producto.nombre,
      codigo_barras: producto.codigo_barras || "",
      costo: 0,
      precio: parseFloat(producto.precio),
      stock: producto.stock,
      stock_minimo: producto.stock_minimo,
      marca_id: producto.marca_id ? producto.marca_id.toString() : "",
      nueva_marca_nombre: "",
      categoria_id: producto.categoria_id
        ? producto.categoria_id.toString()
        : "",
      es_bateria: producto.es_bateria || false, // Cargar estado actual
    });
    setIsManualMarca(false);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este producto?")) return;
    const promise = fetch(`/api/productos/${id}`, { method: "DELETE" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error al eliminar");
        }
        return res.json();
      })
      .then(() => {
        fetchProductos();
        return "Producto eliminado";
      });
    toast.promise(promise, {
      loading: "Eliminando...",
      success: (msg) => `${msg}`,
      error: (err) => `${err.message}`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/productos/${editingId}` : "/api/productos";
    const method = editingId ? "PUT" : "POST";

    const promise = fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    }).then(async (res) => {
      if (!res.ok) throw new Error("Error");
      setModalOpen(false);
      fetchProductos();
      return editingId ? "Producto actualizado" : "Producto creado";
    });

    toast.promise(promise, {
      loading: "Guardando...",
      success: (msg) => `${msg}`,
      error: "Error al guardar",
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterCategoria("");
    setFilterMarca("");
    setPage(1);
  };

  return (
    <div className={styles.container}>
      <Toaster position="top-right" />

      <div className={styles.header}>
        <h1 className={styles.title}>Inventario</h1>
        <button className={styles.btnPrimary} onClick={openNewModal}>
          + Nuevo Producto
        </button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchContainer}>
          <Search size={18} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={filterCategoria}
          onChange={(e) => {
            setFilterCategoria(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas las Categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={filterMarca}
          onChange={(e) => {
            setFilterMarca(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas las Marcas</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
        {(searchTerm || filterCategoria || filterMarca) && (
          <button onClick={clearFilters} className={styles.clearBtn}>
            <X size={18} />
          </button>
        )}
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Marca</th>
              <th>Stock</th>
              <th>Precio</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.length > 0 ? (
              productos.map((p) => (
                <tr key={p.id}>
                  <td>{p.codigo_barras || "-"}</td>
                  <td>
                    {p.nombre}
                    {p.es_bateria && (
                      <span
                        style={{
                          marginLeft: 5,
                          fontSize: "0.7rem",
                          background: "#e0f2fe",
                          color: "#0284c7",
                          padding: "2px 5px",
                          borderRadius: 4,
                        }}
                      >
                        Batería
                      </span>
                    )}
                  </td>
                  <td>{p.categoria_nombre || "-"}</td>
                  <td>{p.marca_nombre || "Genérico"}</td>
                  <td
                    className={p.stock <= p.stock_minimo ? styles.lowStock : ""}
                  >
                    {p.stock}
                  </td>
                  <td>{formatoQuetzal.format(p.precio)}</td>
                  <td>
                    <button
                      onClick={() => handleEdit(p)}
                      className={styles.btnIcon}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className={`${styles.btnIcon} ${styles.btnDelete}`}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 20 }}>
                  No se encontraron productos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          &lt; Anterior
        </button>
        <span>
          Página {page} de {totalPages}
        </span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente &gt;
        </button>
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 style={{ color: "var(--color-secondary)", marginTop: 0 }}>
              {editingId ? "Editar Producto" : "Agregar Producto"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Nombre del Repuesto</label>
                <input
                  className={styles.input}
                  required
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                />
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>Código de Barras</label>
                  <input
                    className={styles.input}
                    value={formData.codigo_barras}
                    placeholder="Escanear o escribir"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        codigo_barras: e.target.value,
                      })
                    }
                  />
                </div>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>Categoría</label>
                  <select
                    className={styles.input}
                    required
                    value={formData.categoria_id}
                    onChange={handleCategoriaChange}
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label
                  className={styles.label}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <input
                    type="checkbox"
                    checked={formData.es_bateria}
                    onChange={(e) =>
                      setFormData({ ...formData, es_bateria: e.target.checked })
                    }
                  />
                  Es batería
                </label>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Marca{" "}
                  <small
                    style={{
                      color: "var(--color-primary)",
                      cursor: "pointer",
                      marginLeft: 5,
                    }}
                    onClick={() => setIsManualMarca(!isManualMarca)}
                  >
                    ({isManualMarca ? "Seleccionar existente" : "Crear nueva"})
                  </small>
                </label>
                {isManualMarca ? (
                  <input
                    className={styles.input}
                    placeholder="Nueva marca..."
                    value={formData.nueva_marca_nombre}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        nueva_marca_nombre: e.target.value,
                        marca_id: "",
                      })
                    }
                  />
                ) : (
                  <select
                    className={styles.input}
                    value={formData.marca_id}
                    onChange={(e) =>
                      setFormData({ ...formData, marca_id: e.target.value })
                    }
                  >
                    <option value="">Seleccionar...</option>
                    {marcas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>Costo (Q)</label>
                  <input
                    type="number"
                    className={styles.input}
                    min="0"
                    step="0.01"
                    value={formData.costo || ""}
                    placeholder={editingId ? "Opcional" : "0.00"}
                    onChange={handleCostoChange}
                  />
                </div>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>Precio Venta (Q)</label>
                  <input
                    type="number"
                    className={styles.input}
                    required
                    value={formData.precio}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        precio: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>Stock Actual</label>
                  <input
                    type="number"
                    className={styles.input}
                    required
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stock: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>Stock Mínimo</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={formData.stock_minimo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stock_minimo: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 20,
                }}
              >
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid #ccc",
                    padding: "10px 20px",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  {editingId ? "Actualizar" : "Guardar Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
