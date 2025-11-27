"use client";
import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { Menu } from "lucide-react"; // Icono de hamburguesa

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* 1. El Sidebar */}
      <Sidebar isOpen={sidebarOpen} closeMobile={() => setSidebarOpen(false)} />

      {/* 2. El Contenido Principal */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          marginLeft: "250px",
        }}
      >
        {/* Nota: marginLeft 250px deja espacio al sidebar en Desktop. En móvil deberíamos quitarlo con CSS media queries, pero por ahora funcionará en PC */}

        {/* Barra superior móvil (Visible solo en móvil) */}
        <header
          style={{
            padding: "10px",
            background: "white",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
          }}
          className="mobile-header"
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              marginRight: "10px",
            }}
          >
            <Menu color="var(--color-secondary)" />
          </button>
          <span style={{ fontWeight: "bold", color: "var(--color-secondary)" }}>
            Taller Franco
          </span>
        </header>

        {/* Aquí se renderiza la página que esté visible (Productos, Ventas, etc) */}
        <main
          style={{ padding: "20px", flex: 1, background: "var(--color-bg)" }}
        >
          {children}
        </main>
      </div>

      {/* Estilo temporal para manejar el responsivo básico del margin-left */}
      <style jsx global>{`
        @media (max-width: 768px) {
          div[style*="marginLeft: '250px'"] {
            margin-left: 0 !important;
          }
          .mobile-header {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .mobile-header {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
