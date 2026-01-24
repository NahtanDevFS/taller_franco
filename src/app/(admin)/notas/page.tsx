"use client";
import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, PlusCircle } from "lucide-react";
import styles from "./notas.module.css";

interface Nota {
  id: number;
  items: string[];
  created_at: string;
}

export default function NotasPage() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingNota, setEditingNota] = useState<Nota | null>(null);
  const [formItems, setFormItems] = useState<string[]>([""]);

  useEffect(() => {
    fetchNotas();
  }, []);

  const fetchNotas = async () => {
    try {
      const res = await fetch("/api/notas");
      const data = await res.json();
      setNotas(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta nota permanentemente?")) return;
    try {
      await fetch(`/api/notas/${id}`, { method: "DELETE" });
      setNotas(notas.filter((n) => n.id !== id));
    } catch (error) {
      alert("Error al eliminar");
    }
  };

  const openModal = (nota?: Nota) => {
    if (nota) {
      setEditingNota(nota);
      setFormItems([...nota.items]);
    } else {
      setEditingNota(null);
      setFormItems([""]);
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const cleanItems = formItems.filter((item) => item.trim() !== "");
    if (cleanItems.length === 0) return alert("Agrega al menos un ítem");

    const method = editingNota ? "PUT" : "POST";
    const url = editingNota ? `/api/notas/${editingNota.id}` : "/api/notas";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cleanItems }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchNotas();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleItemChange = (index: number, value: string) => {
    const newItems = [...formItems];
    newItems[index] = value;
    setFormItems(newItems);
  };

  const addItemInput = () => setFormItems([...formItems, ""]);

  const removeItemInput = (index: number) => {
    const newItems = formItems.filter((_, i) => i !== index);
    setFormItems(newItems);
  };

  if (loading) return <div className={styles.container}>Cargando notas...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Notas Rápidas</h1>
        <button className={styles.addButton} onClick={() => openModal()}>
          <Plus size={20} /> Nueva Nota
        </button>
      </div>

      <div className={styles.grid}>
        {notas.map((nota) => (
          <NotaCard
            key={nota.id}
            nota={nota}
            onEdit={() => openModal(nota)}
            onDelete={() => handleDelete(nota.id)}
          />
        ))}
        {notas.length === 0 && (
          <p style={{ color: "#94a3b8" }}>No hay notas pendientes.</p>
        )}
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>
              {editingNota ? "Editar Nota" : "Nueva Nota"}
            </h2>

            <div style={{ marginBottom: "1rem" }}>
              {formItems.map((item, index) => (
                <div key={index} className={styles.inputGroup}>
                  <input
                    autoFocus={index === formItems.length - 1}
                    className={styles.input}
                    value={item}
                    onChange={(e) => handleItemChange(index, e.target.value)}
                    placeholder={`Ítem ${index + 1}`}
                  />
                  <button
                    onClick={() => removeItemInput(index)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#ef4444",
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
              <button
                onClick={addItemInput}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  background: "none",
                  border: "none",
                  color: "var(--color-primary)",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  marginTop: "0.5rem",
                }}
              >
                <PlusCircle size={16} /> Agregar otro punto
              </button>
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </button>
              <button className={styles.saveBtn} onClick={handleSave}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotaCard({
  nota,
  onEdit,
  onDelete,
}: {
  nota: Nota;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const fecha = new Date(nota.created_at).toLocaleDateString("es-GT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemsToShow = expanded ? nota.items : nota.items.slice(0, 3);
  const hasMore = nota.items.length > 3;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardDate}>{fecha}</span>
        <div className={styles.cardActions}>
          <button className={styles.iconBtn} onClick={onEdit}>
            <Edit2 size={16} />
          </button>
          <button
            className={`${styles.iconBtn} ${styles.deleteBtn}`}
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <ul className={styles.itemList}>
        {itemsToShow.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>

      {hasMore && (
        <button
          className={styles.showMoreBtn}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Ver menos" : `Ver ${nota.items.length - 3} más...`}
        </button>
      )}
    </div>
  );
}
