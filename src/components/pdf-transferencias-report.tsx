import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

const STATUS_LABELS: Record<string, string> = {
  solicitado: "Solicitado",
  autorizado: "Autorizado",
  despachado: "Despachado",
  recibir: "Pendiente Recepción",
  recibido: "Recibido",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
};

const STATUS_FLOW = ["solicitado", "autorizado", "despachado", "recibir", "recibido", "aceptado"];

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
  transfers: any[];
  medMap: Map<string, string>;
  whMap: Map<string, string>;
  wsName: string | null;
}

export default function DownloadTransferenciasPdf(props: Props) {
  const { transfers, medMap, whMap, wsName } = props;
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
        const fixStyle = document.createElement("style");
        fixStyle.id = "pdf-temp-fix";
        fixStyle.textContent = `* { border-color: #e2e8f0 !important; }`;
        el.appendChild(fixStyle);

        await new Promise((r) => setTimeout(r, 100));

        const canvas = await html2canvas(el, {
          scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff",
        });

        el.removeChild(fixStyle);

        const imgW = 190;
        const pageH = 277;
        const imgH = (canvas.height * imgW) / canvas.width;

        doc.setFontSize(8);
        doc.text(`Reporte Transferencias - ${wsName}`, MARGIN, 5);

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

    const win = window.open("", "_blank");
    if (win) {
      const standalone = buildStandaloneReportHtml(reportHtml, pdfDataUrl, "Reporte Transferencias", wsName);
      win.document.write(standalone);
      win.document.close();
    } else if (pdfDataUrl && doc) {
      doc.save(`reporte-transferencias-${new Date().toISOString().slice(0, 10)}.pdf`);
    }

    setBusy(false);
  }, [busy, wsName]);

  const total = transfers.length;
  const enCurso = transfers.filter((t: any) => !["aceptado", "rechazado"].includes(t.status)).length;
  const completadas = transfers.filter((t: any) => t.status === "aceptado").length;
  const rechazadas = transfers.filter((t: any) => t.status === "rechazado").length;
  const recibirCount = transfers.filter((t: any) => t.status === "recibir").length;

  const statusCounts: Record<string, number> = {};
  transfers.forEach((t: any) => { statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1; });
  const statusBars = STATUS_FLOW.filter((s) => (statusCounts[s] ?? 0) > 0).map((s) => [s, statusCounts[s] ?? 0] as const);
  statusBars.push(...Object.entries(statusCounts).filter(([s]) => !STATUS_FLOW.includes(s)));

  const origenCounts: Record<string, number> = {};
  transfers.forEach((t: any) => { const wh = whMap.get(t.from_warehouse_id) ?? t.from_warehouse_id; origenCounts[wh] = (origenCounts[wh] ?? 0) + 1; });
  const topOrigen = Object.entries(origenCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const today = new Date().toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" });
  const tTotal = total || 1;

  return (
    <>
      <Button size="sm" variant="ghost" onClick={handleDownload} disabled={busy} className="h-7 w-7 p-0">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
      </Button>

      <div ref={reportRef} style={{
        position: "absolute", left: "-9999px", top: 0, width: `${CONTENT_W}mm`,
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#1e293b", background: "#fff",
        padding: "5mm 0", fontSize: "10px", lineHeight: 1.5,
      }}>
        {/* ─── PAGE 1: HEADER + KPIs ─── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ borderBottom: "2px solid #8b5cf6", paddingBottom: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: "bold", color: "#0ea5e9" }}>Meditory</div>
            <div style={{ fontSize: 8, color: "#64748b" }}>Sistema de Gestión Farmacéutica</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: "bold", marginBottom: 4 }}>Reporte Analítico de Transferencias</div>
          <div style={{ fontSize: 8, color: "#64748b", marginBottom: 16 }}>Fecha: {today}{wsName ? ` — ${wsName}` : ""}</div>

          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {[
              { label: "TRANSFERENCIAS", value: String(total), desc: "Registradas en el sistema", color: "#6366f1" },
              { label: "EN CURSO", value: String(enCurso), desc: `${total > 0 ? ((enCurso / total) * 100).toFixed(0) : 0}% del total`, color: "#f59e0b" },
              { label: "COMPLETADAS", value: String(completadas), desc: "Aceptadas correctamente", color: "#10b981" },
              { label: "RECHAZADAS", value: String(rechazadas), desc: `${rechazadas > 0 ? ((rechazadas / total) * 100).toFixed(0) : 0}% del total`, color: "#ef4444" },
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
            {statusBars.length === 0 ? (
              <div style={{ fontSize: 7, color: "#64748b" }}>Sin transferencias registradas</div>
            ) : (
              statusBars.map(([status, count]) => (
                <div key={status} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3, fontSize: 7 }}>
                  <div style={{ width: 90, textAlign: "right" }}>{STATUS_LABELS[status] ?? status}</div>
                  <div style={{ flex: 1, height: 10, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${((count as number) / tTotal) * 100}%`, height: "100%", background: "#8b5cf6", borderRadius: 2 }} />
                  </div>
                  <div style={{ width: 28, fontWeight: "bold", textAlign: "right" }}>{count as number}</div>
                  <div style={{ width: 28, color: "#64748b", textAlign: "right" }}>{((count as number) / tTotal * 100).toFixed(0)}%</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── PAGE 2: TABLE ─── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
            Detalle de Transferencias
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 7 }}>
            <thead>
              <tr style={{ background: "#8b5cf6", color: "#fff" }}>
                <th style={{ padding: "3px 5px", textAlign: "left", width: "14%" }}>Código</th>
                <th style={{ padding: "3px 5px", textAlign: "left" }}>Medicamento</th>
                <th style={{ padding: "3px 5px", textAlign: "left", width: "16%" }}>Origen</th>
                <th style={{ padding: "3px 5px", textAlign: "left", width: "16%" }}>Destino</th>
                <th style={{ padding: "3px 5px", textAlign: "center", width: "8%" }}>Cant.</th>
                <th style={{ padding: "3px 5px", textAlign: "center", width: "14%" }}>Estado</th>
                <th style={{ padding: "3px 5px", textAlign: "center", width: "12%" }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 12, textAlign: "center", color: "#64748b", fontSize: 7 }}>Sin transferencias registradas</td></tr>
              ) : (
                transfers.map((t: any, i: number) => (
                  <tr key={t.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                    <td style={{ padding: "2px 5px", fontFamily: "monospace" }}>{t.transfer_code ?? t.id?.slice(0, 8)}</td>
                    <td style={{ padding: "2px 5px" }}>{medMap.get(t.medication_id) ?? t.medication_id?.slice(0, 8)}</td>
                    <td style={{ padding: "2px 5px" }}>{whMap.get(t.from_warehouse_id) ?? t.from_warehouse_id?.slice(0, 8)}</td>
                    <td style={{ padding: "2px 5px" }}>{whMap.get(t.to_warehouse_id) ?? t.to_warehouse_id?.slice(0, 8)}</td>
                    <td style={{ padding: "2px 5px", textAlign: "center", fontWeight: "bold" }}>{t.quantity}</td>
                    <td style={{ padding: "2px 5px", textAlign: "center" }}>{STATUS_LABELS[t.status] ?? t.status}</td>
                    <td style={{ padding: "2px 5px", textAlign: "center" }}>{t.date ? new Date(t.date).toLocaleDateString("es-AR") : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ─── PAGE 3: FLOW ANALYSIS ─── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
            Análisis de Flujo
          </div>

          {topOrigen.length > 0 && (
            <>
              <div style={{ fontSize: 9, fontWeight: "bold", color: "#6366f1", marginBottom: 6 }}>Transferencias por Depósito de Origen (Top 5)</div>
              <div style={{ width: "100%", maxWidth: 400, marginBottom: 14 }}>
                {topOrigen.map(([name, count], i) => {
                  const maxVal = topOrigen[0]?.[1] || 1;
                  return (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3, fontSize: 7 }}>
                      <div style={{ width: 110, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                      <div style={{ flex: 1, height: 10, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${(count / maxVal) * 100}%`, height: "100%", background: "#8b5cf6", borderRadius: 2 }} />
                      </div>
                      <div style={{ width: 28, fontWeight: "bold", textAlign: "right" }}>{count}</div>
                      <div style={{ width: 28, color: "#64748b", textAlign: "right" }}>{((count / tTotal) * 100).toFixed(0)}%</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, padding: 10 }}>
            <div style={{ fontSize: 9, fontWeight: "bold", marginBottom: 6 }}>Flujo de Estados</div>
            <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", fontSize: 6 }}>
              {STATUS_FLOW.map((s, i) => (
                <span key={s}>
                  <span style={{ display: "inline-block", padding: "2px 6px", borderRadius: 3, background: "#ede9fe", fontWeight: "bold" }}>
                    {STATUS_LABELS[s]} ({(statusCounts[s] ?? 0)})
                  </span>
                  {i < STATUS_FLOW.length - 1 && <span style={{ color: "#94a3b8", margin: "0 2px" }}>→</span>}
                </span>
              ))}
            </div>
          </div>
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

            {enCurso > 0 && (
              <p style={{ margin: "3px 0" }}>
                <strong>■ Transferencias en curso:</strong> <strong>{enCurso}</strong> transferencias están actualmente activas ({((enCurso / tTotal) * 100).toFixed(0)}% del total). Requieren seguimiento y acciones por parte de los responsables de cada depósito.
              </p>
            )}

            {recibirCount > 0 && (
              <p style={{ margin: "3px 0" }}>
                <strong>■ Pendientes de recepción:</strong> <strong>{recibirCount}</strong> transferencias esperan confirmación de recepción. Contactar a los destinatarios para agilizar el cierre del ciclo logístico.
              </p>
            )}

            {topOrigen.length > 0 && (
              <p style={{ margin: "3px 0" }}>
                <strong>■ Depósito con mayor actividad de salida:</strong> "{topOrigen[0]?.[0]}" concentra <strong>{topOrigen[0]?.[1]} transferencias</strong> ({((topOrigen[0]?.[1] / tTotal) * 100).toFixed(0)}% del total). Verificar capacidad operativa y tiempos de despacho.
              </p>
            )}

            {rechazadas > 0 && (
              <p style={{ margin: "3px 0" }}>
                <strong>■ Transferencias rechazadas:</strong> <strong>{rechazadas}</strong> transferencias fueron rechazadas. Revisar causas recurrentes (caja dañada, medicamento incorrecto, vencimiento) y reforzar los controles de calidad previos al despacho.
              </p>
            )}

            {completadas === 0 && total > 0 && (
              <p style={{ margin: "3px 0" }}>
                <strong>■ Sin completadas:</strong> No hay transferencias completadas exitosamente. Revisar el flujo completo para identificar posibles cuellos de botella en las etapas de autorización, despacho o recepción.
              </p>
            )}

            {total === 0 && (
              <p style={{ margin: "3px 0" }}>
                <strong>■ Sin transferencias:</strong> No hay transferencias registradas en el sistema. Evaluar la necesidad de crear solicitudes de transferencia entre depósitos para optimizar la distribución de stock.
              </p>
            )}

            <p style={{ margin: "3px 0" }}>
              <strong>■ Recomendación general:</strong> Establecer un límite de tiempo máximo por etapa del flujo (ej: 24h para autorizar, 48h para despachar) para optimizar el tiempo total de transferencia. Implementar notificaciones automáticas cuando una transferencia supere el tiempo esperado en una etapa.
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
