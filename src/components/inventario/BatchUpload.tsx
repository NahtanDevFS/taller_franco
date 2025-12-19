"use client";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Trash2, Save, Plus, Camera, Keyboard } from "lucide-react";
import styles from "./BatchUpload.module.css";
import BarcodeScanner from "@/components/ventas/BarcodeScanner";

interface ProductSimple {
  id: number;
  nombre: string;
  codigo_barras: string | null;
}

interface BatchUploadProps {
  onSuccess: () => void;
}

export default function BatchUpload({ onSuccess }: BatchUploadProps) {
  const [products, setProducts] = useState<ProductSimple[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");

  const [manualCode, setManualCode] = useState("");

  const [serialList, setSerialList] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/productos?type=all_batteries")
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch(() => toast.error("Error cargando productos"));
  }, []);

  useEffect(() => {
    if (selectedProductId && !showCamera && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [selectedProductId, showCamera]);

  const addSerial = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    if (serialList.includes(cleanCode)) {
      toast.warning(`El serial ${cleanCode} ya está en la lista`);
      return;
    }

    setSerialList((prev) => [cleanCode, ...prev]);
    toast.success("Serial agregado");

    setManualCode("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSerial(manualCode);
    }
  };

  const handleCameraDetected = (code: string) => {
    addSerial(code);
  };

  const handleSave = async () => {
    if (!selectedProductId || serialList.length === 0) return;
    setLoading(true);

    try {
      const res = await fetch("/api/seriales/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producto_id: selectedProductId,
          seriales: serialList,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Lote guardado: ${data.agregados} agregados.`);
      setSerialList([]);
      setManualCode("");
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {showCamera && (
        <BarcodeScanner
          onDetected={handleCameraDetected}
          onClose={() => setShowCamera(false)}
        />
      )}

      <div className={styles.header}>
        <h3 className={styles.title}>Ingreso de Lote (Seriales)</h3>
      </div>

      <div className={styles.gridForm}>
        <div className={styles.formGroup}>
          <label>1. Producto a ingresar</label>
          <select
            className={styles.select}
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(Number(e.target.value))}
          >
            <option value="">-- Seleccionar --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>

          <div className={styles.cameraWrapper}>
            <button
              className={styles.btnCamera}
              onClick={() => setShowCamera(true)}
              disabled={!selectedProductId}
              title={!selectedProductId ? "Selecciona un producto primero" : ""}
            >
              <Camera size={24} />
              <span>Abrir Cámara / Escáner</span>
            </button>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>2. Escaneo Manual (teclado)</label>

          <div className={styles.inputGroup}>
            <input
              ref={scanInputRef}
              type="text"
              className={styles.input}
              placeholder="Haz clic y escanea..."
              disabled={!selectedProductId}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            <button
              className={styles.btnAddManual}
              onClick={() => addSerial(manualCode)}
              disabled={!selectedProductId || !manualCode.trim()}
            >
              <Plus size={20} />
            </button>
          </div>

          <small className={styles.helperText}>
            <Keyboard size={14} />
            <span>
              Presiona <strong>Enter</strong> o <strong>+</strong> para agregar.
            </span>
          </small>
        </div>
      </div>

      {serialList.length > 0 && (
        <div className={styles.listContainer}>
          <div className={styles.listHeader}>
            <span>Seriales listos ({serialList.length})</span>
            <button
              className={styles.btnClear}
              onClick={() => setSerialList([])}
            >
              Limpiar todo
            </button>
          </div>

          <div className={styles.scrollArea}>
            {serialList.map((serial, index) => (
              <div key={`${serial}-${index}`} className={styles.listItem}>
                <span className={styles.serialText}>
                  #{serialList.length - index} - {serial}
                </span>
                <button
                  className={styles.btnDelete}
                  onClick={() =>
                    setSerialList((l) => l.filter((s) => s !== serial))
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            className={styles.btnSave}
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? (
              "Procesando..."
            ) : (
              <div className={styles.saveContent}>
                <Save size={18} /> Confirmar Ingreso de Lote
              </div>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
