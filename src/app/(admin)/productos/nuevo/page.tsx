"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, ScanBarcode } from "lucide-react";
import { Toaster, toast } from "sonner";
import { calcularPrecioVenta } from "@/lib/utils";
import BarcodeScanner from "@/components/ventas/BarcodeScanner";
import styles from "./productoForm.module.css";

function ProductFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [isLoading, setIsLoading] = useState(false);
  const [marcas, setMarcas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [isManualMarca, setIsManualMarca] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);

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
    es_bateria: false,
    es_liquido: false,
    capacidad: 1,
    unidad_medida: "Litros",
  };

  const [formData, setFormData] = useState(initialFormState);

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
        toast.error("Error cargando listas");
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    if (editId) {
      const fetchProducto = async () => {
        setIsLoading(true);
        try {
          const res = await fetch(`/api/productos/${editId}`);
          if (!res.ok) throw new Error("Producto no encontrado");
          const data = await res.json();

          setFormData({
            nombre: data.nombre,
            codigo_barras: data.codigo_barras || "",
            costo: 0,
            precio: parseFloat(data.precio),
            stock: data.stock,
            stock_minimo: data.stock_minimo,
            marca_id: data.marca_id ? data.marca_id.toString() : "",
            nueva_marca_nombre: "",
            categoria_id: data.categoria_id ? data.categoria_id.toString() : "",
            es_bateria: data.es_bateria || false,
            es_liquido: data.es_liquido || false,
            capacidad: data.capacidad || 1,
            unidad_medida: data.unidad_medida || "Litros",
          });
        } catch (error) {
          toast.error("Error al cargar producto");
          router.push("/productos");
        } finally {
          setIsLoading(false);
        }
      };
      fetchProducto();
    }
  }, [editId, router]);

  const handleCostoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const costo = parseFloat(e.target.value) || 0;
    const precioSugerido = calcularPrecioVenta(costo);
    setFormData((prev) => ({ ...prev, costo, precio: precioSugerido }));
  };

  const handleCategoriaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const catId = e.target.value;
    const isBattery = catId === "6";
    setFormData((prev) => ({
      ...prev,
      categoria_id: catId,
      es_bateria: isBattery,
    }));
  };

  const handleScanDetected = (code: string) => {
    setFormData((prev) => ({ ...prev, codigo_barras: code }));
    setScannerOpen(false);
    toast.success(`Código detectado: ${code}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const url = editId ? `/api/productos/${editId}` : "/api/productos";
    const method = editId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }

      toast.success(editId ? "Producto actualizado" : "Producto creado");
      router.push("/productos");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && editId) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>Cargando datos...</div>
    );
  }

  return (
    <div className={styles.container}>
      <Toaster position="top-right" richColors />

      {scannerOpen && (
        <BarcodeScanner
          onDetected={handleScanDetected}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <div className={styles.header}>
        <Link href="/productos" style={{ textDecoration: "none" }}>
          <button className={styles.backButton}>
            <ArrowLeft size={20} style={{ marginRight: 5 }} />
            Regresar
          </button>
        </Link>
        <h1 className={styles.title}>
          {editId ? `Editar: ${formData.nombre}` : "Nuevo Producto"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className={styles.formCard}>
        <h3 className={styles.sectionTitle}>Información general</h3>

        <div className={styles.formGroup}>
          <label className={styles.label}>Nombre del Repuesto*</label>
          <input
            className={styles.input}
            required
            value={formData.nombre}
            onChange={(e) =>
              setFormData({ ...formData, nombre: e.target.value })
            }
            placeholder="Ej. Aceite 20W-50"
          />
        </div>

        <div className={styles.row}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Código de barras</label>
            <div className={styles.inputGroup}>
              <button
                type="button"
                className={styles.scanButton}
                onClick={() => setScannerOpen(true)}
                title="Escanear código"
              >
                <ScanBarcode size={20} />
              </button>
              <input
                className={styles.input}
                value={formData.codigo_barras}
                onChange={(e) =>
                  setFormData({ ...formData, codigo_barras: e.target.value })
                }
                placeholder="Escanear o escribir..."
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Marca
              <span
                className={styles.linkBtn}
                onClick={() => setIsManualMarca(!isManualMarca)}
              >
                {isManualMarca ? "(Seleccionar existente)" : "(+ Crear nueva)"}
              </span>
            </label>

            {isManualMarca ? (
              <input
                className={styles.input}
                placeholder="Escribe la nueva marca..."
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
                className={styles.select}
                value={formData.marca_id}
                onChange={(e) =>
                  setFormData({ ...formData, marca_id: e.target.value })
                }
              >
                <option value="">Seleccionar Marca...</option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Categoría*</label>
          <select
            className={styles.select}
            required
            value={formData.categoria_id}
            onChange={handleCategoriaChange}
          >
            <option value="">Seleccionar Categoría...</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <h3 className={styles.sectionTitle} style={{ marginTop: 20 }}>
          Inventario y precios
        </h3>

        <div className={styles.row}>
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Costo (Q) <small>(Para cálculo)</small>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className={styles.input}
              value={formData.costo || ""}
              onChange={handleCostoChange}
              placeholder="0.00"
            />
          </div>
          <div className={styles.formGroup}>
            <label
              className={styles.label}
              style={{ color: "var(--color-primary)" }}
            >
              Precio venta (Q)*
            </label>
            <input
              type="number"
              step="0.01"
              required
              className={styles.input}
              value={formData.precio}
              onChange={(e) =>
                setFormData({ ...formData, precio: parseFloat(e.target.value) })
              }
              style={{ fontWeight: "bold" }}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Stock actual*</label>
            <input
              type="number"
              className={styles.input}
              required
              value={formData.stock}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  stock: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Stock mínimo*</label>
            <input
              type="number"
              required
              className={styles.input}
              value={formData.stock_minimo}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  stock_minimo: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>
        </div>

        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={formData.es_bateria}
              onChange={(e) =>
                setFormData({ ...formData, es_bateria: e.target.checked })
              }
              style={{ width: 18, height: 18 }}
            />
            Es Batería (garantía)
          </label>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={formData.es_liquido}
              onChange={(e) =>
                setFormData({ ...formData, es_liquido: e.target.checked })
              }
              style={{ width: 18, height: 18 }}
            />
            Es Líquido / Granel
          </label>
        </div>

        {formData.es_liquido && (
          <div className={styles.row} style={{ marginTop: 20 }}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Capacidad del Envase</label>
              <input
                type="number"
                step="0.01"
                className={styles.input}
                value={formData.capacidad}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    capacidad: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Unidad de Medida</label>
              <select
                className={styles.select}
                value={formData.unidad_medida}
                onChange={(e) =>
                  setFormData({ ...formData, unidad_medida: e.target.value })
                }
              >
                <option value="Litros">Litros</option>
                <option value="Mililitros">Mililitros</option>
                <option value="Galones">Galones</option>
              </select>
            </div>
          </div>
        )}

        <div className={styles.actionsFooter}>
          <Link href="/productos" style={{ textDecoration: "none" }}>
            <button type="button" className={styles.btnCancel}>
              Cancelar
            </button>
          </Link>
          <button
            type="submit"
            className={styles.btnSubmit}
            disabled={isLoading}
          >
            <Save size={18} />
            {isLoading ? "Guardando..." : "Guardar Producto"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ProductoFormPage() {
  return (
    <Suspense fallback={<div>Cargando editor...</div>}>
      <ProductFormContent />
    </Suspense>
  );
}
