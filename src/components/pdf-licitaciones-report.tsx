import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { LicitacionRow, LowStockMedication, OverstockMedication, ProveedorRow } from "@/lib/server/backoffice-service";
import type { LicitacionEstado } from "@/lib/server/backoffice-service";

const ESTADO_LABELS: Record<LicitacionEstado, string> = {
  borrador: "Borrador",
  en_licitacion: "En Licitación",
  ofertas_recibidas: "Ofertas Recibidas",
  adjudicado: "Adjudicado",
  en_ejecucion: "En Ejecución",
  completado: "Completado",
  cancelado: "Cancelado",
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

function buildStandaloneReportHtml(
  reportHtml: string,
  pdfDataUrl: string | null,
  title: string,
  wsName: string | null,
): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  body{
    margin:0;padding:15px;
    font-family:Arial,Helvetica,sans-serif;
    color:#1e293b;background:#fff;
    font-size:10px;line-height:1.5;
  }
  table{border-collapse:collapse}
  .no-print{display:flex;gap:8px;align-items:center;margin-bottom:12px}
  .no-print button{
    padding:6px 14px;font-size:13px;border:1px solid #cbd5e1;
    border-radius:6px;background:#f8fafc;cursor:pointer;
    display:inline-flex;align-items:center;gap:6px;
  }
  .no-print button:hover{background:#f1f5f9}
  @media print{.no-print{display:none}}
</style>
</head>
<body>
  <div class="no-print">
    ${pdfDataUrl ? `<button onclick="location.href='${pdfDataUrl}'" download><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar PDF</button>` : `<span style="color:#94a3b8;font-size:11px">PDF no disponible (error al generar)</span>`}
    <button onclick="window.print()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M18 9h3a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h3"/><rect x="6" y="14" width="12" height="8"/></svg> Imprimir</button>
  </div>
  ${reportHtml}
</body>
</html>`;
}

interface Props {
  licitaciones: LicitacionRow[];
  lowStock: LowStockMedication[];
  overstock: OverstockMedication[];
  proveedores: ProveedorRow[];
  medMap: Map<string, string>;
  wsName: string | null;
}

export default function DownloadLicitacionesPdf(props: Props) {
  const { licitaciones, lowStock, overstock, proveedores, medMap, wsName } = props;
  const reportRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const handleDownload = useCallback(async () => {
    if (busy) return;
    setBusy(true);

    const el = reportRef.current;
    const reportHtml = el?.innerHTML ?? "";
    let pdfDataUrl: string | null = null;
    let doc: jsPDF | undefined;

    try {
      doc = new jsPDF("p", "mm", "a4");
      if (el) {
        // Temporarily override tailwind oklch border-color that breaks html2canvas
        const fixStyle = document.createElement("style");
        fixStyle.id = "pdf-temp-fix";
        fixStyle.textContent = `* { border-color: #e2e8f0 !important; }`;
        el.appendChild(fixStyle);

        await new Promise((r) => setTimeout(r, 100));

        const canvas = await html2canvas(el, {
          scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff",
        });

        el.removeChild(fixStyle);

        // Multi-page slicing
        const imgW = 190;
        const pageH = 277;
        const imgH = (canvas.height * imgW) / canvas.width;

        doc.setFontSize(8);
        doc.text(`Reporte Licitaciones - ${wsName}`, MARGIN, 5);

        let remaining = imgH;
        let srcY = 0;
        let page = 1;
        while (remaining > 0) {
          if (page > 1) doc.addPage();
          const sliceH = Math.min(remaining, pageH);
          const srcH = (sliceH * canvas.width) / imgW;

          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = srcH;
          const ctx = sliceCanvas.getContext("2d")!;
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
          const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
          doc.addImage(sliceData, "JPEG", MARGIN, MARGIN, imgW, sliceH);
          remaining -= sliceH;
          page++;
        }
      }

      pdfDataUrl = doc.output("datauristring");
    } catch (e) {
      console.error("PDF error:", e);
    }

    // Open new tab with standalone HTML report + PDF download button
    const win = window.open("", "_blank");
    if (win) {
      const standalone = buildStandaloneReportHtml(reportHtml, pdfDataUrl, "Reporte Licitaciones", wsName);
      win.document.write(standalone);
      win.document.close();
    } else if (pdfDataUrl && doc) {
      doc.save(`reporte-licitaciones-${new Date().toISOString().slice(0, 10)}.pdf`);
    }

    setBusy(false);
  }, [busy, wsName]);

  const totalDeficit = lowStock.reduce((s, i) => s + i.deficit, 0);
  const totalLoss = overstock.reduce((s, i) => s + i.lossAmount, 0);
  const activeLics = licitaciones.filter((l) => !["completado", "cancelado"].includes(l.estado));
  const borradorLics = licitaciones.filter((l) => l.estado === "borrador");
  const topDeficit = [...lowStock].sort((a, b) => b.deficit - a.deficit).slice(0, 5);
  const topOverstock = [...overstock].sort((a, b) => b.lossAmount - a.lossAmount).slice(0, 5);
  const today = new Date().toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" });

  const estadoCounts: Record<string, number> = {};
  licitaciones.forEach((l) => { estadoCounts[l.estado] = (estadoCounts[l.estado] ?? 0) + 1; });
  const estadoBars = Object.entries(estadoCounts).sort((a, b) => b[1] - a[1]);
  const licTotal = licitaciones.length || 1;

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleDownload} disabled={busy} className="gap-1.5">
        <FileText size={14} />
        {busy ? "Generando..." : "PDF Analítico"}
      </Button>

      <div ref={reportRef} style={{
        position: "absolute", left: "-9999px", top: 0, width: `${CONTENT_W}mm`,
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#1e293b", background: "#fff",
        padding: "5mm 0", fontSize: "10px", lineHeight: 1.5,
      }}>
        {/* ─── PAGE 1: HEADER + KPIs ─── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ borderBottom: "2px solid #3b82f6", paddingBottom: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: "bold", color: "#0ea5e9" }}>Meditory</div>
            <div style={{ fontSize: 8, color: "#64748b" }}>Sistema de Gestión Farmacéutica</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: "bold", marginBottom: 4 }}>Reporte Analítico de Licitaciones</div>
          <div style={{ fontSize: 8, color: "#64748b", marginBottom: 16 }}>Fecha: {today}{wsName ? ` — ${wsName}` : ""}</div>

          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {[
              { label: "DÉFICIT TOTAL", value: totalDeficit.toLocaleString("es-AR"), desc: `${lowStock.length} medicamentos bajo stock`, color: "#dc2626" },
              { label: "PÉRDIDA S/STOCK", value: `$${totalLoss.toLocaleString("es-AR")}`, desc: `${overstock.length} medicamentos excedidos`, color: "#d97706" },
              { label: "LICITACIONES ACTIVAS", value: String(activeLics.length), desc: `${licitaciones.length} total creadas`, color: "#2563eb" },
              { label: "PROVEEDORES", value: String(proveedores.length), desc: "Registrados en el sistema", color: "#16a34a" },
            ].map((k) => (
              <div key={k.label} style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 4, padding: "5px 7px" }}>
                <div style={{ fontSize: 7, fontWeight: "bold", color: k.color, marginBottom: 2 }}>{k.label}</div>
                <div style={{ fontSize: 14, fontWeight: "bold" }}>{k.value}</div>
                <div style={{ fontSize: 6, color: "#64748b" }}>{k.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, padding: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: "bold", marginBottom: 8 }}>Distribución por Estado</div>
            {estadoBars.length === 0 ? (
              <div style={{ fontSize: 7, color: "#64748b" }}>Sin licitaciones registradas</div>
            ) : (
              estadoBars.map(([estado, count]) => (
                <div key={estado} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3, fontSize: 7 }}>
                  <div style={{ width: 80, textAlign: "right" }}>{ESTADO_LABELS[estado as LicitacionEstado] ?? estado}</div>
                  <div style={{ flex: 1, height: 10, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${(count / licTotal) * 100}%`, height: "100%", background: "#3b82f6", borderRadius: 2 }} />
                  </div>
                  <div style={{ width: 28, fontWeight: "bold", textAlign: "right" }}>{count}</div>
                  <div style={{ width: 28, color: "#64748b", textAlign: "right" }}>{((count / licTotal) * 100).toFixed(0)}%</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── PAGE 2: TABLE ─── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
            Detalle de Licitaciones
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 7 }}>
            <thead>
              <tr style={{ background: "#3b82f6", color: "#fff" }}>
                <th style={{ padding: "3px 5px", textAlign: "left", width: "18%" }}>Código</th>
                <th style={{ padding: "3px 5px", textAlign: "left" }}>Título</th>
                <th style={{ padding: "3px 5px", textAlign: "center", width: "16%" }}>Estado</th>
                <th style={{ padding: "3px 5px", textAlign: "center", width: "14%" }}>Creador</th>
                <th style={{ padding: "3px 5px", textAlign: "center", width: "12%" }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {licitaciones.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 12, textAlign: "center", color: "#64748b", fontSize: 7 }}>Sin licitaciones registradas</td></tr>
              ) : (
                licitaciones.map((l, i) => (
                  <tr key={l.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                    <td style={{ padding: "2px 5px", fontFamily: "monospace" }}>{l.codigo}</td>
                    <td style={{ padding: "2px 5px" }}>{l.titulo}</td>
                    <td style={{ padding: "2px 5px", textAlign: "center" }}>{ESTADO_LABELS[l.estado] ?? l.estado}</td>
                    <td style={{ padding: "2px 5px", textAlign: "center" }}>{l.creado_por}</td>
                    <td style={{ padding: "2px 5px", textAlign: "center" }}>{new Date(l.fecha_creacion).toLocaleDateString("es-AR")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ─── PAGE 3: STOCK ANALYSIS ─── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
            Análisis de Stock
          </div>

          {topDeficit.length > 0 && (
            <>
              <div style={{ fontSize: 9, fontWeight: "bold", color: "#dc2626", marginBottom: 4 }}>Medicamentos con Bajo Stock (Top 5)</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 7, marginBottom: 10 }}>
                <thead>
                  <tr style={{ background: "#dc2626", color: "#fff" }}>
                    <th style={{ padding: "3px 5px", textAlign: "left" }}>Medicamento</th>
                    <th style={{ padding: "3px 5px", textAlign: "left" }}>Hospital</th>
                    <th style={{ padding: "3px 5px", textAlign: "center", width: "12%" }}>Stock</th>
                    <th style={{ padding: "3px 5px", textAlign: "center", width: "12%" }}>Mínimo</th>
                    <th style={{ padding: "3px 5px", textAlign: "center", width: "12%" }}>Déficit</th>
                  </tr>
                </thead>
                <tbody>
                    {topDeficit.map((item, i) => (
                    <tr key={item.medicationId + item.workspaceId + i} style={{ background: i % 2 === 0 ? "#fef2f2" : "#fff" }}>
                      <td style={{ padding: "2px 5px" }}>{item.medicationName}</td>
                      <td style={{ padding: "2px 5px" }}>{item.workspaceName}</td>
                      <td style={{ padding: "2px 5px", textAlign: "center" }}>{item.currentStock}</td>
                      <td style={{ padding: "2px 5px", textAlign: "center" }}>{item.minStock}</td>
                      <td style={{ padding: "2px 5px", textAlign: "center", fontWeight: "bold" }}>{item.deficit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {topOverstock.length > 0 && (
            <>
              <div style={{ fontSize: 9, fontWeight: "bold", color: "#d97706", marginBottom: 4 }}>Medicamentos con Sobre Stock (Top 5)</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 7, marginBottom: 10 }}>
                <thead>
                  <tr style={{ background: "#d97706", color: "#fff" }}>
                    <th style={{ padding: "3px 5px", textAlign: "left" }}>Medicamento</th>
                    <th style={{ padding: "3px 5px", textAlign: "left" }}>Hospital</th>
                    <th style={{ padding: "3px 5px", textAlign: "center", width: "10%" }}>Stock</th>
                    <th style={{ padding: "3px 5px", textAlign: "center", width: "10%" }}>Óptimo</th>
                    <th style={{ padding: "3px 5px", textAlign: "center", width: "10%" }}>Exc.</th>
                    <th style={{ padding: "3px 5px", textAlign: "center", width: "14%" }}>Pérdida Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {topOverstock.map((item, i) => (
                    <tr key={item.medicationId + item.workspaceId + i} style={{ background: i % 2 === 0 ? "#fffbeb" : "#fff" }}>
                      <td style={{ padding: "2px 5px" }}>{item.medicationName}</td>
                      <td style={{ padding: "2px 5px" }}>{item.workspaceName}</td>
                      <td style={{ padding: "2px 5px", textAlign: "center" }}>{item.currentStock}</td>
                      <td style={{ padding: "2px 5px", textAlign: "center" }}>{item.optimalStock}</td>
                      <td style={{ padding: "2px 5px", textAlign: "center" }}>+{item.surplus}</td>
                      <td style={{ padding: "2px 5px", textAlign: "center", fontWeight: "bold" }}>${item.lossAmount.toLocaleString("es-AR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {lowStock.length === 0 && overstock.length === 0 && (
            <div style={{ fontSize: 7, color: "#64748b", padding: 12, textAlign: "center" }}>
              Sin datos de stock bajo o sobre stock para analizar
            </div>
          )}

          {topDeficit.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: "bold", marginBottom: 6 }}>Top Déficit por Medicamento</div>
              <div style={{ width: "100%", maxWidth: 400 }}>
                {topDeficit.map((item, idx) => {
                  const maxVal = topDeficit[0]?.deficit || 1;
                  return (
                    <div key={item.medicationId + item.workspaceId + idx} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3, fontSize: 7 }}>
                      <div style={{ width: 100, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.medicationName}
                      </div>
                      <div style={{ flex: 1, height: 10, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${(item.deficit / maxVal) * 100}%`, height: "100%", background: "#dc2626", borderRadius: 2 }} />
                      </div>
                      <div style={{ width: 30, fontWeight: "bold", textAlign: "right" }}>{item.deficit}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ─── PAGE 4: RECOMMENDATIONS ─── */}
        <div>
          <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
            Recomendaciones y Análisis
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, padding: 12, fontSize: 8, lineHeight: 2.2 }}>
            <p style={{ margin: "0 0 8px 0", fontStyle: "italic", color: "#64748b" }}>
              Reporte generado automáticamente por Meditory. Las siguientes recomendaciones se basan en el análisis de los datos disponibles al {today}.
            </p>

            {lowStock.length > 0 && (
              <p style={{ margin: "3px 0" }}>
                <strong>■ Alerta de stock bajo:</strong> Se detectaron <strong>{lowStock.length}</strong> medicamentos con déficit total de <strong>{totalDeficit.toLocaleString("es-AR")} unidades</strong>. Se recomienda priorizar la compra inmediata de: {topDeficit.map((m, i) => <span key={i}><strong>{m.medicationName}</strong> ({m.deficit} u){i < topDeficit.length - 1 ? ", " : ""}</span>)}.
              </p>
            )}

            {borradorLics.length > 0 && (
              <p style={{ margin: "3px 0" }}>
                <strong>■ Licitaciones pendientes:</strong> <strong>{borradorLics.length}</strong> licitaciones permanecen en estado "Borrador" sin publicar. Se recomienda revisarlas y avanzarlas a "En Licitación" para iniciar el proceso de compra.
              </p>
            )}

            {activeLics.length === 0 && lowStock.length > 0 && (
              <p style={{ margin: "3px 0" }}>
                <strong>■ Sin licitaciones activas:</strong> No hay licitaciones activas a pesar de existir déficit de stock. Crear al menos una licitación de compra urgente para los medicamentos con mayor déficit.
              </p>
            )}

            {totalLoss > 0 && (
              <p style={{ margin: "3px 0" }}>
                <strong>■ Pérdida por sobrestock:</strong> La pérdida estimada asciende a <strong>${totalLoss.toLocaleString("es-AR")}</strong>. Evaluar redistribución entre depósitos o donación. Medicamentos con mayor excedente: {topOverstock.map((m, i) => <span key={i}><strong>{m.medicationName}</strong> (+{m.surplus} u){i < topOverstock.length - 1 ? ", " : ""}</span>)}.
              </p>
            )}

            {proveedores.length === 0 && (
              <p style={{ margin: "3px 0" }}>
                <strong>■ Sin proveedores registrados:</strong> No hay proveedores en el sistema. Registrar al menos un proveedor para poder recibir ofertas en las licitaciones.
              </p>
            )}

            <p style={{ margin: "3px 0" }}>
              <strong>■ Recomendación general:</strong> Revisar periódicamente los umbrales de stock mínimo y óptimo para cada medicamento. Mantener al menos 2-3 proveedores activos por categoría para asegurar competencia en las ofertas. Establecer un plazo máximo de 7 días para la revisión de licitaciones en estado "Borrador".
            </p>

            <p style={{ margin: "8px 0 0 0", color: "#94a3b8", fontSize: 7, borderTop: "1px solid #e2e8f0", paddingTop: 6 }}>
              Este reporte es generado automáticamente. Los datos reflejan el estado del sistema al momento de la generación. No reemplaza una auditoría profesional.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
