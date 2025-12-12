"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./Sidebar.module.css";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BatteryCharging,
  LogOut,
  X,
  PackageOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  closeMobile: () => void;
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

export default function Sidebar({
  isOpen,
  closeMobile,
  isCollapsed,
  toggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const supabase = createClient();
  const router = useRouter();

  const menuItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <LayoutDashboard size={20} />,
    },
    {
      name: "Productos",
      path: "/productos",
      icon: <Package size={20} />,
    },
    {
      name: "Ventas",
      path: "/ventas",
      icon: <ShoppingCart size={20} />,
    },
    {
      name: "Baterías",
      path: "/ventas/baterias",
      icon: <BatteryCharging size={20} />,
    },
    {
      name: "Productos abiertos",
      path: "/inventario/parcial",
      icon: <PackageOpen size={20} />,
    },
  ];

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    router.refresh();
    router.push("/login");
  };

  return (
    <aside
      className={`${styles.sidebar} ${isOpen ? styles.open : ""} ${
        isCollapsed ? styles.collapsed : ""
      }`}
    >
      <button
        className={styles.closeButton}
        onClick={closeMobile}
        style={{ display: isOpen ? "flex" : "none" }}
      >
        <X size={32} />
      </button>

      <button
        className={styles.toggleBtn}
        onClick={toggleCollapse}
        title={isCollapsed ? "Expandir menú" : "Retraer menú"}
      >
        {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <img
          src="/taller_franco_logo.jpg"
          alt="Logo"
          style={{
            width: isCollapsed ? "40px" : "100px",
            height: isCollapsed ? "40px" : "100px",
            borderRadius: "50%",
            margin: "0 auto",
            transition: "all 0.3s ease",
            objectFit: "cover",
          }}
        />
      </div>

      {!isCollapsed && <div className={styles.logoArea}>Taller Franco</div>}

      <nav className={styles.nav}>
        {menuItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={`${styles.link} ${
              pathname === item.path ? styles.activeLink : ""
            }`}
            onClick={closeMobile}
            title={isCollapsed ? item.name : ""}
          >
            <span style={{ marginRight: isCollapsed ? "0" : "10px" }}>
              {item.icon}
            </span>
            {!isCollapsed && item.name}
          </Link>
        ))}
      </nav>

      <div className={styles.nav}>
        <button
          className={styles.link}
          onClick={handleLogout}
          title={isCollapsed ? "Salir" : ""}
        >
          <LogOut
            size={20}
            style={{ marginRight: isCollapsed ? "0" : "10px" }}
          />
          {!isCollapsed && "Salir"}
        </button>
      </div>
    </aside>
  );
}
