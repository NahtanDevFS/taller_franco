"use client";
import { useState, useRef, useEffect } from "react";
import styles from "./ventas.module.css";
import { formatoQuetzal } from "@/lib/utils";
import { toast, Toaster } from "sonner";
import { Search, Trash2, Plus, Minus, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Interfaces extendidas para el carrito
interface CartItem {
  id: number;
  nombre: string;
  codigo_barras: string | null;
  precio: number;
  cantidad: number;
  subtotal: number;
  es_bateria: boolean;
  stock_max: number; // Para no vender más de lo que hay
  datos_extra?: {
    garantia_meses: number;
    codigo_casco?: string;
  } | null;
}

export default function POSPage() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingPay, setLoadingPay] = useState(false);

  // Estado para modal de batería
  const [batteryModalOpen, setBatteryModalOpen] = useState(false);
  const [pendingBattery, setPendingBattery] = useState<any | null>(null);
  const [warrantyData, setWarrantyData] = useState({ meses: 12, casco: "" });

  // Referencia para mantener el foco en el scanner
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Obtener usuario actual para saber quien hizo la venta
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
    };
    getUser();
    searchInputRef.current?.focus(); // Auto foco al entrar
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    //Intentamos buscar por código exacto
    const resExact = await fetch(
      `/api/productos/buscar-codigo?codigo=${query}`
    );

    if (resExact.ok) {
      const producto = await resExact.json();
      addItemToCart(producto);
      setQuery(""); //Limpiar el input para siguiente escaneo
      return;
    }

    // Si no es código exacto, buscamos por nombre del producto
    const resSearch = await fetch(`/api/productos?q=${query}&page=1`);
    const dataSearch = await resSearch.json();
    if (dataSearch.data && dataSearch.data.length > 0) {
      setSearchResults(dataSearch.data);
    } else {
      toast.error("Producto no encontrado");
      setSearchResults([]);
    }
  };

  const addItemToCart = (producto: any) => {
    // Verificar Stock
    if (producto.stock <= 0) {
      toast.error(`¡Sin stock! ${producto.nombre} está agotado.`);
      return;
    }

    // Verificar si es una batería
    if (producto.es_bateria) {
      setPendingBattery(producto);
      setWarrantyData({ meses: 12, casco: "" }); // Reset
      setBatteryModalOpen(true);
      return;
    }

    // Agregar al carrito normal
    addToCartFinal(producto);
  };

  const addToCartFinal = (producto: any, extraData: any = null) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === producto.id);

      // Si ya existe y no es batería (las baterías se agregan individualmente por los datos únicos que maneja)
      if (existing && !producto.es_bateria) {
        if (existing.cantidad + 1 > producto.stock) {
          toast.warning("Stock máximo alcanzado");
          return prev;
        }
        return prev.map((item) =>
          item.id === producto.id
            ? {
                ...item,
                cantidad: item.cantidad + 1,
                subtotal: (item.cantidad + 1) * item.precio,
              }
            : item
        );
      }

      return [
        ...prev,
        {
          id: producto.id,
          nombre: producto.nombre,
          codigo_barras: producto.codigo_barras,
          precio: parseFloat(producto.precio),
          cantidad: 1,
          subtotal: parseFloat(producto.precio),
          es_bateria: producto.es_bateria,
          stock_max: producto.stock,
          datos_extra: extraData,
        },
      ];
    });

    toast.success("Agregado");
    setSearchResults([]); // Limpiar resultados visuales
    setQuery("");
    searchInputRef.current?.focus(); // Devolver foco al scanner
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = item.cantidad + delta;
          if (newQty < 1) return item; // No bajar de 1
          if (newQty > item.stock_max) {
            toast.warning("No hay suficiente stock");
            return item;
          }
          return { ...item, cantidad: newQty, subtotal: newQty * item.precio };
        }
        return item;
      })
    );
  };

  const removeItem = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  //lógica para el cobro
  const total = cart.reduce((acc, item) => acc + item.subtotal, 0);

  const handlePay = async () => {
    if (cart.length === 0) return;
    setLoadingPay(true);

    try {
      const payload = {
        usuario_id: userId, // ID del usuario logueado
        total: total,
        items: cart.map((item) => ({
          producto_id: item.id,
          cantidad: item.cantidad,
          precio: item.precio,
          datos_extra: item.datos_extra,
        })),
      };

      const res = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error al procesar venta");

      toast.success("Venta realizada con éxito");
      setCart([]); //limpia el carrito de compras
      setSearchResults([]);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingPay(false);
    }
  };

  return (
    <div className={styles.container}>
      <Toaster position="top-center" richColors />

      <div className={styles.leftPanel}>
        <form onSubmit={handleSearch} className={styles.searchSection}>
          <Search color="var(--color-primary)" />
          <input
            ref={searchInputRef}
            className={styles.searchInput}
            placeholder="Escanear código o buscar producto..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button type="submit" style={{ display: "none" }}>
            Buscar
          </button>
        </form>

        <div className={styles.resultsGrid}>
          {searchResults.map((p) => (
            <div
              key={p.id}
              className={styles.productCard}
              onClick={() => addItemToCart(p)}
            >
              <div>
                <div className={styles.cardTitle}>{p.nombre}</div>
                <small style={{ color: "#666" }}>
                  {p.marca_nombre} - Stock: {p.stock}
                </small>
              </div>
              <div className={styles.cardPrice}>
                {formatoQuetzal.format(p.precio)}
              </div>
            </div>
          ))}
          {searchResults.length === 0 && !query && (
            <div style={{ textAlign: "center", padding: 50, color: "#aaa" }}>
              <ShoppingCart size={48} style={{ marginBottom: 10 }} />
              <p>Escanea un producto para empezar</p>
            </div>
          )}
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.cartHeader}>
          <h2>Ticket de Venta</h2>
          <small>{new Date().toLocaleDateString()}</small>
        </div>

        <div className={styles.cartItems}>
          {cart.length === 0 ? (
            <p style={{ textAlign: "center", color: "#999", marginTop: 20 }}>
              Carrito vacío
            </p>
          ) : (
            cart.map((item, index) => (
              <div key={`${item.id}-${index}`} className={styles.cartItem}>
                <div className={styles.itemInfo}>
                  <div style={{ fontWeight: "bold" }}>{item.nombre}</div>
                  <small>{formatoQuetzal.format(item.precio)} c/u</small>
                  {item.es_bateria && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--color-primary)",
                      }}
                    >
                      Garantía: {item.datos_extra?.garantia_meses} meses
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                  }}
                >
                  <div style={{ fontWeight: "bold" }}>
                    {formatoQuetzal.format(item.subtotal)}
                  </div>

                  <div className={styles.qtyControl}>
                    <button
                      className={styles.qtyBtn}
                      onClick={() => updateQuantity(item.id, -1)}
                    >
                      <Minus size={12} />
                    </button>
                    <span>{item.cantidad}</span>
                    <button
                      className={styles.qtyBtn}
                      onClick={() => updateQuantity(item.id, 1)}
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        marginLeft: 5,
                        color: "#ef4444",
                      }}
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.cartFooter}>
          <div className={styles.totalRow}>
            <span>Total</span>
            <span>{formatoQuetzal.format(total)}</span>
          </div>
          <button
            className={styles.payButton}
            onClick={handlePay}
            disabled={cart.length === 0 || loadingPay}
          >
            {loadingPay ? "Procesando..." : "Cobrar"}
          </button>
        </div>
      </div>

      {batteryModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 style={{ marginTop: 0 }}>Detalles de Batería</h3>
            <p>
              Producto: <b>{pendingBattery?.nombre}</b>
            </p>

            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", marginBottom: 5 }}>
                Meses de Garantía
              </label>
              <input
                type="number"
                value={warrantyData.meses}
                onChange={(e) =>
                  setWarrantyData({
                    ...warrantyData,
                    meses: parseInt(e.target.value),
                  })
                }
                style={{
                  width: "100%",
                  padding: 8,
                  border: "1px solid #ccc",
                  borderRadius: 4,
                }}
              />
            </div>

            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", marginBottom: 5 }}>
                Código de Casco (Opcional)
              </label>
              <input
                type="text"
                value={warrantyData.casco}
                onChange={(e) =>
                  setWarrantyData({ ...warrantyData, casco: e.target.value })
                }
                placeholder="Ej: B-12345"
                style={{
                  width: "100%",
                  padding: 8,
                  border: "1px solid #ccc",
                  borderRadius: 4,
                }}
              />
            </div>

            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
            >
              <button
                onClick={() => setBatteryModalOpen(false)}
                style={{
                  padding: "8px 15px",
                  border: "none",
                  background: "#eee",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  addToCartFinal(pendingBattery, {
                    garantia_meses: warrantyData.meses,
                    codigo_casco: warrantyData.casco,
                  });
                  setBatteryModalOpen(false);
                }}
                style={{
                  padding: "8px 15px",
                  border: "none",
                  background: "var(--color-primary)",
                  color: "white",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
