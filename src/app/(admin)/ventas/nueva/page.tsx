"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./ventas.module.css";
import { formatoQuetzal, formatUnit } from "@/lib/utils";
import { toast, Toaster } from "sonner";
import { Trash2, Plus, Minus, ShoppingCart, ScanBarcode } from "lucide-react";
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
  stock_max: number;
  datos_extra?: {
    descripcion_personalizada?: string;
    es_item_libre?: boolean;
    es_liquido?: boolean;
    es_item_parcial?: boolean;
    parcial_id?: number;
    descripcion_unidad?: string;
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

  //estado para modal de concepto libre
  const [customItemModalOpen, setCustomItemModalOpen] = useState(false);
  const [customItemData, setCustomItemData] = useState({
    tipo: "servicio", //servicio o tercero
    descripcion: "",
    precio: "",
  });

  const [liquidModalOpen, setLiquidModalOpen] = useState(false);
  const [pendingLiquidProduct, setPendingLiquidProduct] = useState<any | null>(
    null
  );
  const [liquidQuantity, setLiquidQuantity] = useState("");

  //referencia para mantener el foco en el scanner
  const searchInputRef = useRef<HTMLInputElement>(null);

  //obtener usuario actual para saber quien hizo la venta
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
    //se genera el id solo en el cliente para evitar errores de hidratación
    setIdempotencyKey(crypto.randomUUID());
    searchInputRef.current?.focus(); //auto foco al entrar
  }, []);

  //lógica para cargar una venta para poder editarla
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

      //primero se carga el cliente y su estado
      setClientName(data.cliente || "");
      setIsPending(data.estado === "pendiente");
      setDiscount(data.descuento || 0);

      //ahora los datos del detalle de la venta se transforman para mostrarse en el carrito
      const itemsFormateados = data.detalles.map((d: any) => ({
        id: d.producto_id,
        //usamos la descripción personalizada o nombre del producto (puede ser null)
        nombre: d.datos_extra?.descripcion_personalizada
          ? d.datos_extra.descripcion_personalizada.toUpperCase()
          : d.producto_nombre,
        codigo_barras: d.codigo_barras,
        precio: parseFloat(d.precio_unitario),
        cantidad: parseFloat(d.cantidad),
        subtotal: parseFloat(d.subtotal),
        es_bateria: d.producto_es_bateria,
        //en edición simplificamos el stock max visual para no bloquear al usuario ya que la validación real se hará en el backend al guardar
        stock_max: 9999,
        datos_extra: d.datos_extra,
      }));

      setCart(itemsFormateados);
    } catch (error) {
      toast.error("Error cargando venta para editar");
      router.push("/ventas");
    } finally {
      setIsLoadingData(false);
    }
  };

  //lógica común para buscar código (ya sea por teclado o cámara)
  const processCodeSearch = async (code: string) => {
    //buscar coincidencia exacta
    const resExact = await fetch(`/api/productos/buscar-codigo?codigo=${code}`);

    if (resExact.ok) {
      const producto = await resExact.json();
      addItemToCart(producto);
      setQuery("");
      return true;
    }
    return false;
  };

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
      setQuery(""); //limpia el input para siguiente escaneo
      return;
    }

    //si no es código exacto, buscamos por nombre del producto ((like)
    const resSearch = await fetch(`/api/productos?q=${query}&page=1`);
    const dataSearch = await resSearch.json();
    if (dataSearch.data && dataSearch.data.length > 0) {
      setSearchResults(dataSearch.data);
    } else {
      toast.error("Producto no encontrado");
      setSearchResults([]);
    }
  };

  //callback cuando la cámara detecta algo
  const handleScanDetected = async (code: string) => {
    setScannerOpen(false); //cerramos el modal de cámara
    toast.info(`Código detectado: ${code}`); //feedback visual rápido

    const found = await processCodeSearch(code);
    if (!found) {
      //si no es un código exacto, intentamos buscarlo como texto por si acaso
      setQuery(code);
      toast.warning(
        "Código no registrado exactamente. Buscando coincidencias..."
      );
      //disparamos búsqueda por nombre/texto
      const resSearch = await fetch(`/api/productos?q=${code}&page=1`);
      const dataSearch = await resSearch.json();
      if (dataSearch.data && dataSearch.data.length > 0) {
        setSearchResults(dataSearch.data);
      } else {
        toast.error("Producto no encontrado en el sistema");
      }
    }
  };

  const addItemToCart = (producto: any) => {
    //verificar stock solo si no estoy en modo edición
    if (!editId && producto.tipo === "producto" && producto.stock <= 0) {
      toast.error(`¡Sin stock! ${producto.nombre} está agotado.`);
      return;
    }

    if (producto.es_liquido && producto.tipo === "producto") {
      setPendingLiquidProduct(producto);
      setLiquidQuantity("");
      setLiquidModalOpen(true);
      return;
    }

    const extraData = producto.es_bateria ? { es_bateria: true } : null;

    addToCartFinal(producto, extraData);
  };

  const addToCartFinal = (
    producto: any,
    extraData: any = null,
    qtyOverride: number = 1
  ) => {
    setCart((prev) => {
      //usamos el id y si tiene datos extra para diferenciar items iguales y si es item libre, también para agruparlo si tiene la misma descripción
      const existingIndex = prev.findIndex(
        (item) =>
          item.id === producto.id &&
          JSON.stringify(item.datos_extra) === JSON.stringify(extraData)
      );

      if (existingIndex !== -1) {
        const existing = prev[existingIndex];
        //validar stock solo si no es edición y es producto físico
        if (
          !editId &&
          producto.tipo === "producto" &&
          existing.cantidad + qtyOverride > producto.stock
        ) {
          toast.warning("Stock máximo alcanzado");
          return prev;
        }
        const updatedCart = [...prev];
        updatedCart[existingIndex] = {
          ...existing,
          cantidad: existing.cantidad + qtyOverride,
          subtotal: (existing.cantidad + qtyOverride) * existing.precio,
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
          stock_max: producto.stock,
          datos_extra: extraData,
        },
      ];
    });

    if (!extraData?.es_liquido) toast.success("Agregado");
    setSearchResults([]);
    setQuery("");
    searchInputRef.current?.focus();
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const currentQty =
            typeof item.cantidad === "string"
              ? parseFloat(item.cantidad)
              : item.cantidad;
          const newQty = currentQty + delta;
          if (newQty < 1) return item;
          if (!editId && newQty > item.stock_max) {
            toast.warning("Stock insuficiente");
            return item;
          }
          return { ...item, cantidad: newQty, subtotal: newQty * item.precio };
        }
        return item;
      })
    );
  };

  const removeItem = (index: number) => {
    //usamos index en lugar de ID porque puede haber varias baterías iguales con distinto código
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const addCustomItem = async () => {
    if (!customItemData.descripcion || !customItemData.precio) {
      toast.error("Completa descripción y precio");
      return;
    }
    //determinar qué código buscar según el tipo seleccionado
    const codigoBuscar =
      customItemData.tipo === "servicio" ? "GEN-SERV" : "GEN-EXT";

    try {
      //buscar el ID del producto genérico en la BD
      const res = await fetch(
        `/api/productos/buscar-codigo?codigo=${codigoBuscar}`
      );
      if (!res.ok)
        throw new Error(
          "No se encontraron los productos genéricos en el sistema"
        );

      const productoGenerico = await res.json();

      //construir el objeto para el carrito, sobrescribimos el nombre visualmente y guardamos la descripción real en datos_extra
      const itemParaCarrito = {
        ...productoGenerico,
        nombre: customItemData.descripcion.toUpperCase(), //para que se vea bonito en la lista
        precio: parseFloat(customItemData.precio),
        es_bateria: false,
        //aquí guardo la descripción original por si acaso
        datos_extra: {
          descripcion_personalizada: customItemData.descripcion,
          es_item_libre: true,
        },
      };

      //agregar al carrito y pasamos datos_extra para que la lógica de agrupar sepa que son distintos si tienen distinta descripción
      addToCartFinal(itemParaCarrito, itemParaCarrito.datos_extra);

      setCustomItemModalOpen(false);
      setCustomItemData({ tipo: "servicio", descripcion: "", precio: "" });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  //lógica para el cobro
  const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const discountValue = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountValue);

  const handlePay = async () => {
    if (cart.length === 0) return;
    if (discountValue > subtotal) {
      toast.error("El descuento no puede ser mayor al total de la venta");
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
          toast.warning("Esta venta ya fue procesada anteriormente.");
          //limpiamos todo porque la venta sí se hizo, solo que el frontend no se enteró a la primera
          setCart([]);
          setSearchResults([]);
          setClientName("");
          setIsPending(false);
          setDiscount("");
          setIdempotencyKey(crypto.randomUUID()); // Regenerar para la próxima
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
        //regenerar llave para la siguiente venta
        setIdempotencyKey(crypto.randomUUID());
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingPay(false);
    }
  };

  const confirmLiquidAdd = () => {
    if (!pendingLiquidProduct || !liquidQuantity) return;
    const qty = parseFloat(liquidQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Cantidad inválida");
      return;
    }

    if (
      pendingLiquidProduct.origen === "parcial" &&
      qty > pendingLiquidProduct.stock
    ) {
      toast.error(
        `Solo quedan ${pendingLiquidProduct.stock} ${pendingLiquidProduct.unidad_medida}`
      );
      return;
    }

    let precioFinal = pendingLiquidProduct.precio;
    if (pendingLiquidProduct.capacidad > 0) {
      precioFinal =
        pendingLiquidProduct.precio / pendingLiquidProduct.capacidad;
    }

    const extra = {
      es_liquido: true,
      es_item_parcial: pendingLiquidProduct.origen === "parcial",
      parcial_id: pendingLiquidProduct.parcial_id,
      descripcion_unidad: pendingLiquidProduct.unidad_medida,
    };

    addToCartFinal(
      { ...pendingLiquidProduct, precio: precioFinal },
      extra,
      qty
    );
    setLiquidModalOpen(false);
    setPendingLiquidProduct(null);
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
        Cargando datos de venta...
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
                    {item.es_bateria && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--color-primary)",
                          marginTop: 2,
                        }}
                      >
                        Garantía: {item.datos_extra?.garantia_meses} m - Cód:{" "}
                        {item.datos_extra?.codigo_bateria}
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
                      <span
                        style={{
                          minWidth: 30,
                          textAlign: "center",
                          fontSize: "0.9rem",
                        }}
                      >
                        {item.cantidad}{" "}
                        {item.datos_extra?.es_liquido
                          ? formatUnit(item.datos_extra.descripcion_unidad)
                          : ""}
                      </span>
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
                <label className={styles.label}>Precio (Q)</label>
                <input
                  type="number"
                  className={styles.searchInput}
                  placeholder="0.00"
                  value={customItemData.precio}
                  onChange={(e) =>
                    setCustomItemData({
                      ...customItemData,
                      precio: e.target.value,
                    })
                  }
                />
              </div>

              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
              >
                <button
                  onClick={() => setCustomItemModalOpen(false)}
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
                  onClick={addCustomItem}
                  className={styles.payButton}
                  style={{ width: "auto", padding: "10px 25px" }}
                >
                  Agregar
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
      </div>
    </>
  );
}

export default function POSPage() {
  //es requerido encerrar en suspense la función cuando se implementa useSearchParams dentro de ella con el objetivo de mantener la integridad de los datos
  return (
    <Suspense fallback={<div>Cargando editor de ventas...</div>}>
      <POSContent />
    </Suspense>
  );
}
