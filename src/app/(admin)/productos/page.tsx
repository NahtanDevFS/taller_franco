"use client";
import { useState, useEffect, useCallback } from "react";
import styles from "./productos.module.css";
import { formatoQuetzal } from "@/lib/utils";
import { Toaster, toast } from "sonner";
import { Search, X, Edit, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function ProductosPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [marcas, setMarcas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [filterMarca, setFilterMarca] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [lowStockOnly, setLowStockOnly] = useState(false);

  const fetchProductos = useCallback(async () => {
    const params = new URLSearchParams({
      page: page.toString(),
      q: searchTerm,
      cat: filterCategoria,
      marca: filterMarca,
      lowStock: lowStockOnly.toString(),
    });
    const res = await fetch(`/api/productos?${params}`);
    const data = await res.json();
    if (data.data) {
      setProductos(data.data);
      setTotalPages(data.totalPages);
    }
  }, [page, searchTerm, filterCategoria, filterMarca, lowStockOnly]);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProductos();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchProductos]);

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este producto?")) return;

    toast.promise(
      fetch(`/api/productos/${id}`, { method: "DELETE" }).then(async (res) => {
        if (!res.ok) throw new Error("Error al eliminar");
        fetchProductos();
      }),
      {
        loading: "Eliminando...",
        success: "Producto eliminado",
        error: "Error al eliminar",
      }
    );
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterCategoria("");
    setFilterMarca("");
    setLowStockOnly(false);
    setPage(1);
  };

  return (
    <div className={styles.container}>
      <Toaster position="top-right" />

      <div className={styles.header}>
        <h1 className={styles.title}>Inventario</h1>

        <Link href="/productos/nuevo">
          <button className={styles.btnPrimary}>+ Nuevo Producto</button>
        </Link>
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
        <label
          className={styles.checkboxLabel}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.9rem",
            cursor: "pointer",
            userSelect: "none",
            color: lowStockOnly ? "#ef4444" : "#64748b",
            fontWeight: lowStockOnly ? 600 : 400,
            border: `1px solid ${lowStockOnly ? "#ef4444" : "#e2e8f0"}`,
            padding: "6px 12px",
            borderRadius: 6,
            background: lowStockOnly ? "#fef2f2" : "white",
          }}
        >
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => {
              setLowStockOnly(e.target.checked);
              setPage(1);
            }}
            style={{ accentColor: "#ef4444" }}
          />
          <AlertTriangle size={16} />
          Bajo stock
        </label>
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
                <tr key={p.uid || p.id}>
                  <td>{p.codigo_barras || "-"}</td>
                  <td>
                    {p.nombre}
                    {p.requiere_serial && (
                      <span className={styles.badgeBateria}>Serial</span>
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
                    <Link href={`/productos/nuevo?id=${p.id}`}>
                      <button className={styles.btnIcon} title="Editar">
                        <Edit size={18} />
                      </button>
                    </Link>

                    <button
                      onClick={() => handleDelete(p.id)}
                      className={`${styles.btnIcon} ${styles.btnDelete}`}
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  style={{ textAlign: "center", padding: 20, color: "#999" }}
                >
                  No se encontraron productos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 20,
          display: "flex",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
          className={styles.pageBtn}
        >
          &lt; Anterior
        </button>
        <span
          style={{ fontWeight: "bold", color: "#64748b", alignSelf: "center" }}
        >
          Página {page} de {totalPages}
        </span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
          className={styles.pageBtn}
        >
          Siguiente &gt;
        </button>
      </div>
    </div>
  );
}
