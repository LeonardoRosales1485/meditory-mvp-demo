import { jsPDF } from "jspdf";
import type { Batch, Medication, Warehouse, Movement } from "./domain-types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export type ReportData = {
  workspaceName: string;
  medications: Medication[];
  warehouses: Warehouse[];
  batches: Batch[];
  movements: Movement[];
};

function addHeader(doc: jsPDF, title: string, workspaceName: string) {
  doc.setFontSize(18);
  doc.text("Meditory", 14, 20);
  doc.setFontSize(10);
  doc.text(`Institución: ${workspaceName}`, 14, 28);
  doc.text(`Generado: ${formatDate(new Date().toISOString())}`, 14, 34);
  doc.setFontSize(14);
  doc.text(title, 14, 44);
  doc.line(14, 48, 196, 48);
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${pageCount}`, 196, 290, { align: "right" });
    doc.text("Meditory — Sistema de Gestión Farmacéutica", 14, 290);
  }
}

export function generateStockReport(data: ReportData, title?: string): jsPDF {
  const doc = new jsPDF();
  addHeader(doc, title || "Reporte de Stock Actual", data.workspaceName);

  const whMap = new Map(data.warehouses.map((w) => [w.id, w]));
  const medMap = new Map(data.medications.map((m) => [m.id, m]));

  const byWarehouse: Record<string, Batch[]> = {};
  for (const b of data.batches) {
    if (!byWarehouse[b.warehouseId]) byWarehouse[b.warehouseId] = [];
    byWarehouse[b.warehouseId].push(b);
  }

  let y = 54;
  const lineH = 6;
  const pageHeight = 280;

  for (const [whId, batches] of Object.entries(byWarehouse)) {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 20;
      addHeader(doc, title ?? "Reporte de Stock Actual", data.workspaceName);
      y += 10;
    }

    const wh = whMap.get(whId);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(wh?.name ?? whId, 14, y);
    y += lineH;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    for (const b of batches) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(wh?.name ?? whId, 14, y);
        y += lineH;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
      }
      const med = medMap.get(b.medicationId);
      const medName = med ? `${med.name} ${med.concentrationValue}${med.concentrationUnit}` : b.medicationId;
      const expiryDate = formatDate(b.expiry);
      doc.text(`  ${medName} — lote: ${b.lot} — vence: ${expiryDate} — ${b.quantity} u.`, 14, y);
      y += lineH;
    }
    y += 2;
  }

  addFooter(doc);
  return doc;
}

export function generateExpiriesReport(data: ReportData, title?: string): jsPDF {
  const doc = new jsPDF();
  addHeader(doc, title ?? "Reporte de Lotes Próximos a Vencer", data.workspaceName);

  const medMap = new Map(data.medications.map((m) => [m.id, m]));
  const whMap = new Map(data.warehouses.map((w) => [w.id, w]));

  const now = Date.now();
  const in90Days = now + 90 * 24 * 60 * 60 * 1000;
  const critical = data.batches
    .filter((b) => {
      const expiry = new Date(b.expiry).getTime();
      return expiry > now && expiry <= in90Days;
    })
    .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());

  let y = 54;
  const lineH = 6;

  doc.setFontSize(9);
  if (critical.length === 0) {
    doc.text("No hay lotes próximos a vencer en los próximos 90 días.", 14, y);
  } else {
    for (const b of critical) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const med = medMap.get(b.medicationId);
      const wh = whMap.get(b.warehouseId);
      const medName = med ? `${med.name} ${med.concentrationValue}${med.concentrationUnit}` : b.medicationId;
      const whName = wh?.name ?? b.warehouseId;
      const daysLeft = Math.floor((new Date(b.expiry).getTime() - now) / (1000 * 60 * 60 * 24));
      const status = daysLeft <= 30 ? "CRÍTICO" : daysLeft <= 60 ? "PRÓXIMO" : "VIGILAR";
      doc.text(`${medName.padEnd(40)} ${whName.padEnd(20)} Vence: ${formatDate(b.expiry)} (${daysLeft} días) [${status}]`, 14, y);
      y += lineH;
    }
  }

  addFooter(doc);
  return doc;
}

export function generateMovementsReport(data: ReportData, periodDays: number, title?: string): jsPDF {
  const doc = new jsPDF();
  addHeader(doc, title ?? `Reporte de Movimientos (últimos ${periodDays} días)`, data.workspaceName);

  const medMap = new Map(data.medications.map((m) => [m.id, m]));
  const whMap = new Map(data.warehouses.map((w) => [w.id, w]));
  const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;

  const filtered = data.movements
    .filter((m) => new Date(m.date).getTime() >= cutoff)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let y = 54;
  const lineH = 6;

  doc.setFontSize(9);
  if (filtered.length === 0) {
    doc.text(`No hay movimientos en los últimos ${periodDays} días.`, 14, y);
  } else {
    for (const m of filtered) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const med = medMap.get(m.medicationId);
      const wh = whMap.get(m.warehouseId);
      const medName = med ? `${med.name} ${med.concentrationValue}${med.concentrationUnit}` : m.medicationId;
      const whName = wh?.name ?? m.warehouseId;
      const sign = m.quantity > 0 ? "+" : "";
      doc.text(`${formatDate(m.date)}  ${m.type.padEnd(14)} ${medName.padEnd(30)} ${whName.padEnd(18)} ${sign}${m.quantity} u.  ${m.user}`, 14, y);
      y += lineH;
    }
  }

  addFooter(doc);
  return doc;
}

export function downloadReport(doc: jsPDF, filename: string) {
  doc.save(filename);
}
