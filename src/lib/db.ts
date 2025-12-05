import { Pool } from "pg";

//configuración de la conexión
//variable de entorno "transaction mode"
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, //necesario para conexiones seguras a supabase/cloud
  },
});

// esto exporta una función helper para ejecutar queries
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;

  return res;
};
