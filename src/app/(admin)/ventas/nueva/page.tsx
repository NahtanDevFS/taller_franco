"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./ventas.module.css";
import { formatoQuetzal, formatUnit } from "@/lib/utils";
import { toast, Toaster } from "sonner";
import {
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  ScanBarcode,
  ArrowLeft,
  Box,
  Droplets,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BarcodeScanner from "@/components/ventas/BarcodeScanner";

interface CartItem {
  id: number;
  nombre: string;
  codigo_barras: string | null;
  precio: number;
  cantidad: number;
  subtotal: number;
  es_bateria: boolean;
  requiere_serial: boolean;
  stock_max: number;
  datos_extra?: {
    descripcion_personalizada?: string;
    es_item_libre?: boolean;
    es_liquido?: boolean;
    es_item_parcial?: boolean;
    parcial_id?: number;
    descripcion_unidad?: string;
    numero_serie?: string;
    garantia_meses?: number;
    costo_custom?: number;
    [key: string]: any;
  } | null;
}

function POSContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("id");

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingPay, setLoadingPay] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [clientName, setClientName] = useState("");
  const [isPending, setIsPending] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);

  const [customItemModalOpen, setCustomItemModalOpen] = useState(false);
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  const [customItemData, setCustomItemData] = useState({
    tipo: "servicio",
    descripcion: "",
    precio: "",
    precio_compra: "",
  });

  const [liquidModalOpen, setLiquidModalOpen] = useState(false);
  const [pendingLiquidProduct, setPendingLiquidProduct] = useState<any | null>(
    null
  );
  const [liquidQuantity, setLiquidQuantity] = useState("");

  const [serialModalOpen, setSerialModalOpen] = useState(false);
  const [pendingSerialProduct, setPendingSerialProduct] = useState<any | null>(
    null
  );
  const [serialInput, setSerialInput] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const serialInputRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [discount, setDiscount] = useState<string>("");

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
    };
    getUser();
    setIdempotencyKey(crypto.randomUUID());
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (serialModalOpen && serialInputRef.current) {
      setTimeout(() => serialInputRef.current?.focus(), 100);
    }
  }, [serialModalOpen]);

  useEffect(() => {
    if (editId) {
      cargarVentaExistente(editId);
    }
  }, [editId]);

  const cargarVentaExistente = async (id: string) => {
    setIsLoadingData(true);
    try {
      const res = await fetch(`/api/ventas/${id}`);
      if (!res.ok) throw new Error("No se pudo cargar la venta");

      const data = await res.json();
      setClientName(data.cliente || "");
      setIsPending(data.estado === "pendiente");
      setDiscount(data.descuento || 0);

      const itemsFormateados = data.detalles.map((d: any) => {
        const prod = d.producto || {};
        const attrs = prod.atributos || {};
        const requiereSerial = prod.requiere_serial || false;
        const permiteFraccion = prod.permite_fraccion || false;
        const capacidad = parseFloat(attrs.capacidad || prod.capacidad || 1);

        const stockEnDb = parseFloat(prod.stock || 0);

        let stockMaxDisponible;

        //const fueVendidoComoLiquido = d.datos_extra?.es_liquido;

        if (permiteFraccion) {
          const stockBodegaLitros =
            prod.origen === "parcial" ? stockEnDb : stockEnDb * capacidad;

          stockMaxDisponible = stockBodegaLitros + parseFloat(d.cantidad);
        } else {
          stockMaxDisponible = stockEnDb + parseFloat(d.cantidad);
        }

        //const esBateria = d.producto?.tiene_garantia || d.producto_es_bateria;

        return {
          id: d.producto_id,
          nombre: d.datos_extra?.descripcion_personalizada
            ? d.datos_extra.descripcion_personalizada.toUpperCase()
            : prod.nombre || d.producto_nombre,

          codigo_barras: d.codigo_barras,
          precio: parseFloat(d.precio_unitario),
          cantidad: parseFloat(d.cantidad),
          subtotal: parseFloat(d.subtotal),

          es_bateria: false,

          requiere_serial: requiereSerial || !!d.datos_extra?.numero_serie,

          stock_max: stockMaxDisponible,
          datos_extra: d.datos_extra,
        };
      });

      setCart(itemsFormateados);
    } catch (error) {
      toast.error("Error cargando venta para editar");
      router.push("/ventas");
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    const resExact = await fetch(
      `/api/productos/buscar-codigo?codigo=${query}`
    );
    if (resExact.ok) {
      const producto = await resExact.json();
      addItemToCart(producto);
      setQuery("");
      return;
    }

    const resSearch = await fetch(`/api/productos?q=${query}&page=1`);
    const dataSearch = await resSearch.json();
    if (dataSearch.data && dataSearch.data.length > 0) {
      setSearchResults(dataSearch.data);
    } else {
      toast.error("Producto no encontrado");
      setSearchResults([]);
    }
  };

  const handleScanDetected = async (code: string) => {
    if (serialModalOpen) {
      setSerialInput(code);
      toast.success("Serial escaneado");
      return;
    }
    setScannerOpen(false);
    toast.info(`Código detectado: ${code}`);

    const resExact = await fetch(`/api/productos/buscar-codigo?codigo=${code}`);
    if (resExact.ok) {
      const producto = await resExact.json();
      addItemToCart(producto);
    } else {
      setQuery(code);
      const resSearch = await fetch(`/api/productos?q=${code}&page=1`);
      const dataSearch = await resSearch.json();
      if (dataSearch.data && dataSearch.data.length > 0) {
        setSearchResults(dataSearch.data);
      } else {
        toast.error("Producto no encontrado");
      }
    }
  };

  const addItemToCart = (productoRaw: any) => {
    const attrs = productoRaw.atributos || {};
    const producto = {
      ...productoRaw,
      stock: parseFloat(productoRaw.stock) || 0,
      precio: parseFloat(productoRaw.precio) || 0,
      capacidad: parseFloat(attrs.capacidad) || 1,
      unidad_medida: attrs.unidad_medida || "Unidades",
      es_liquido: productoRaw.permite_fraccion,
      tiene_garantia: productoRaw.tiene_garantia,
      requiere_serial: productoRaw.requiere_serial,
      es_bateria: false,
    };

    if (
      !editId &&
      producto.tipo === "producto" &&
      !producto.requiere_serial &&
      producto.stock <= 0
    ) {
      toast.error(`¡Sin stock! ${producto.nombre} está agotado.`);
      return;
    }

    if (producto.requiere_serial) {
      setPendingSerialProduct(producto);
      setSerialInput(producto.numero_serie_detectado || "");
      setSerialModalOpen(true);
      return;
    }

    if (producto.es_liquido && producto.tipo === "producto") {
      setPendingLiquidProduct(producto);
      setLiquidQuantity("");
      setLiquidModalOpen(true);
      return;
    }

    let extraData = null;
    if (producto.tiene_garantia) {
      extraData = {
        tiene_garantia: true,
        garantia_meses: attrs.garantia_meses
          ? parseInt(attrs.garantia_meses)
          : 12,
      };
    }

    addToCartFinal(producto, extraData);
  };
  const addToCartFinal = (
    producto: any,
    extraData: any = null,
    qtyOverride: number = 1
  ) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.id === producto.id &&
          JSON.stringify(item.datos_extra) === JSON.stringify(extraData)
      );

      let stockMaxReal = producto.stock;

      if (producto.es_liquido && producto.tipo === "producto") {
        if (producto.origen === "parcial") {
          stockMaxReal = producto.stock;
        } else {
          stockMaxReal = producto.stock * producto.capacidad;
        }
      }

      if (existingIndex !== -1) {
        if (producto.requiere_serial) {
          toast.warning("Este número de serie ya está en el carrito.");
          return prev;
        }

        const existing = prev[existingIndex];
        const nuevoTotal = existing.cantidad + qtyOverride;

        if (producto.tipo === "producto" && nuevoTotal > stockMaxReal) {
          const unidad = producto.es_liquido
            ? producto.unidad_medida || "L"
            : "unidades";
          toast.warning(
            `Stock insuficiente. Disponible: ${stockMaxReal} ${unidad}`
          );
          return prev;
        }

        const updatedCart = [...prev];
        updatedCart[existingIndex] = {
          ...existing,
          cantidad: nuevoTotal,
          subtotal: nuevoTotal * existing.precio,
        };
        return updatedCart;
      }

      return [
        ...prev,
        {
          id: producto.id,
          nombre: producto.nombre,
          codigo_barras: producto.codigo_barras,
          precio: parseFloat(producto.precio),
          cantidad: qtyOverride,
          subtotal: parseFloat(producto.precio) * qtyOverride,
          es_bateria: producto.es_bateria || !!extraData?.es_bateria,
          requiere_serial:
            producto.requiere_serial || !!extraData?.numero_serie,
          stock_max: stockMaxReal,
          datos_extra: extraData,
        },
      ];
    });

    if (!extraData?.es_liquido && !producto.requiere_serial)
      toast.success("Agregado");
    setSearchResults([]);
    setQuery("");
    searchInputRef.current?.focus();
  };

  const confirmLiquidAdd = () => {
    if (!pendingLiquidProduct || !liquidQuantity) return;
    const qty = parseFloat(liquidQuantity);

    if (isNaN(qty) || qty <= 0) {
      toast.error("Cantidad inválida");
      return;
    }

    let stockDisponibleLitros = 0;
    if (pendingLiquidProduct.origen === "parcial") {
      stockDisponibleLitros = pendingLiquidProduct.stock;
    } else {
      stockDisponibleLitros =
        pendingLiquidProduct.stock * pendingLiquidProduct.capacidad;
    }

    if (qty > stockDisponibleLitros) {
      toast.error(
        `Solo quedan ${stockDisponibleLitros} ${pendingLiquidProduct.unidad_medida}`
      );
      return;
    }

    let precioPorUnidadMedida = pendingLiquidProduct.precio;

    if (pendingLiquidProduct.capacidad > 0) {
      precioPorUnidadMedida =
        pendingLiquidProduct.precio / pendingLiquidProduct.capacidad;
    }

    const extra = {
      es_liquido: true,
      es_item_parcial: pendingLiquidProduct.origen === "parcial",
      parcial_id: pendingLiquidProduct.parcial_id,
      descripcion_unidad: pendingLiquidProduct.unidad_medida,
      unidad_medida: pendingLiquidProduct.unidad_medida,
    };

    addToCartFinal(
      {
        ...pendingLiquidProduct,
        precio: precioPorUnidadMedida,
        stock: pendingLiquidProduct.stock,
      },
      extra,
      qty
    );

    setLiquidModalOpen(false);
    setPendingLiquidProduct(null);
  };

  const confirmSerialAdd = () => {
    if (!pendingSerialProduct || !serialInput.trim()) return;
    const yaEnCarrito = cart.some(
      (item) =>
        item.id === pendingSerialProduct.id &&
        item.datos_extra?.numero_serie === serialInput.trim()
    );
    if (yaEnCarrito) {
      toast.error("Este número de serie ya fue agregado al carrito");
      setSerialInput("");
      return;
    }
    const extra = {
      numero_serie: serialInput.trim(),
      garantia_meses: pendingSerialProduct.garantia_meses || 0,
    };
    addToCartFinal(pendingSerialProduct, extra, 1);
    toast.success(`Producto con serie ${serialInput} agregado`);
    setSerialModalOpen(false);
    setPendingSerialProduct(null);
    setSerialInput("");
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const newCart = [...prev];
      const item = newCart[index];
      const newQty = parseFloat((item.cantidad + delta).toFixed(2));

      if (newQty < 0.01) return prev;
      if (item.requiere_serial && newQty > 1) {
        toast.warning("Los productos seriales se agregan uno por uno.");
        return prev;
      }

      if (newQty > item.stock_max) {
        const unidad = item.datos_extra?.es_liquido
          ? item.datos_extra.descripcion_unidad || "L"
          : "unidades";
        toast.warning(`Stock insuficiente (Máx: ${item.stock_max} ${unidad})`);
        return prev;
      }

      newCart[index] = {
        ...item,
        cantidad: newQty,
        subtotal: newQty * item.precio,
      };
      return newCart;
    });
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleManualQuantity = (index: number, valueStr: string) => {
    if (valueStr === "") {
      setCart((prev) => {
        const newCart = [...prev];
        newCart[index].cantidad = 0;
        return newCart;
      });
      return;
    }

    const value = parseFloat(valueStr);
    if (isNaN(value)) return;

    setCart((prev) => {
      const item = prev[index];

      if (!editId && value > item.stock_max) {
        const unidad = item.datos_extra?.es_liquido
          ? item.datos_extra.descripcion_unidad || "L"
          : "unidades";
        toast.warning(`Máximo disponible: ${item.stock_max} ${unidad}`);

        const adjustedQty = item.stock_max;

        const newCart = [...prev];
        newCart[index] = {
          ...item,
          cantidad: adjustedQty,
          subtotal: adjustedQty * item.precio,
        };
        return newCart;
      }

      const newCart = [...prev];
      newCart[index] = {
        ...item,
        cantidad: value,
        subtotal: value * item.precio,
      };
      return newCart;
    });
  };

  const addCustomItem = async () => {
    if (!customItemData.descripcion || !customItemData.precio) {
      toast.error("Completa descripción y precio");
      return;
    }

    setIsAddingCustom(true);

    const codigoBuscar =
      customItemData.tipo === "servicio" ? "GEN-SERV" : "GEN-EXT";
    try {
      const res = await fetch(
        `/api/productos/buscar-codigo?codigo=${codigoBuscar}`
      );
      if (!res.ok) throw new Error("No se encontraron productos genéricos");
      const productoGenerico = await res.json();

      const precioVenta = parseFloat(customItemData.precio);
      let costo = 0;

      // Si es producto externo, verificamos si hay precio de compra (costo)
      if (customItemData.tipo === "tercero") {
        if (customItemData.precio_compra) {
          costo = parseFloat(customItemData.precio_compra);
        } else {
          // Si no se especifica, el costo es igual al precio de venta
          costo = precioVenta;
        }
      }

      const itemParaCarrito = {
        ...productoGenerico,
        nombre: customItemData.descripcion.toUpperCase(),
        precio: parseFloat(customItemData.precio),
        requiere_serial: false,
        stock: 9999,
        datos_extra: {
          descripcion_personalizada: customItemData.descripcion,
          es_item_libre: true,
          costo_custom: costo,
        },
      };
      addToCartFinal(itemParaCarrito, itemParaCarrito.datos_extra);
      setCustomItemModalOpen(false);
      setCustomItemData({
        tipo: "servicio",
        descripcion: "",
        precio: "",
        precio_compra: "",
      });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsAddingCustom(false);
    }
  };

  const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const discountValue = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountValue);

  const handlePay = async () => {
    if (cart.length === 0) return;
    if (discountValue > subtotal) {
      toast.error("El descuento no puede ser mayor al total");
      return;
    }
    setLoadingPay(true);
    try {
      const payload = {
        usuario_id: userId,
        cliente: clientName || "CF",
        total: total,
        descuento: discountValue,
        estado: isPending ? "pendiente" : "completada",
        idempotency_key: idempotencyKey,
        items: cart.map((item) => ({
          producto_id: item.id,
          cantidad: item.cantidad,
          precio: item.precio,
          datos_extra: item.datos_extra,
        })),
      };
      const url = editId ? `/api/ventas/${editId}` : "/api/ventas";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 || data.error === "DUPLICATE_TRANSACTION") {
          toast.warning("Venta ya procesada.");
          setCart([]);
          setClientName("");
          setIsPending(false);
          setDiscount("");
          setIdempotencyKey(crypto.randomUUID());
          return;
        }
        throw new Error(data.error || "Error");
      }
      toast.success(editId ? "Venta actualizada" : "Venta registrada");
      if (editId) router.push("/ventas");
      else {
        setCart([]);
        setSearchResults([]);
        setClientName("");
        setIsPending(false);
        setDiscount("");
        setIdempotencyKey(crypto.randomUUID());
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingPay(false);
    }
  };

  if (isLoadingData) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        Cargando datos...
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      {scannerOpen && (
        <BarcodeScanner
          onDetected={handleScanDetected}
          onClose={() => setScannerOpen(false)}
        />
      )}
      <div className={styles.container}>
        <div className={styles.leftPanel}>
          <Link href="/ventas" style={{ textDecoration: "none" }}>
            <button className={styles.backButton}>
              <ArrowLeft size={20} style={{ marginRight: 5 }} />
              Regresar al Historial
            </button>
          </Link>
          <form onSubmit={handleSearch} className={styles.searchSection}>
            <p>Pulsa enter para buscar</p>
            <div className={styles.searchSectionItems}>
              <input
                ref={searchInputRef}
                className={styles.searchInput}
                placeholder="Código de barras o nombre"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <button type="submit" style={{ display: "none" }}>
                Buscar
              </button>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className={styles.scanButton}
                title="Abrir Cámara"
              >
                <ScanBarcode size={20} />
              </button>
            </div>
            <div style={{ marginTop: 10, marginBottom: 20 }}>
              <button
                onClick={() => setCustomItemModalOpen(true)}
                className={styles.btnSecondary}
              >
                + Agregar Mano de Obra / Externo
              </button>
            </div>
          </form>

          <div className={styles.resultsGrid}>
            {searchResults.map((p) => (
              <div
                key={p.origen === "parcial" ? `parcial-${p.parcial_id}` : p.id}
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
          <div className={styles.clientInputContainer}>
            <input
              className={styles.clientInput}
              placeholder="Nombre del Cliente (opcional)"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
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
                    {item.requiere_serial && item.datos_extra?.numero_serie && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#ea580c",
                          marginTop: 2,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <Box size={12} style={{ marginRight: 4 }} />
                        SN: {item.datos_extra.numero_serie}
                      </div>
                    )}
                    {item.datos_extra?.es_liquido && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--color-primary)",
                          marginTop: 2,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <Droplets size={12} style={{ marginRight: 4 }} />
                        {item.datos_extra.es_item_parcial
                          ? "Granel"
                          : "Líquido"}
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
                        onClick={() => updateQuantity(index, -1)}
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.cantidad === 0 ? "" : item.cantidad}
                        onChange={(e) =>
                          handleManualQuantity(index, e.target.value)
                        }
                        style={{
                          width: "60px",
                          textAlign: "center",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          margin: "0 5px",
                          fontSize: "0.9rem",
                        }}
                      />
                      {item.datos_extra?.descripcion_unidad ? (
                        <span
                          style={{
                            fontSize: "0.7rem",
                            color: "#666",
                            marginRight: "5px",
                          }}
                        >
                          {formatUnit(item.datos_extra.descripcion_unidad)}
                        </span>
                      ) : null}
                      <button
                        className={styles.qtyBtn}
                        onClick={() => updateQuantity(index, 1)}
                        disabled={item.requiere_serial}
                        style={
                          item.requiere_serial
                            ? { opacity: 0.5, cursor: "not-allowed" }
                            : {}
                        }
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
                        onClick={() => removeItem(index)}
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
            <div
              style={{
                marginBottom: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "0.9rem", color: "#666" }}>
                Subtotal:
              </span>
              <span style={{ fontWeight: "bold" }}>
                {formatoQuetzal.format(subtotal)}
              </span>
            </div>
            <div
              style={{
                marginBottom: 15,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <label
                style={{
                  fontSize: "0.9rem",
                  color: "#ef4444",
                  fontWeight: "bold",
                }}
              >
                Descuento (Q):
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={discount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (val > subtotal) {
                    toast.error("Descuento excede el subtotal");
                    return;
                  }
                  setDiscount(e.target.value);
                }}
                className={styles.searchInput}
                style={{
                  width: 100,
                  textAlign: "right",
                  padding: "5px",
                  border: "1px solid #ef4444",
                  color: "#ef4444",
                  fontWeight: "bold",
                }}
              />
            </div>
            <div className={styles.totalRow}>
              <span>Total</span>
              <span>{formatoQuetzal.format(total)}</span>
            </div>
            <div className={styles.pendingWrapper}>
              <input
                type="checkbox"
                id="pendingCheck"
                checked={isPending}
                onChange={(e) => setIsPending(e.target.checked)}
                style={{ width: 20, height: 20, cursor: "pointer" }}
              />
              <label
                htmlFor="pendingCheck"
                className={`${styles.pendingLabel} ${
                  isPending ? styles.pendingLabelActive : ""
                }`}
              >
                {isPending ? "Cobro inmediato" : "Venta pendiente de pago"}
              </label>
            </div>
            <button
              className={`${styles.payButton} ${
                isPending ? styles.payButtonPending : ""
              }`}
              onClick={handlePay}
              disabled={cart.length === 0 || loadingPay}
            >
              {loadingPay
                ? "Procesando..."
                : isPending
                ? "Guardar Pendiente"
                : "Cobrar"}
            </button>
          </div>
        </div>

        {customItemModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <h3 style={{ marginTop: 0, color: "var(--color-secondary)" }}>
                Agregar Concepto Libre
              </h3>
              <div style={{ marginBottom: 15 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 5,
                    fontWeight: "bold",
                  }}
                >
                  Tipo
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomItemData({ ...customItemData, tipo: "servicio" })
                    }
                    disabled={isAddingCustom}
                    style={{
                      cursor: isAddingCustom ? "not-allowed" : "pointer",
                      opacity: isAddingCustom ? 0.6 : 1,
                    }}
                    className={`${styles.typeBtn} ${
                      customItemData.tipo === "servicio"
                        ? styles.typeBtnActiveSecondary
                        : ""
                    }`}
                  >
                    Mano de obra
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomItemData({ ...customItemData, tipo: "tercero" })
                    }
                    disabled={isAddingCustom}
                    style={{
                      cursor: isAddingCustom ? "not-allowed" : "pointer",
                      opacity: isAddingCustom ? 0.6 : 1,
                    }}
                    className={`${styles.typeBtn} ${
                      customItemData.tipo === "tercero"
                        ? styles.typeBtnActivePrimary
                        : ""
                    }`}
                  >
                    Producto externo
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 15 }}>
                <label className={styles.label}>Descripción</label>
                <input
                  className={styles.searchInput}
                  placeholder="mano de obra o producto..."
                  value={customItemData.descripcion}
                  disabled={isAddingCustom}
                  onChange={(e) =>
                    setCustomItemData({
                      ...customItemData,
                      descripcion: e.target.value,
                    })
                  }
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className={styles.label}>Precio Venta (Q)</label>
                <input
                  type="number"
                  className={styles.searchInput}
                  placeholder="0.00"
                  value={customItemData.precio}
                  disabled={isAddingCustom}
                  onChange={(e) =>
                    setCustomItemData({
                      ...customItemData,
                      precio: e.target.value,
                    })
                  }
                />
              </div>

              {customItemData.tipo === "tercero" && (
                <div style={{ marginBottom: 20 }}>
                  <label className={styles.label}>
                    Precio Compra (Q) - <small>Opcional</small>
                  </label>
                  <input
                    type="number"
                    className={styles.searchInput}
                    placeholder="Igual al de venta si se deja vacío"
                    value={customItemData.precio_compra}
                    disabled={isAddingCustom}
                    onChange={(e) =>
                      setCustomItemData({
                        ...customItemData,
                        precio_compra: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
              >
                <button
                  onClick={() => setCustomItemModalOpen(false)}
                  disabled={isAddingCustom}
                  style={{
                    padding: "10px 20px",
                    border: "1px solid #ccc",
                    background: "transparent",
                    borderRadius: 8,
                    cursor: isAddingCustom ? "not-allowed" : "pointer",
                    opacity: isAddingCustom ? 0.6 : 1,
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={addCustomItem}
                  disabled={isAddingCustom}
                  className={styles.payButton}
                  style={{
                    width: "auto",
                    padding: "10px 25px",
                    opacity: isAddingCustom ? 0.7 : 1,
                    cursor: isAddingCustom ? "not-allowed" : "pointer",
                  }}
                >
                  {isAddingCustom ? "Agregando..." : "Agregar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {liquidModalOpen && pendingLiquidProduct && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <h3 style={{ marginTop: 0, color: "var(--color-primary)" }}>
                Venta de Líquido / Granel
              </h3>
              <p>
                Producto: <b>{pendingLiquidProduct.nombre}</b>
              </p>
              {pendingLiquidProduct.origen === "parcial" ? (
                <div
                  style={{
                    background: "#e0f2fe",
                    padding: 10,
                    borderRadius: 4,
                    marginBottom: 15,
                    fontSize: "0.9rem",
                  }}
                >
                  <b>Botella Abierta</b>
                  <br />
                  Disponible: {pendingLiquidProduct.stock}{" "}
                  {pendingLiquidProduct.unidad_medida}
                </div>
              ) : (
                <div
                  style={{
                    background: "#f0fdf4",
                    padding: 10,
                    borderRadius: 4,
                    marginBottom: 15,
                    fontSize: "0.9rem",
                  }}
                >
                  <b>Botella Nueva (Cerrada)</b>
                  <br />
                  Capacidad: {pendingLiquidProduct.capacidad}{" "}
                  {pendingLiquidProduct.unidad_medida}
                </div>
              )}
              <div style={{ marginBottom: 20 }}>
                <label className={styles.label}>
                  Cantidad a Vender ({pendingLiquidProduct.unidad_medida})
                </label>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  className={styles.searchInput}
                  placeholder="Ej: 0.5, 1.5..."
                  value={liquidQuantity}
                  onChange={(e) => setLiquidQuantity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmLiquidAdd()}
                />
              </div>
              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
              >
                <button
                  onClick={() => setLiquidModalOpen(false)}
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
                <button
                  onClick={confirmLiquidAdd}
                  className={styles.payButton}
                  style={{ width: "auto", padding: "10px 25px" }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {serialModalOpen && pendingSerialProduct && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <h3 style={{ marginTop: 0, color: "#ea580c" }}>
                Producto Serial
              </h3>
              <p style={{ marginBottom: 10 }}>
                Estás agregando: <b>{pendingSerialProduct.nombre}</b>
              </p>
              <p
                style={{ fontSize: "0.9rem", color: "#666", marginBottom: 15 }}
              >
                Este producto requiere registrar el número de serie único de la
                unidad que se entrega.
              </p>
              <div style={{ marginBottom: 20 }}>
                <label className={styles.label}>
                  Escanear o Escribir N° Serie
                </label>
                <div style={{ display: "flex", gap: 5 }}>
                  <input
                    ref={serialInputRef}
                    className={styles.searchInput}
                    placeholder="Escanea el código del serial..."
                    value={serialInput}
                    onChange={(e) => setSerialInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirmSerialAdd()}
                  />
                  <button
                    onClick={() => setScannerOpen(true)}
                    className={styles.scanButton}
                    title="Abrir cámara"
                  >
                    <ScanBarcode size={20} />
                  </button>
                </div>
              </div>
              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
              >
                <button
                  onClick={() => setSerialModalOpen(false)}
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
                <button
                  onClick={confirmSerialAdd}
                  className={styles.payButton}
                  style={{
                    width: "auto",
                    padding: "10px 25px",
                    background: "#ea580c",
                  }}
                >
                  Confirmar Serial
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
export default function POSPage() {
  return (
    <Suspense fallback={<div>Cargando editor de ventas...</div>}>
      <POSContent />
    </Suspense>
  );
}
