"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BatteryCharging,
  LogOut,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  closeMobile: () => void;
}

export default function Sidebar({ isOpen, closeMobile }: SidebarProps) {
  const pathname = usePathname();

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
      name: "ventas",
      path: "/ventas",
      icon: <ShoppingCart size={20} />,
    },
    {
      name: "Baterías",
      path: "/ventas/baterias",
      icon: <BatteryCharging size={20} />,
    },
  ];

  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
      <div className={styles.logoArea}>Taller Franco</div>
      <nav className={styles.nav}>
        {menuItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={`${styles.link} ${
              pathname === item.path ? styles.activeLink : ""
            }`}
            onClick={closeMobile}
          >
            <span style={{ marginRight: "10px" }}>{item.icon}</span>
            {item.name}
          </Link>
        ))}
      </nav>
      <div className={styles.nav}>
        <button
          className={styles.link}
          onClick={() => alert("Cerrar sesión logic aquí")}
        >
          <LogOut size={20} style={{ marginRight: "10px" }} />
          Salir
        </button>
      </div>
    </aside>
  );
}
