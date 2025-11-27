import { Pool } from "pg";

// Configuración de la conexión
// variable de entorno "Transaction mode" (puerto 6543)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Necesario para conexiones seguras a Supabase/Cloud
  },
});

// esto exporta una función helper para ejecutar queries
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;

  return res;
};
