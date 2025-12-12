import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { formatoQuetzal } from "@/lib/utils";

Font.register({
  family: "Helvetica",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/helveticaneue/v70/1Ptsg8zYS_SKggPNyC0IT4ttDfA.ttf",
    },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 15, fontFamily: "Helvetica", fontSize: 9 },

  header: { alignItems: "center", marginBottom: 10 },
  brandTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  brandSubtitle: { fontSize: 10, color: "#444", marginBottom: 2 },

  ticketId: { marginTop: 8, fontSize: 14, fontWeight: "bold" },
  clientSection: { marginTop: 10, marginBottom: 10 },
  manualInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 5,
  },
  label: { width: 50, fontSize: 10 },
  lineInput: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    flex: 1,
    borderStyle: "dotted",
  },

  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderStyle: "dashed",
    paddingBottom: 3,
    marginBottom: 3,
    marginTop: 5,
    fontWeight: "bold",
  },
  tableRow: { flexDirection: "row", marginBottom: 4 },
  colQty: { width: "10%", textAlign: "center" },
  colProd: { width: "65%", textAlign: "left", paddingRight: 5 },
  colTotal: { width: "25%", textAlign: "right" },

  totalsSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#000",
    borderStyle: "dashed",
    paddingTop: 5,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 2,
  },

  footer: { marginTop: 20, textAlign: "center" },
  disclaimer: {
    fontSize: 8,
    marginTop: 10,
    fontStyle: "italic",
    color: "#444",
  },

  letterPage: { padding: 40, fontSize: 11 },
  letterHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottomWidth: 2,
    borderColor: "#eee",
    paddingBottom: 20,
  },
  letterBrand: { fontSize: 24, fontWeight: "bold", color: "#f97316" },

  letterTableHead: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    padding: 8,
    fontWeight: "bold",
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  letterTableRow: {
    flexDirection: "row",
    padding: 8,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },

  letterManualInput: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 20,
    marginTop: 10,
  },
  letterLineGroup: { flex: 1, flexDirection: "row", alignItems: "flex-end" },
  letterLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    flex: 1,
    marginBottom: 2,
  },
});

interface InvoiceProps {
  venta: any;
  tipo: "ticket" | "carta";
}

