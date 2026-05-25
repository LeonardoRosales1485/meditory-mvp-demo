import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const MARGIN = 20;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Añade encabezado institucional a la página actual. */
function addHeader(doc: jsPDF, title: string, pageNum: number) {
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Meditory", MARGIN, 18);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Sistema de Gestión Farmacéutica", MARGIN, 23);
  doc.line(MARGIN, 26, PAGE_WIDTH - MARGIN, 26);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN, 37);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const today = new Date().toLocaleDateString("es-AR", {
    year: "numeric", month: "long", day: "numeric",
  });
  doc.text(`Fecha: ${today}`, MARGIN, 43);
  doc.text(`Pág. ${pageNum}`, PAGE_WIDTH - MARGIN - 10, 18, { align: "right" });
}

/** Añade footer a la página actual. */
function addFooter(doc: jsPDF, pageNum: number) {
  doc.setDrawColor(200);
  doc.line(MARGIN, PAGE_HEIGHT - 15, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 15);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Reporte generado por Meditory — Sistema de Gestión Farmacéutica",
    MARGIN,
    PAGE_HEIGHT - 10,
  );
  doc.text(`Página ${pageNum}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10, { align: "right" });
}

/** Dibuja una tabla simple con filas y columnas. */
function drawTable(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  startY: number,
  opts?: { fontSize?: number; colWidths?: number[] },
): number {
  const fs = opts?.fontSize ?? 7;
  const cw = opts?.colWidths ?? Array(headers.length).fill(CONTENT_WIDTH / headers.length);
  const rowH = fs * 2.5;
  let y = startY;
  const pageBottom = PAGE_HEIGHT - 20;

  // Header row
  doc.setFillColor(59, 130, 246);
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fs);
  let x = MARGIN;
  headers.forEach((h, i) => {
    doc.rect(x, y, cw[i], rowH, "F");
    doc.text(h, x + 1, y + rowH - 3, { maxWidth: cw[i] - 2 });
    x += cw[i];
  });
  y += rowH;

  // Data rows
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  rows.forEach((row, ri) => {
    if (y + rowH > pageBottom) {
      addFooter(doc, doc.getNumberOfPages());
      doc.addPage();
      const pn = doc.getNumberOfPages();
      addHeader(doc, doc.getFontSize() > 12 ? "" : "", pn);
      y = 50;
    }
    if (ri % 2 === 0) {
      doc.setFillColor(249, 250, 251);
    } else {
      doc.setFillColor(255);
    }
    x = MARGIN;
    row.forEach((cell, ci) => {
      if (ri % 2 === 0) doc.rect(x, y, cw[ci], rowH, "F");
      doc.text(String(cell ?? "—"), x + 1, y + rowH - 3, { maxWidth: cw[ci] - 2 });
      x += cw[ci];
    });
    y += rowH;
  });

  return y;
}

/** Dibuja un KPI card (label, large value, description). */
function drawKpiCard(
  doc: jsPDF,
  label: string,
  value: string,
  description: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(255);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text(label, x + 4, y + 8);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(value, x + 4, y + 24);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(description, x + 4, y + 32);
  doc.setTextColor(0);
}

/** Genera recomendaciones plantilla para licitaciones. */
function licitacionesRecommendations(data: {
  lowStockCount: number;
  totalDeficit: number;
  borradorCount: number;
  activeCount: number;
  totalLoss: number;
  topDeficitMeds: string[];
  topOverstockMeds: string[];
}): string[] {
  const lines: string[] = [];
  if (data.lowStockCount > 0) {
    lines.push(
      `• Se detectaron ${data.lowStockCount} medicamentos con déficit total de ${data.totalDeficit.toLocaleString("es-AR")} unidades. Se recomienda priorizar la compra inmediata.`,
    );
  }
  if (data.borradorCount > 0) {
    lines.push(
      `• ${data.borradorCount} licitaciones permanecen en estado "Borrador" sin publicar. Revisar y avanzar al estado "En Licitación" para iniciar el proceso de compra.`,
    );
  }
  if (data.activeCount === 0 && data.lowStockCount > 0) {
    lines.push(
      "• No hay licitaciones activas a pesar de existir stock bajo. Se recomienda crear al menos una licitación de compra urgente.",
    );
  }
  if (data.totalLoss > 0) {
    lines.push(
      `• La pérdida estimada por sobrestock asciende a $${data.totalLoss.toLocaleString("es-AR")}. Evaluar redistribución entre depósitos o donación.`,
    );
  }
  if (data.topDeficitMeds.length > 0) {
    lines.push(
      `• Priorizar compra de: ${data.topDeficitMeds.join(", ")}.`,
    );
  }
  if (data.topOverstockMeds.length > 0) {
    lines.push(
      `• Evaluar redistribución de: ${data.topOverstockMeds.join(", ")}.`,
    );
  }
  if (lines.length === 0) {
    lines.push("• Sin alertas relevantes. Todos los indicadores se encuentran dentro de parámetros normales.");
  }
  lines.push("• Revisar periódicamente los umbrales de stock mínimo y óptimo para cada medicamento.");
  return lines;
}

/** Genera recomendaciones plantilla para transferencias. */
function transferenciasRecommendations(data: {
  total: number;
  enCurso: number;
  recibirCount: number;
  topOrigen: { name: string; count: number } | null;
  completadas: number;
  rechazadas: number;
}): string[] {
  const lines: string[] = [];
  if (data.enCurso > 0) {
    lines.push(
      `• ${data.enCurso} transferencias están actualmente en curso (${((data.enCurso / data.total) * 100).toFixed(0)}% del total). Requieren seguimiento y acciones de los responsables.`,
    );
  }
  if (data.recibirCount > 0) {
    lines.push(
      `• ${data.recibirCount} transferencias en estado "Pendiente Recepción" esperan confirmación. Contactar a los destinatarios para agilizar el cierre.`,
    );
  }
  if (data.topOrigen) {
    lines.push(
      `• El depósito "${data.topOrigen.name}" concentra ${data.topOrigen.count} transferencias de salida. Verificar capacidad operativa.`,
    );
  }
  if (data.rechazadas > 0) {
    lines.push(
      `• ${data.rechazadas} transferencias fueron rechazadas. Revisar causas recurrentes (caja dañada, medicamento incorrecto) y reforzar controles de calidad.`,
    );
  }
  if (data.completadas === 0 && data.total > 0) {
    lines.push(
      "• No hay transferencias completadas. Revisar el flujo para identificar posibles cuellos de botella.",
    );
  }
  if (lines.length === 0) {
    lines.push("• Sin alertas relevantes en el flujo de transferencias.");
  }
  lines.push("• Se recomienda establecer un límite de tiempo máximo por etapa para optimizar el flujo logístico.");
  return lines;
}

/** Helper: añade texto con salto de línea. */
function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  lines.forEach((line: string) => {
    if (y > PAGE_HEIGHT - 25) {
      addFooter(doc, doc.getNumberOfPages());
      doc.addPage();
      const pn = doc.getNumberOfPages();
      addHeader(doc, "", pn);
      y = 50;
    }
    doc.text(line, x, y);
    y += lineHeight;
  });
  return y;
}

export {
  MARGIN,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  CONTENT_WIDTH,
  addHeader,
  addFooter,
  drawTable,
  drawKpiCard,
  licitacionesRecommendations,
  transferenciasRecommendations,
  addWrappedText,
};
