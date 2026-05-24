import { jsPDF } from "jspdf";

export interface OrderPdfData {
  items: {
    medicationName: string;
    workspaceName: string;
    quantityWithoutTransfers: number;
    quantityWithTransfers: number;
    unitPrice: number;
    subtotalWithoutTransfers: number;
    subtotalWithTransfers: number;
  }[];
  totalWithoutTransfers: number;
  totalWithTransfers: number;
  totalSaving: number;
  generatedAt: string;
}

export function generateOrderPdf(data: OrderPdfData): void {
  try {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageW, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Orden de Compra Optimizada", pageW / 2, 18, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Meditory — Sistema de Gestión Farmacéutica", pageW / 2, 28, { align: "center" });
  doc.text(`Generado: ${data.generatedAt}`, pageW / 2, 35, { align: "center" });

  y = 52;
  doc.setTextColor(30, 30, 30);

  // Resumen financiero
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(14, y, pageW - 28, 28, 3, 3, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Resumen Financiero", 20, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Sin transferencias internas: $${data.totalWithoutTransfers.toLocaleString("es-AR")}`, 20, y + 16);
  doc.text(`Con transferencias internas: $${data.totalWithTransfers.toLocaleString("es-AR")}`, 20, y + 22);
  doc.setTextColor(34, 197, 94);
  doc.setFont("helvetica", "bold");
  doc.text(`AHORRO POTENCIAL: $${data.totalSaving.toLocaleString("es-AR")}`, pageW / 2 + 10, y + 19, { align: "center" });
  doc.setTextColor(30, 30, 30);

  y += 36;

  // Tabla
  const cols = { med: 14, ws: 70, qWo: 115, qWith: 138, price: 158, total: 178 };
  const rowH = 7;

  // Header tabla
  doc.setFillColor(99, 102, 241);
  doc.rect(14, y, pageW - 28, rowH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Medicamento", cols.med + 1, y + 5);
  doc.text("Hospital", cols.ws + 1, y + 5);
  doc.text("Sin Transf.", cols.qWo, y + 5, { align: "right" });
  doc.text("Con Transf.", cols.qWith, y + 5, { align: "right" });
  doc.text("P. Unit.", cols.price, y + 5, { align: "right" });
  doc.text("Total ($)", cols.total + 8, y + 5, { align: "right" });
  y += rowH;

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");

  let row = 0;
  for (const item of data.items) {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }
    if (row % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, pageW - 28, rowH, "F");
    }
    doc.setFontSize(8);
    doc.text(item.medicationName.slice(0, 25), cols.med + 1, y + 5);
    doc.text(item.workspaceName.slice(0, 22), cols.ws + 1, y + 5);
    doc.text(item.quantityWithoutTransfers.toLocaleString("es-AR"), cols.qWo, y + 5, { align: "right" });
    doc.text(item.quantityWithTransfers.toLocaleString("es-AR"), cols.qWith, y + 5, { align: "right" });
    doc.text(`$${item.unitPrice.toLocaleString("es-AR")}`, cols.price, y + 5, { align: "right" });
    doc.text(`$${item.subtotalWithTransfers.toLocaleString("es-AR")}`, cols.total + 8, y + 5, { align: "right" });
    y += rowH;
    row++;
  }

  // Footer total
  y += 4;
  doc.setFillColor(34, 197, 94);
  doc.rect(14, y, pageW - 28, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`TOTAL A PEDIR CON TRANSFERS: $${data.totalWithTransfers.toLocaleString("es-AR")}`, pageW / 2, y + 7, { align: "center" });

  // Footer page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(150);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Meditory — Página ${i} de ${pageCount}`, pageW / 2, 290, { align: "center" });
  }

  doc.save(`orden-compra-meditory-${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (e) {
    console.error("Error generating order PDF:", e);
    throw e;
  }
}

export interface StockReportData {
  rows: { medicationName: string; stocks: { workspaceName: string; quantity: number; minStock: number; optimalStock: number }[] }[];
}

export function generateStockReportPdf(data: StockReportData): void {
  try {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageW, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Reporte de Stock Cruzado", pageW / 2, 16, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Meditory · ${new Date().toLocaleDateString("es-AR")}`, pageW / 2, 28, { align: "center" });

  y = 48;
  doc.setTextColor(30, 30, 30);

  const wsNames = data.rows[0]?.stocks.map((s) => s.workspaceName) ?? [];
  const rowH = 8;

  // Encabezado tabla
  doc.setFillColor(99, 102, 241);
  doc.rect(14, y, pageW - 28, rowH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Medicamento", 16, y + 5.5);
  wsNames.forEach((ws, i) => doc.text(ws.split(" ")[1] ?? ws, 90 + i * 55, y + 5.5, { align: "center" }));
  doc.text("TOTAL", pageW - 20, y + 5.5, { align: "right" });
  y += rowH;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);

  for (let idx = 0; idx < data.rows.length; idx++) {
    const row = data.rows[idx];
    if (y > 185) { doc.addPage(); y = 20; }
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, pageW - 28, rowH, "F");
    }
    doc.setFontSize(8);
    doc.text(row.medicationName.slice(0, 30), 16, y + 5.5);
    let total = 0;
    row.stocks.forEach((s, i) => {
      total += s.quantity;
      const ratio = s.optimalStock > 0 ? s.quantity / s.optimalStock : 0;
      if (ratio < 0.3) doc.setTextColor(220, 38, 38);
      else if (ratio <= 1.1) doc.setTextColor(22, 163, 74);
      else doc.setTextColor(37, 99, 235);
      doc.text(s.quantity.toLocaleString("es-AR"), 90 + i * 55, y + 5.5, { align: "center" });
    });
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.text(total.toLocaleString("es-AR"), pageW - 20, y + 5.5, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += rowH;
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(150);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Meditory — Página ${i} de ${pageCount}`, pageW / 2, 198, { align: "center" });
  }

  doc.save(`stock-cruzado-meditory-${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (e) {
    console.error("Error generating stock report PDF:", e);
    throw e;
  }
}

export async function generateDashboardSnapshotPdf(elementId: string): Promise<void> {
  try {
    const domtoimage = (await import("dom-to-image-more")) as unknown as {
      toCanvas: (node: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
    };
    const element = document.getElementById(elementId);
    if (!element) { console.error("Element not found:", elementId); return; }

    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    const canvas = await domtoimage.toCanvas(element, { scale });

    const imgData = canvas.toDataURL("image/png");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pageW, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Meditory — Snapshot del Dashboard · ${new Date().toLocaleDateString("es-AR")}`, pageW / 2, 9, { align: "center" });

    const imgW = pageW - 10;
    const imgH = (canvas.height / canvas.width) * imgW;
    const maxH = pageH - 20;
    const finalH = Math.min(imgH, maxH);

    doc.addImage(imgData, "PNG", 5, 16, imgW, finalH);
    doc.save(`dashboard-estado-hospital-${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (e) {
    console.error("Error generating dashboard PDF:", e);
  }
}
