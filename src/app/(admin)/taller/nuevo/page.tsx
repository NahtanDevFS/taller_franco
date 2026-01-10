"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import { ArrowLeft, X } from "lucide-react";
import styles from "./nuevoIngreso.module.css";
import Link from "next/link";

export default function NuevoIngresoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [modoNuevoCliente, setModoNuevoCliente] = useState(false);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clientesSugeridos, setClientesSugeridos] = useState<any[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);

  const [formData, setFormData] = useState({
    nuevo_nombre: "",
    nuevo_telefono: "",
    nuevo_nit: "",
    placa: "",
    marca: "",
    modelo: "",
    anio: "",
    color: "",
    vin: "",
    notas: "",
  });

  useEffect(() => {
    if (modoNuevoCliente || clienteSeleccionado) return;
    const timer = setTimeout(async () => {
      if (busquedaCliente.length >= 2) {
        try {
          const res = await fetch(`/api/taller/clientes?q=${busquedaCliente}`);
          const data = await res.json();
          setClientesSugeridos(Array.isArray(data) ? data : []);
        } catch (e) {
          console.error(e);
        }
      } else {
        setClientesSugeridos([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [busquedaCliente, modoNuevoCliente, clienteSeleccionado]);

  const seleccionarCliente = (cliente: any) => {
    setClienteSeleccionado(cliente);
    setBusquedaCliente(cliente.nombre);
    setClientesSugeridos([]);
  };

  const limpiarSeleccion = () => {
    setClienteSeleccionado(null);
    setBusquedaCliente("");
    setClientesSugeridos([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.placa) return toast.error("La placa es obligatoria");
    if (!clienteSeleccionado && !modoNuevoCliente)
      return toast.error("Debes seleccionar un cliente");
    if (modoNuevoCliente && !formData.nuevo_nombre)
      return toast.error("Nombre del cliente obligatorio");

    setLoading(true);
    try {
      const payload = {
        placa: formData.placa,
        marca: formData.marca,
        modelo: formData.modelo,
        anio: formData.anio,
        color: formData.color,
        vin: formData.vin,
        notas: formData.notas,
        cliente_id: clienteSeleccionado?.id || null,
        nuevo_cliente_nombre: modoNuevoCliente ? formData.nuevo_nombre : null,
        nuevo_cliente_telefono: modoNuevoCliente
          ? formData.nuevo_telefono
          : null,
        nuevo_cliente_nit: modoNuevoCliente ? formData.nuevo_nit : null,
      };

      const res = await fetch("/api/taller/vehiculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");

      toast.success("Vehículo registrado correctamente");
      router.push(`/taller/vehiculos/${data.id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className={styles.container}>
      <Toaster position="top-right" richColors />

      <div className={styles.header}>
        <Link
          href="/taller"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginBottom: 10,
            color: "#64748b",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={18} /> Volver al listado
        </Link>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Nuevo Ingreso</h1>
          <p className={styles.subtitle}>
            Registra un vehículo y asigna su propietario.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.formGrid}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Datos del Propietario
            <button
              type="button"
              className={styles.toggleBtn}
              onClick={() => {
                setModoNuevoCliente(!modoNuevoCliente);
                limpiarSeleccion();
                setFormData((prev) => ({
                  ...prev,
                  nuevo_nombre: "",
                  nuevo_telefono: "",
                }));
              }}
            >
              {modoNuevoCliente
                ? "Buscar cliente existente"
                : "Crear cliente nuevo"}
            </button>
          </div>

          {!modoNuevoCliente ? (
            <div className={styles.row}>
              <div className={styles.col}>
                <label className={styles.label}>
                  Buscar Cliente (Nombre o Tel)
                </label>
                <div className={styles.inputContainer}>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Ej: Juan Perez..."
                    value={busquedaCliente}
                    onChange={(e) => {
                      setBusquedaCliente(e.target.value);
                      if (clienteSeleccionado) setClienteSeleccionado(null);
                    }}
                    disabled={!!clienteSeleccionado}
                  />
                  {clienteSeleccionado && (
                    <button
                      type="button"
                      onClick={limpiarSeleccion}
                      className={styles.clearBtn}
                      title="Limpiar selección"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {clientesSugeridos.length > 0 && !clienteSeleccionado && (
                  <div className={styles.searchResults}>
                    {clientesSugeridos.map((c) => (
                      <div
                        key={c.id}
                        className={styles.searchItem}
                        onClick={() => seleccionarCliente(c)}
                      >
                        <strong>{c.nombre}</strong>{" "}
                        <span style={{ fontSize: "0.8em", color: "#666" }}>
                          ({c.telefono || "Sin tel"})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.col}>
                <label className={styles.label}>Teléfono</label>
                <input
                  className={styles.input}
                  value={clienteSeleccionado?.telefono || ""}
                  disabled
                />
              </div>
            </div>
          ) : (
            <>
              <div className={styles.row}>
                <div className={styles.col}>
                  <label className={styles.label}>Nombre Completo *</label>
                  <input
                    name="nuevo_nombre"
                    className={styles.input}
                    value={formData.nuevo_nombre}
                    onChange={handleChange}
                    placeholder="Nombre del cliente"
                    required={modoNuevoCliente}
                  />
                </div>
                <div className={styles.col}>
                  <label className={styles.label}>Teléfono</label>
                  <input
                    name="nuevo_telefono"
                    className={styles.input}
                    value={formData.nuevo_telefono}
                    onChange={handleChange}
                    placeholder="5555-5555"
                  />
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.col}>
                  <label className={styles.label}>NIT / RFC (Opcional)</label>
                  <input
                    name="nuevo_nit"
                    className={styles.input}
                    value={formData.nuevo_nit}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Datos del Vehículo</div>
          <div className={styles.row}>
            <div className={styles.col}>
              <label className={styles.label}>Placa *</label>
              <input
                name="placa"
                className={`${styles.input} ${styles.placaInput}`}
                value={formData.placa}
                onChange={handleChange}
                placeholder="P-123ABC"
                required
              />
            </div>
            <div className={styles.col}>
              <label className={styles.label}>Marca</label>
              <input
                name="marca"
                className={styles.input}
                value={formData.marca}
                onChange={handleChange}
                placeholder="Toyota..."
              />
            </div>
            <div className={styles.col}>
              <label className={styles.label}>Modelo</label>
              <input
                name="modelo"
                className={styles.input}
                value={formData.modelo}
                onChange={handleChange}
                placeholder="Corolla..."
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.col}>
              <label className={styles.label}>Año</label>
              <input
                name="anio"
                type="number"
                className={styles.input}
                value={formData.anio}
                onChange={handleChange}
                placeholder="2015"
              />
            </div>
            <div className={styles.col}>
              <label className={styles.label}>Color</label>
              <input
                name="color"
                className={styles.input}
                value={formData.color}
                onChange={handleChange}
                placeholder="Rojo..."
              />
            </div>
            <div className={styles.col}>
              <label className={styles.label}>VIN / Chasis</label>
              <input
                name="vin"
                className={styles.input}
                value={formData.vin}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.col}>
              <label className={styles.label}>Notas Iniciales</label>
              <textarea
                name="notas"
                className={styles.textarea}
                rows={3}
                value={formData.notas}
                onChange={handleChange}
                placeholder="Ej: Trae golpe en puerta derecha..."
              />
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Link href="/taller" className={styles.btnCancel}>
            Cancelar
          </Link>
          <button type="submit" className={styles.btnSubmit} disabled={loading}>
            {loading ? "Guardando..." : "Guardar e Ir a Bitácora"}
          </button>
        </div>
      </form>
    </div>
  );
}
