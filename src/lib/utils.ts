// src/lib/utils.ts

export const calcularPrecioVenta = (costo: number): number => {
  if (!costo || costo < 0) return 0;

  //costo + 35%
  const conPorcentaje = costo * 1.35;

  //sumar 20 fijos
  //const conFijo = conPorcentaje + 20;

  //redondear hacia arriba al múltiplo de 10 más cercano
  //51 / 10 = 5.1 -> Math.ceil(5.1) = 6 -> 6 * 10 = 60
  //return Math.ceil(conFijo / 10) * 10;
  return Math.ceil(conPorcentaje / 10) * 10; //sin envío
};

//formateador de moneda para Guatemala
export const formatoQuetzal = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  minimumFractionDigits: 2,
});

export const formatUnit = (unit: string | null | undefined): string => {
  if (!unit) return "";
  const lower = unit.toLowerCase().trim();

  if (lower.startsWith("lit")) return "Lts";
  if (lower.startsWith("gal")) return "Gal";
  if (lower.startsWith("mil") || lower === "ml") return "ml";
  if (lower.startsWith("onz")) return "Oz";
  if (lower.startsWith("bot")) return "Bot";
  if (lower.startsWith("caj")) return "Caja";
  if (lower.startsWith("uni")) return "Unid";
  if (lower.startsWith("met")) return "Mts";

  return unit.substring(0, 3); //fallback de primeras 3 letras si no conocemos la unidad
};
