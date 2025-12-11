export interface DatosExtraBateria {
  garantia_anios?: number;
  fecha_fin_garantia?: string;
  [key: string]: any;
}

export interface Producto {
  id: number;
  codigo_barras: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock: number;
  stock_minimo: number;
  categoria_id: number | null;
  marca_id: number | null;
  url_imagen: string | null;
  es_bateria: boolean;
  tipo: "producto" | "servicio" | "tercero";
  es_liquido: boolean;
  capacidad: number;
  unidad_medida: string;
  created_at: string;
}

export interface Categoria {
  id: number;
  nombre: string;
  created_at: string;
}

export interface Marca {
  id: number;
  nombre: string;
  created_at: string;
}

export interface Venta {
  id: number;
  usuario_id: string;
  total: number;
  descuento: number;
  fecha_venta: string;
}

export interface DetalleVenta {
  id: number;
  venta_id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  datos_extra: DatosExtraBateria | null; //la interfaz de los datos extra para las baterías
}

// Tipo auxiliar para uso de JOINs
export interface VentaCompleta extends Venta {
  detalle_ventas: DetalleVenta[];
  usuario?: { nombre: string };
}

export interface ProductoVenta extends Producto {
  marca_nombre?: string; //viene del JOIN
  categoria_nombre?: string; //viene del JOIN
}

export interface ProductoBuscador extends Producto {
  origen: "catalogo" | "parcial"; //para saber si viene de la tabla de los productos o de los productos parciales
  parcial_id?: number; //id de la tabla inventario_parcial si es necesario
}

export interface InventarioParcial {
  id: number;
  producto_id: number;
  cantidad_restante: number;
  codigo_referencia: string;
  activo: boolean;
  producto?: Producto; //para cuando hacemos JOIN
  created_at: string;
}
