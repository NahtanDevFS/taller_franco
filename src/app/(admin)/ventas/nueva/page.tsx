"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./ventas.module.css";
import { formatoQuetzal } from "@/lib/utils";
import { toast, Toaster } from "sonner";
import {
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  Save,
  Battery,
  ScanBarcode,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BarcodeScanner from "@/components/ventas/BarcodeScanner";

//interfaz para el carrito de ventas
interface CartItem {
  id: number;
  nombre: string;
  codigo_barras: string | null;
  precio: number;
  cantidad: number;
  subtotal: number;
  es_bateria: boolean;
  stock_max: number; //para no vender más de lo que hay
  datos_extra?: {
    garantia_meses: number;
    codigo_bateria?: string;
    descripcion_personalizada?: string;
    es_item_libre?: boolean;
  } | null;
}

function POSContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("id"); //ID si se está editando

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingPay, setLoadingPay] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [clientName, setClientName] = useState("");
  const [isPending, setIsPending] = useState(false);

  //estado para modal de batería
  const [batteryModalOpen, setBatteryModalOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [pendingBattery, setPendingBattery] = useState<any | null>(null);
  const [warrantyData, setWarrantyData] = useState({
    meses: 12,
    codigo_unico: "",
  });

  //estado para modal de concepto libre
  const [customItemModalOpen, setCustomItemModalOpen] = useState(false);
  const [customItemData, setCustomItemData] = useState({
    tipo: "servicio", //servicio o tercero
    descripcion: "",
    precio: "",
  });

  //índice del producto que se está editando en el carrito (null si es nuevo)
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);

  //referencia para mantener el foco en el scanner
  const searchInputRef = useRef<HTMLInputElement>(null);

  //obtener usuario actual para saber quien hizo la venta
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
    };
    getUser();
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

      //ahora los datos del detalle de la venta se transforman para mostrarse en el carrito
      const itemsFormateados = data.detalles.map((d: any) => ({
        id: d.producto_id,
        //usamos la descripción personalizada o nombre del producto (puede ser null)
        nombre: d.datos_extra?.descripcion_personalizada
          ? d.datos_extra.descripcion_personalizada.toUpperCase()
          : d.producto_nombre,
        codigo_barras: d.codigo_barras,
        precio: parseFloat(d.precio_unitario),
        cantidad: d.cantidad,
        subtotal: parseFloat(d.subtotal),
        es_bateria: !!d.datos_extra?.garantia_meses,
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
      return true; // Encontrado
    }
    return false; // No encontrado
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

    //si es batería por defecto, abre el modal como "nuevo item"
    if (producto.es_bateria) {
      openBatteryModal(producto, null);
      return;
    }

    //agregar al carrito normal
    addToCartFinal(producto);
  };

  const openBatteryModal = (producto: any, indexInCart: number | null) => {
    setPendingBattery(producto);
    setEditingCartIndex(indexInCart);

    //si estamos editando uno existente, pre-llenamos los datos
    if (indexInCart !== null) {
      const item = cart[indexInCart];
      setWarrantyData({
        meses: item.datos_extra?.garantia_meses || 12,
        codigo_unico: item.datos_extra?.codigo_bateria || "",
      });
    } else {
      //si es nuevo, defaults
      setWarrantyData({ meses: 12, codigo_unico: "" });
    }

    setBatteryModalOpen(true);
  };

  const saveBatteryDetails = () => {
    if (!pendingBattery) return;

    const extraData = {
      garantia_meses: warrantyData.meses,
      codigo_bateria: warrantyData.codigo_unico,
    };

    //si estamos editando un producto que ya está en el carrito
    if (editingCartIndex !== null) {
      setCart((prev) =>
        prev.map((item, i) => {
          if (i === editingCartIndex) {
            return {
              ...item,
              es_bateria: true, // Forzamos que sea batería visualmente
              datos_extra: extraData,
            };
          }
          return item;
        })
      );
      toast.success("Datos de batería actualizados");
    }
    //esto si es un producto nuevo que viene del buscador
    else {
      addToCartFinal(pendingBattery, extraData);
    }

    setBatteryModalOpen(false);
    setPendingBattery(null);
    setEditingCartIndex(null);
    searchInputRef.current?.focus();
  };

  const addToCartFinal = (producto: any, extraData: any = null) => {
    setCart((prev) => {
      const isBattery = !!extraData || producto.es_bateria;
      // Usamos el id y si tiene datos extra para diferenciar items iguales y si es item libre, también queremos agruparlo si tiene la misma descripción
      const existingIndex = prev.findIndex(
        (item) =>
          item.id === producto.id &&
          JSON.stringify(item.datos_extra) === JSON.stringify(extraData)
      );

      if (existingIndex !== -1 && !isBattery) {
        const existing = prev[existingIndex];
        //validar stock solo si no es edición y es producto físico
        if (
          !editId &&
          producto.tipo === "producto" &&
          existing.cantidad + 1 > producto.stock
        ) {
          toast.warning("Stock máximo alcanzado");
          return prev;
        }
        const updatedCart = [...prev];
        updatedCart[existingIndex] = {
          ...existing,
          cantidad: existing.cantidad + 1,
          subtotal: (existing.cantidad + 1) * existing.precio,
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
          cantidad: 1,
          subtotal: parseFloat(producto.precio),
          es_bateria: isBattery, //usamos el flag calculado o el del producto
          stock_max: producto.stock,
          datos_extra: extraData,
        },
      ];
    });

    if (!extraData && !producto.es_bateria) toast.success("Agregado");
    setSearchResults([]);
    setQuery("");
    searchInputRef.current?.focus();
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = item.cantidad + delta;
          if (newQty < 1) return item;
          //validar stock max solo si no estoy editando (o para ser estrictos)
          if (!editId && newQty > item.stock_max) {
            toast.warning("No hay suficiente stock");
            return item;
          }
          return {
            ...item,
            cantidad: newQty,
            subtotal: newQty * item.precio,
          };
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

      //construir el objeto para el carrito
      //sobrescribimos el nombre visualmente y guardamos la descripción real en datos_extra
      const itemParaCarrito = {
        ...productoGenerico,
        nombre: customItemData.descripcion.toUpperCase(), //para que se vea bonito en la lista
        precio: parseFloat(customItemData.precio),
        es_bateria: false,
        //aquí guardamos la descripción original por si acaso
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
  const total = cart.reduce((acc, item) => acc + item.subtotal, 0);

  const handlePay = async () => {
    if (cart.length === 0) return;
    setLoadingPay(true);

    try {
      const payload = {
        usuario_id: userId,
        cliente: clientName || "CF", //Enviamos el cliente
        total: total,
        estado: isPending ? "pendiente" : "completada",
        items: cart.map((item) => ({
          producto_id: item.id,
          cantidad: item.cantidad,
          precio: item.precio,
          datos_extra: item.datos_extra,
        })),
      };

      let res;
      if (editId) {
        //modo edición
        res = await fetch(`/api/ventas/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        //modo creación
        res = await fetch("/api/ventas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al procesar venta");

      toast.success(editId ? "Venta actualizada" : "Venta registrada");

      if (editId) {
        router.push("/ventas"); // Volver al historial
      } else {
        setCart([]);
        setSearchResults([]);
        setClientName("");
        setIsPending(false);
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
                style={{
                  background: "var(--color-secondary)",
                  border: "none",
                  borderRadius: "var(--border-radius)",
                  color: "white",
                  padding: "0 15px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
                title="Abrir Cámara"
              >
                <ScanBarcode size={20} />
              </button>
            </div>
            <div style={{ marginTop: 10, marginBottom: 20 }}>
              <button
                onClick={() => setCustomItemModalOpen(true)}
                className={styles.btnSecondary}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "white",
                  border: "2px dashed var(--color-primary)",
                  color: "var(--color-primary)",
                  borderRadius: 8,
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                + Agregar Mano de Obra / Externo
              </button>
            </div>
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

          <div style={{ padding: "15px 15px 0" }}>
            <input
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 6,
                border: "1px solid #ccc",
              }}
              placeholder="Nombre del Cliente (Opcional)"
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
                      {/*<button
                      className={styles.qtyBtn}
                      title="Agregar datos de batería"
                      onClick={() => openBatteryModal(item, index)} // Pasamos el item y su indice
                      style={{
                        color: "var(--color-primary)",
                        background: "#fff7ed",
                      }}
                    >
                      <Battery size={14} />
                    </button>*/}
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
            <div className={styles.totalRow}>
              <span>Total</span>
              <span>{formatoQuetzal.format(total)}</span>
            </div>
            <div
              style={{
                marginBottom: 15,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <input
                type="checkbox"
                id="pendingCheck"
                checked={isPending}
                onChange={(e) => setIsPending(e.target.checked)}
                style={{ width: 20, height: 20, cursor: "pointer" }}
              />
              <label
                htmlFor="pendingCheck"
                style={{
                  cursor: "pointer",
                  fontWeight: "bold",
                  color: isPending ? "#eab308" : "#64748b",
                }}
              >
                {isPending ? "Cobro inmediato" : "Venta pendiente de pago"}
              </label>
            </div>
            <button
              className={styles.payButton}
              onClick={handlePay}
              disabled={cart.length === 0 || loadingPay}
              //cambiamos el color si es pendiente para que sea visualmente obvio
              style={{
                background: isPending ? "#eab308" : "var(--color-primary)",
              }}
            >
              {loadingPay
                ? "Procesando..."
                : isPending
                ? "Guardar Pendiente"
                : "Cobrar"}
            </button>
          </div>
        </div>

        {batteryModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <h3 style={{ marginTop: 0 }}>
                {editingCartIndex !== null
                  ? "Editar Batería"
                  : "Detalles de Batería"}
              </h3>
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
                  Código Único (Manual)
                </label>
                <input
                  type="text"
                  value={warrantyData.codigo_unico}
                  onChange={(e) =>
                    setWarrantyData({
                      ...warrantyData,
                      codigo_unico: e.target.value,
                    })
                  }
                  placeholder="Escribe el código grabado en la batería"
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
                  onClick={() => {
                    setBatteryModalOpen(false);
                    setPendingBattery(null);
                    setEditingCartIndex(null);
                  }}
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
                  onClick={saveBatteryDetails}
                  style={{
                    padding: "8px 15px",
                    border: "none",
                    background: "var(--color-primary)",
                    color: "white",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  {editingCartIndex !== null ? "Actualizar" : "Agregar"}
                </button>
              </div>
            </div>
          </div>
        )}
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
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 6,
                      border: "1px solid #ccc",
                      background:
                        customItemData.tipo === "servicio"
                          ? "var(--color-secondary)"
                          : "white",
                      color:
                        customItemData.tipo === "servicio" ? "white" : "black",
                    }}
                  >
                    Mano de obra
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomItemData({ ...customItemData, tipo: "tercero" })
                    }
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 6,
                      border: "1px solid #ccc",
                      background:
                        customItemData.tipo === "tercero"
                          ? "var(--color-primary)"
                          : "white",
                      color:
                        customItemData.tipo === "tercero" ? "white" : "black",
                    }}
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
