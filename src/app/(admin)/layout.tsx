"use client";
import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { Menu } from "lucide-react";
import styles from "./layout.module.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.container}>
      <Sidebar isOpen={sidebarOpen} closeMobile={() => setSidebarOpen(false)} />

      <div className={styles.mainContent}>
        {/*barra superior para mobile*/}
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

        <main className={styles.contentBody}>{children}</main>
      </div>

      {/* Estilo temporal para manejar el responsivo básico del margin-left */}
      <style jsx global>{`
        @media (max-width: 1024px) {
          div[style*="marginLeft: '250px'"] {
            margin-left: 0 !important;
          }
          .mobile-header {
            display: flex !important;
          }
        }
        @media (min-width: 1025px) {
          .mobile-header {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
