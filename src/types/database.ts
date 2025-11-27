// src/types/database.ts

// Tipo para el JSON de detalles, este es para poner información de las baterías por ejemplo
export interface DatosExtraBateria {
  garantia_anios?: number;
  fecha_fin_garantia?: string;
  [key: string]: any; // Permite otros campos si fuera necesario
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
  datos_extra: DatosExtraBateria | null; // la interfaz de los datos extra para las baterías
}

// Tipo auxiliar para uso de JOINs
export interface VentaCompleta extends Venta {
  detalle_ventas: DetalleVenta[];
  usuario?: { nombre: string };
}

export interface ProductoVenta extends Producto {
  marca_nombre?: string; // Viene del JOIN
  categoria_nombre?: string; // Viene del JOIN
}
