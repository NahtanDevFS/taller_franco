"use client";
import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { Menu } from "lucide-react"; // Icono de hamburguesa
import styles from "./layout.module.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.container}>
      {/* 1. El Sidebar */}
      <Sidebar isOpen={sidebarOpen} closeMobile={() => setSidebarOpen(false)} />

      {/* 2. El Contenido Principal */}
      <div className={styles.mainContent}>
        {/*barra superior móvil (visible solo en móvil) */}
        <header className={styles.mobileHeader}>
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
        <main className={styles.contentBody}>{children}</main>
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
