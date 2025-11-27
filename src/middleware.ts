import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Coincidir con todas las rutas excepto:
     * _next/static (archivos estáticos)
     * _next/image (optimización de imágenes)
     * favicon.ico (icono del navegador)
     * login (la página de entrada)
     * api/auth (rutas de autenticación internas)
     */
    "/((?!_next/static|_next/image|favicon.ico|login|auth).*)",
  ],
};
