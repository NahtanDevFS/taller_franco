"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import styles from "../nuevoIngreso.module.css";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";

export default function EditarVehiculoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modoNuevoCliente, setModoNuevoCliente] = useState(false);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clientesSugeridos, setClientesSugeridos] = useState<any[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [telefonoEditable, setTelefonoEditable] = useState("");

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
    const cargar = async () => {
      try {
        const res = await fetch(`/api/taller/vehiculos/${id}`);
        if (!res.ok) throw new Error("Error cargando");
        const { vehiculo } = await res.json();

        setFormData((prev) => ({
          ...prev,
          placa: vehiculo.placa,
          marca: vehiculo.marca || "",
          modelo: vehiculo.modelo || "",
          anio: vehiculo.anio || "",
          color: vehiculo.color || "",
          vin: vehiculo.vin || "",
          notas: vehiculo.notas || "",
        }));

        setClienteSeleccionado({
          id: vehiculo.cliente_id,
          nombre: vehiculo.cliente_nombre,
          telefono: vehiculo.cliente_telefono,
        });
        setBusquedaCliente(vehiculo.cliente_nombre);
        setTelefonoEditable(vehiculo.cliente_telefono || "");
      } catch (e) {
        toast.error("Error al cargar datos");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [id]);

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

  const seleccionarCliente = (c: any) => {
    setClienteSeleccionado(c);
    setBusquedaCliente(c.nombre);
    setTelefonoEditable(c.telefono || "");
    setClientesSugeridos([]);
  };

  const limpiarSeleccion = () => {
    setClienteSeleccionado(null);
    setBusquedaCliente("");
    setTelefonoEditable("");
    setClientesSugeridos([]);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
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

      if (!modoNuevoCliente && clienteSeleccionado) {
        if (
          telefonoEditable.trim() !==
          (clienteSeleccionado.telefono || "").trim()
        ) {
          payload.actualizar_telefono = true;
          payload.telefono_nuevo = telefonoEditable;
        }
      }

      const res = await fetch(`/api/taller/vehiculos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Error al actualizar");
      toast.success("Guardado correctamente");
      router.push(`/taller/vehiculos/${id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (loading)
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>Cargando...</div>
    );

  return (
    <div className={styles.container}>
      <Toaster position="top-right" richColors />

      <div className={styles.header}>
        <Link
          href={`/taller/vehiculos/${id}`}
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
          <h1 className={styles.title}>Editar Vehículo / Propietario</h1>
        </div>
      </div>

      <form onSubmit={handleUpdate} className={styles.formGrid}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Propietario
            <button
              type="button"
              className={styles.toggleBtn}
              onClick={() => {
                setModoNuevoCliente(!modoNuevoCliente);
                limpiarSeleccion();
              }}
            >
              {modoNuevoCliente ? "Buscar existente" : "Crear nuevo dueño"}
            </button>
          </div>

          {!modoNuevoCliente ? (
            <div className={styles.row}>
              <div className={styles.col}>
                <label className={styles.label}>Nombre Propietario</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Buscar..."
                    value={busquedaCliente}
                    onChange={(e) => {
                      setBusquedaCliente(e.target.value);
                      if (clienteSeleccionado) setClienteSeleccionado(null);
                    }}
                  />
                  {clienteSeleccionado && (
                    <button
                      type="button"
                      onClick={limpiarSeleccion}
                      className={styles.clearBtn}
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
                        <small>({c.telefono})</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.col}>
                <label className={styles.label}>Teléfono (Editable)</label>
                <input
                  className={styles.input}
                  value={telefonoEditable}
                  onChange={(e) => setTelefonoEditable(e.target.value)}
                  placeholder="Sin teléfono"
                />
                <small
                  style={{
                    color: "#64748b",
                    fontSize: "0.75rem",
                    marginTop: 4,
                  }}
                >
                  * Modificar este número actualizará el contacto del cliente en
                  la base de datos.
                </small>
              </div>
            </div>
          ) : (
            <div className={styles.row}>
              <div className={styles.col}>
                <label className={styles.label}>Nombre Nuevo *</label>
                <input
                  name="nuevo_nombre"
                  className={styles.input}
                  value={formData.nuevo_nombre}
                  onChange={handleChange}
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
                />
              </div>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Datos Técnicos</div>
          <div className={styles.row}>
            <div className={styles.col}>
              <label className={styles.label}>Placa</label>
              <input
                name="placa"
                className={`${styles.input} ${styles.placaInput}`}
                value={formData.placa}
                onChange={handleChange}
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
              />
            </div>
            <div className={styles.col}>
              <label className={styles.label}>Modelo</label>
              <input
                name="modelo"
                className={styles.input}
                value={formData.modelo}
                onChange={handleChange}
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
              />
            </div>
            <div className={styles.col}>
              <label className={styles.label}>Color</label>
              <input
                name="color"
                className={styles.input}
                value={formData.color}
                onChange={handleChange}
              />
            </div>
            <div className={styles.col}>
              <label className={styles.label}>VIN</label>
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
              <label className={styles.label}>Notas</label>
              <textarea
                name="notas"
                className={styles.textarea}
                rows={3}
                value={formData.notas}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Link href={`/taller/vehiculos/${id}`} className={styles.btnCancel}>
            Cancelar
          </Link>
          <button type="submit" className={styles.btnSubmit} disabled={saving}>
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
