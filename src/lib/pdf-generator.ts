import { jsPDF } from "jspdf";

function splitTextToLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const testLine = line ? line + " " + word : word;
    if (doc.getTextWidth(testLine) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawSectionTitle(doc: jsPDF, x: number, y: number, title: string): number {
  doc.setFillColor(99, 102, 241);
  doc.setDrawColor(99, 102, 241);
  doc.rect(x, y - 4, 3, 10, "F");
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, x + 6, y + 2);
  return y + 8;
}

function drawBodyText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, maxY: number, pageH: number): number {
  const lines = splitTextToLines(doc, text, maxWidth);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  for (const line of lines) {
    if (y + 5 > maxY) {
      doc.setTextColor(150);
      doc.setFontSize(6);
      doc.text(`Meditory MVP — Página ${doc.getNumberOfPages()}`, doc.internal.pageSize.getWidth() / 2, pageH - 5, { align: "center" });
      doc.addPage();
      y = 14;
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
    }
    doc.text(line, x, y + 3);
    y += 4.5;
  }
  return y + 3;
}

function drawBulletList(doc: jsPDF, items: string[], x: number, y: number, maxWidth: number, maxY: number, pageH: number): number {
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  for (const item of items) {
    if (y + 5 > maxY) {
      doc.setTextColor(150);
      doc.setFontSize(6);
      doc.text(`Meditory MVP — Página ${doc.getNumberOfPages()}`, doc.internal.pageSize.getWidth() / 2, pageH - 5, { align: "center" });
      doc.addPage();
      y = 14;
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
    }
    const bullet = "•  " + item;
    const lines = splitTextToLines(doc, bullet, maxWidth);
    for (const line of lines) {
      if (y + 5 > maxY) {
        doc.setTextColor(150);
        doc.setFontSize(6);
        doc.text(`Meditory MVP — Página ${doc.getNumberOfPages()}`, doc.internal.pageSize.getWidth() / 2, pageH - 5, { align: "center" });
        doc.addPage();
        y = 14;
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
      }
      doc.text(line, x, y + 3);
      y += 5;
    }
    y += 0.5;
  }
  return y + 3;
}

export interface ChartReportData {
  title: string;
  chartImageData: string;
  workspaceNames: string[];
  date: string;
  analysis: string;
  recommendations: string[];
  tips?: string[];
}

export async function generateChartReportPdf(data: ChartReportData): Promise<void> {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageW - margin * 2;
    const maxY = pageH - 14;

    // ── Header ──
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("Meditory MVP", pageW / 2, 8, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(data.title, pageW / 2, 15.5, { align: "center" });

    const wsLabel = data.workspaceNames.length > 0 ? data.workspaceNames.join(" · ") : "Todos los hospitales";
    doc.setFontSize(7);
    doc.text(`${wsLabel} · ${data.date}`, pageW / 2, 20, { align: "center" });

    let y = 28;

    // ── Chart Image ──
    const imgWidth = contentWidth;
    const imgHeight = Math.min(imgWidth * 0.5, 100);
    try {
      doc.addImage(data.chartImageData, "PNG", margin, y, imgWidth, imgHeight);
      y += imgHeight + 6;
    } catch {
      doc.setDrawColor(200);
      doc.setFillColor(245, 245, 250);
      doc.roundedRect(margin, y, imgWidth, 50, 3, 3, "FD");
      doc.setTextColor(150);
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text("(vista previa del gráfico)", pageW / 2, y + 27, { align: "center" });
      y += 56;
    }

    // ── Línea separadora ──
    doc.setDrawColor(220, 220, 230);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    // ── Análisis ──
    if (y + 8 > maxY) { doc.addPage(); y = 14; }
    y = drawSectionTitle(doc, margin, y, "Análisis");
    if (y + 8 > maxY) { doc.addPage(); y = 14; }
    y = drawBodyText(doc, data.analysis, margin, y, contentWidth, maxY, pageH);
    y += 2;

    // ── Línea separadora ──
    if (y + 4 < maxY) {
      doc.setDrawColor(220, 220, 230);
      doc.line(margin, y, pageW - margin, y);
      y += 6;
    }

    // ── Recomendaciones ──
    if (data.recommendations.length > 0) {
      if (y + 8 > maxY) { doc.addPage(); y = 14; }
      y = drawSectionTitle(doc, margin, y, "Recomendaciones");
      if (y + 8 > maxY) { doc.addPage(); y = 14; }
      y = drawBulletList(doc, data.recommendations, margin, y, contentWidth, maxY, pageH);
      y += 2;
    }

    // ── Tips ──
    if (data.tips && data.tips.length > 0) {
      if (y + 8 > maxY) { doc.addPage(); y = 14; }
      doc.setFillColor(255, 247, 237);
      doc.setDrawColor(251, 191, 36);
      doc.roundedRect(margin, y - 2, contentWidth, 18, 3, 3, "FD");
      doc.setTextColor(180, 100, 10);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("💡 Tips", margin + 4, y + 4);
      doc.setTextColor(130, 80, 20);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      let tipY = y + 4;
      for (const tip of data.tips) {
        const lines = splitTextToLines(doc, "•  " + tip, contentWidth - 10);
        for (const line of lines) {
          if (tipY + 5 > maxY) break;
          doc.text(line, margin + 4, tipY + 5);
          tipY += 4.5;
        }
      }
      y = tipY + 6;
    }

    // ── Footer on all pages ──
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setTextColor(160);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text(`Meditory MVP — Sistema de Gestión Farmacéutica · Página ${i} de ${pageCount}`, pageW / 2, pageH - 5, { align: "center" });
    }

    const safeTitle = data.title.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
    doc.save(`reporte-${safeTitle}-${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (e) {
    console.error("Error generating chart report PDF:", e);
    throw e;
  }
}

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
  doc.text("Meditory MVP — Sistema de Gestión Farmacéutica", pageW / 2, 28, { align: "center" });
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
  doc.text(`Meditory MVP · ${new Date().toLocaleDateString("es-AR")}`, pageW / 2, 28, { align: "center" });

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
    doc.text(`Meditory MVP — Snapshot del Dashboard · ${new Date().toLocaleDateString("es-AR")}`, pageW / 2, 9, { align: "center" });

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