export const InvoiceDocument: React.FC<InvoiceProps> = ({ venta, tipo }) => {
  const fecha = new Date(venta.fecha_venta).toLocaleString("es-GT");

  if (tipo === "ticket") {
    const minHeight = 300;
    const itemHeight = 30;
    const calculatedHeight =
      minHeight + (venta.detalles?.length || 0) * itemHeight;

    return (
      <Document>
        <Page size={[227, calculatedHeight]} style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.brandTitle}>TALLER FRANCO</Text>
            <Text style={styles.brandSubtitle}>Repuestos y Servicios</Text>
            <Text style={styles.brandSubtitle}>Estanzuela, Zacapa</Text>
            <Text style={styles.ticketId}>TICKET-{venta.id}</Text>
            <Text style={{ fontSize: 9, marginTop: 4 }}>{fecha}</Text>
          </View>

          {/*cliente ticket*/}
          <View style={styles.clientSection}>
            {venta.cliente === "CF" || !venta.cliente ? (
              <>
                <View style={styles.manualInputRow}>
                  <Text style={styles.label}>Nombre:</Text>
                  <View style={styles.lineInput} />
                </View>
                <View style={styles.manualInputRow}>
                  <Text style={styles.label}>NIT:</Text>
                  <View style={styles.lineInput} />
                </View>
              </>
            ) : (
              <>
                <Text>Nombre: {venta.cliente}</Text>
                <Text>NIT:</Text>
              </>
            )}
          </View>

          <View>
            <View style={styles.tableHeader}>
              <Text style={styles.colQty}>#</Text>
              <Text style={styles.colProd}>Producto</Text>
              <Text style={styles.colTotal}>Total</Text>
            </View>
            {venta.detalles?.map((item: any, i: number) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.colQty}>{item.cantidad}</Text>
                <View style={styles.colProd}>
                  <Text>{item.producto_nombre}</Text>
                  {item.datos_extra?.codigo_bateria && (
                    <Text style={{ fontSize: 7, color: "#666" }}>
                      [Serie: {item.datos_extra.codigo_bateria}]
                    </Text>
                  )}
                </View>
                <Text style={styles.colTotal}>
                  {formatoQuetzal.format(item.subtotal)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text
                style={{ width: "60%", textAlign: "right", paddingRight: 10 }}
              >
                Subtotal:
              </Text>
              <Text style={{ width: "40%", textAlign: "right" }}>
                {formatoQuetzal.format(venta.total)}
              </Text>
            </View>
            <View style={[styles.totalRow, { marginTop: 2 }]}>
              <Text
                style={{
                  width: "60%",
                  textAlign: "right",
                  paddingRight: 10,
                  fontWeight: "bold",
                }}
              >
                TOTAL:
              </Text>
              <Text
                style={{ width: "40%", textAlign: "right", fontWeight: "bold" }}
              >
                {formatoQuetzal.format(venta.total)}
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            {/*<Text style={{ marginBottom: 5 }}>
              Vendedor: {venta.vendedor_nombre || "General"}
            </Text>*/}
            <Text style={styles.disclaimer}>
              * Documento no válido para crédito fiscal *
            </Text>
            <Text style={{ fontSize: 8, marginTop: 5, color: "#888" }}>
              Gracias por su compra
            </Text>
          </View>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.letterPage}>
        <View style={styles.letterHeaderRow}>
          <View>
            <Text style={styles.letterBrand}>TALLER FRANCO</Text>
            <Text style={{ color: "#555", fontSize: 10 }}>
              Venta de Repuestos y Servicios
            </Text>
            <Text style={{ color: "#555", fontSize: 10 }}>
              Estanzuela, Zacapa
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>
              ORDEN #{venta.id}
            </Text>
            <Text style={{ color: "#555" }}>{fecha}</Text>
            {/*<Text style={{ marginTop: 5, fontSize: 10 }}>
              Vendedor: {venta.vendedor_nombre || "Caja"}
            </Text>*/}
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          {venta.cliente === "CF" || !venta.cliente ? (
            <View style={styles.letterManualInput}>
              <View style={styles.letterLineGroup}>
                <Text style={{ width: 60, fontWeight: "bold" }}>Nombre:</Text>
                <View style={styles.letterLine} />
              </View>
              <View style={[styles.letterLineGroup, { maxWidth: 200 }]}>
                <Text style={{ width: 30, fontWeight: "bold" }}>NIT:</Text>
                <View style={styles.letterLine} />
              </View>
            </View>
          ) : (
            <View>
              <Text style={{ marginBottom: 4 }}>
                Cliente:{" "}
                <Text style={{ fontWeight: "bold" }}>{venta.cliente}</Text>
              </Text>
              <Text>NIT:</Text>
            </View>
          )}
        </View>

        <View style={{ marginBottom: 20 }}>
          <View style={styles.letterTableHead}>
            <Text style={{ width: "10%", textAlign: "center" }}>Cant.</Text>
            <Text style={{ width: "60%" }}>Descripción</Text>
            <Text style={{ width: "15%", textAlign: "right" }}>P. Unit</Text>
            <Text style={{ width: "15%", textAlign: "right" }}>Subtotal</Text>
          </View>

          {venta.detalles?.map((item: any, i: number) => (
            <View key={i} style={styles.letterTableRow}>
              <Text style={{ width: "10%", textAlign: "center" }}>
                {item.cantidad}
              </Text>
              <Text style={{ width: "60%" }}>
                {item.producto_nombre}
                {item.datos_extra?.codigo_bateria
                  ? `  (Serie: ${item.datos_extra.codigo_bateria})`
                  : ""}
              </Text>
              <Text style={{ width: "15%", textAlign: "right" }}>
                {formatoQuetzal.format(item.precio_unitario)}
              </Text>
              <Text style={{ width: "15%", textAlign: "right" }}>
                {formatoQuetzal.format(item.subtotal)}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <View style={{ width: "40%" }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 5,
              }}
            >
              <Text>Subtotal:</Text>
              <Text>{formatoQuetzal.format(venta.total)}</Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                borderTopWidth: 1,
                borderColor: "#000",
                paddingTop: 5,
              }}
            >
              <Text style={{ fontWeight: "bold", fontSize: 14 }}>TOTAL:</Text>
              <Text style={{ fontWeight: "bold", fontSize: 14 }}>
                {formatoQuetzal.format(venta.total)}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            position: "absolute",
            bottom: 40,
            left: 40,
            right: 40,
            textAlign: "center",
          }}
        >
          <Text style={{ fontStyle: "italic", fontSize: 10, color: "#666" }}>
            * Este documento es un comprobante interno de control y no tiene
            validez como factura fiscal *
          </Text>
          <Text style={{ fontSize: 10, marginTop: 5, color: "#666" }}>
            Gracias por su preferencia
          </Text>
        </View>
      </Page>
    </Document>
  );
};
