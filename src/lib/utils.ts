// src/lib/utils.ts

export const calcularPrecioVenta = (costo: number): number => {
  if (!costo || costo < 0) return 0;

  // Costo + 35%
  const conPorcentaje = costo * 1.35;

  // Sumar 20 fijos
  //const conFijo = conPorcentaje + 20;

  // Redondear hacia arriba al múltiplo de 10 más cercano
  // 51 / 10 = 5.1 -> Math.ceil(5.1) = 6 -> 6 * 10 = 60
  //return Math.ceil(conFijo / 10) * 10;
  return Math.ceil(conPorcentaje / 10) * 10; //sin envío
};

// Formateador de moneda para Guatemala
export const formatoQuetzal = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  minimumFractionDigits: 2,
});
