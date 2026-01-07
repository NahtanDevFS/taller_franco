"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./taller.module.css";
import { Edit, Trash2, Search, FileText } from "lucide-react";
import { Toaster, toast } from "sonner";

export default function TallerPage() {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [recientes, setRecientes] = useState<any[]>([]);

  const fetchVehiculos = async (query = "") => {
    try {
      setLoading(true);
      const res = await fetch(`/api/taller/vehiculos?q=${query}`);
      const json = await res.json();
      if (json.data) {
        if (!query) setRecientes(json.data);
        else setResultados(json.data);
      }
    } catch (error) {
      console.error("Error fetching taller:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehiculos();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (busqueda.length >= 2) {
        fetchVehiculos(busqueda);
      } else {
        setResultados([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const handleDeleteVehiculo = async (id: number) => {
    if (!confirm("¿Ocultar este vehículo de la lista?")) return;
    try {
      const res = await fetch(`/api/taller/vehiculos/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Vehículo eliminado de la lista");
        fetchVehiculos(busqueda);
      }
    } catch (e) {
      toast.error("Error al eliminar");
    }
  };

  const dataToShow = resultados.length > 0 ? resultados : recientes;
  const showTable =
    !loading &&
    (resultados.length > 0 || (busqueda === "" && recientes.length > 0));

  return (
    <div className={styles.container}>
      <Toaster position="top-right" richColors />

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Taller / Recepción</h1>
          <p className={styles.subtitle}>
            Gestión de ingresos y bitácora técnica
          </p>
        </div>
        <Link href="/taller/nuevo" className={styles.btnPrimary}>
          + Nuevo Ingreso
        </Link>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchContainer}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar por placa o cliente..."
            className={styles.searchInput}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {loading && <p className={styles.loading}>Buscando vehículos...</p>}

      {!loading && busqueda.length > 0 && resultados.length === 0 && (
        <div className={styles.emptyState}>
          <p>No se encontró ningún vehículo con "{busqueda}"</p>
          <Link
            href="/taller/nuevo"
            style={{
              color: "var(--color-primary)",
              fontWeight: "bold",
              marginTop: "10px",
              display: "inline-block",
            }}
          >
            Registrarlo ahora &rarr;
          </Link>
        </div>
      )}

      {showTable && (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Placa</th>
                <th>Vehículo</th>
                <th>Propietario</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {dataToShow.map((v) => (
                <tr key={v.id}>
                  <td>
                    <span className={styles.placaBadge}>{v.placa}</span>
                  </td>
                  <td>
                    <span className={styles.vehiculoInfo}>
                      {v.marca} {v.modelo}
                    </span>
                    <span className={styles.subtext}>
                      {v.color} {v.anio ? `- ${v.anio}` : ""}
                    </span>
                  </td>
                  <td>
                    {v.cliente_nombre}
                    <span className={styles.subtext}>
                      {v.cliente_telefono || "Sin teléfono"}
                    </span>
                  </td>
                  <td>
                    <div
                      className={styles.actionsCell}
                      style={{ justifyContent: "flex-end" }}
                    >
                      <Link
                        href={`/taller/vehiculos/${v.id}`}
                        className={styles.actionLink}
                        title="Ver Bitácora / Historial"
                      >
                        <FileText
                          size={16}
                          style={{
                            marginRight: 4,
                            verticalAlign: "text-bottom",
                          }}
                        />
                        Bitácora
                      </Link>

                      <button
                        onClick={() => handleDeleteVehiculo(v.id)}
                        className={`${styles.btnIcon} ${styles.btnDelete}`}
                        title="Ocultar de la lista"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !busqueda && recientes.length === 0 && (
        <div className={styles.emptyState}>
          <p>
            No hay vehículos recientes. Comienza registrando un nuevo ingreso.
          </p>
        </div>
      )}
    </div>
  );
}
