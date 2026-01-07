export interface Cliente {
  id: number;
  nombre: string;
  telefono?: string | null;
  nit_rfc?: string | null;
  activo: boolean;
  created_at?: string;
}

export interface Vehiculo {
  id: number;
  cliente_id: number;
  placa: string;
  marca?: string | null;
  modelo?: string | null;
  anio?: number | null;
  color?: string | null;
  vin?: string | null;
  notas?: string | null;
  //relaciones opcionales para joins
  clientes?: Cliente;
}

export interface OrdenServicio {
  id: number;
  vehiculo_id: number;
  fecha_ingreso: string;
  fecha_entrega_estimada?: string | null;
  kilometraje_actual: number;
  estado: "pendiente" | "en_proceso" | "terminado" | "cancelado";
  notas_generales?: string | null;
}
