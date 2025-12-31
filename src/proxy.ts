import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * expresion regular para coincidir con todas las rutas excepto:
     * _next/static (archivos estáticos)
     * _next/image (optimización de imágenes)
     * favicon.ico (icono del navegador)
     * api/auth (rutas de autenticación)
     */
    "/((?!_next/static|_next/image|favicon.ico|auth).*)",
  ],
};
