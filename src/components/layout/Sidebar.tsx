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
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  closeMobile: () => void;
}

export default function Sidebar({ isOpen, closeMobile }: SidebarProps) {
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
      name: "ventas",
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

    if (error) {
      throw error;
    }

    router.refresh();
    router.push("/login");
  };

  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
      <button className={styles.closeButton} onClick={closeMobile}>
        <X size={32} />
      </button>
      <img
        src="/taller_franco_logo.jpg"
        alt="Logo Taller Franco"
        style={{
          width: "100px",
          borderRadius: "50%",
          margin: "0px auto",
          marginTop: "0px",
        }}
      />
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
        <button className={styles.link} onClick={handleLogout}>
          <LogOut size={20} style={{ marginRight: "10px" }} />
          Salir
        </button>
      </div>
    </aside>
  );
}
