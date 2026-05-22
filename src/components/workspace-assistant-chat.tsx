import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Send, StopCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { buildWorkspaceAssistantContext, answerStockQueryFromSnapshot, answerTransferPipelineFromSnapshot, type AssistantWorkspaceSnapshotInput } from "@/lib/assistant-workspace-context";
import {
  isExplicitTransferCreationIntent,
  isQuantityQuestionWithoutNavIntent,
  isTransferPipelineInfoQuestion,
  isWeakModelStockReply,
} from "@/lib/assistant-chat-intent";
import {
  assistantTools,
  extractLegacyToolBlocks,
  navigateToolToOptions,
  parseCreateTransferArgs,
  parseNavigateArgs,
  parseOllamaToolArguments,
  stripBareToolJsonFromAssistantContent,
  validateTransferAgainstBatches,
  type CreateTransferToolArgs,
  type OllamaToolCall,
} from "@/lib/assistant-tools";
import { streamAiChat, type ChatMessage } from "@/lib/ai-chat";
import { medName, warehouseName } from "@/lib/domain-types";
import { useStore } from "@/lib/store";

const SYSTEM_INSTRUCTIONS = `Sos el asistente de **Meditory** (gestión farmacéutica hospitalaria: depósitos, lotes, vencimientos, transferencias entre depósitos, pedidos clínicos, dispensación, ventas y auditoría).

TONO: hablá siempre en **español** claro, cordial y profesional, como un/a colega de farmacia hospitalaria: empático, respetuoso y tranquilo. No des diagnósticos ni indicaciones clínicas al paciente; orientás sobre **operaciones y datos del sistema** (stock, transferencias, pedidos, etc.).

FORMATO: respondé en **prosa** (oraciones). **Nunca** devuelvas solo JSON, bloques de herramienta sueltos ni cadenas tipo \`{"name":"navigate"…};{"name":"create_transfer"…}\`. Si usás datos numéricos, copiá cifras coherentes con el snapshot.

DATOS: todo lo relevante va en el JSON **institucion_snapshot** del mismo mensaje.
- Stock por medicamento: **stockByMedicationId**, **topMedicationsByUnits**, **batchesSample**.
- Transferencias abiertas: **pendingTransfers** (cada ítem: medicamento, cantidad, estado, depósitos origen/destino). Resumen: **summary** (incluye **towardReceiptUnits** = unidades en *despachado* o *recibir*, próximas a recepción en destino).
- Para "¿cuánto hay en transferencia / en tránsito / por recibir?" sumá cantidades desde **pendingTransfers** y **summary**; no inventes rutas ni IDs.

HERRAMIENTAS (solo estas dos; no inventes otras):
1) **navigate** — SOLO si el usuario pidió explícitamente ir, abrir, mostrar o entrar a una pantalla. Rutas internas válidas empiezan con **/app/** (ej. \`/app/transferencias\`). Nunca uses navigate solo porque preguntaron cantidades o listados.

2) **create_transfer** — SOLO si el usuario pidió **explícitamente** solicitar o crear una transferencia (frase de pedido, no una pregunta informativa). Requiere IDs reales del snapshot y confirmación en pantalla. **Prohibido** usar create_transfer para consultas del tipo "¿cuánto medicamento hay en transferencia?" o "¿qué hay por recibir?".

Consultas **solo informativas** (cantidades, listados, estados): respondé con texto desde el snapshot; **no** llames herramientas. Si no alcanzan los datos, decilo con amabilidad y sugerí la pantalla correspondiente en la app.

Si no tenés datos suficientes, decilo y sugerí **Inventario**, **Transferencias** o **Catálogo** según el caso.`;

type UiMessage = { role: "user" | "assistant"; content: string };

function buildSystemMessage(snapshotJson: string): string {
  return `${SYSTEM_INSTRUCTIONS}\n\ninstitucion_snapshot:\n${snapshotJson}`;
}

/** Si el modelo devuelve solo un JSON de "herramienta" inventada, reemplazar por mensaje útil. */
function sanitizeHallucinatedToolOnlyReply(content: string): string {
  const t = content.trim();
  if (!t.startsWith("{") || !t.endsWith("}")) return content;
  try {
    const o = JSON.parse(t) as { name?: string };
    if (typeof o.name !== "string") return content;
    if (o.name === "navigate" || o.name === "create_transfer") return content;
    return (
      `No existe la herramienta «${o.name}». Solo están disponibles **navigate** y **create_transfer**. ` +
      `Para saber unidades de un medicamento hay que leer el JSON del snapshot (campo **stockByMedicationId** y **batchesSample**) y responder en texto con la cantidad. ` +
      `Probá de nuevo preguntando sin pedir una función inventada, o revisá Inventario en la app.`
    );
  } catch {
    return content;
  }
}

function processToolCalls(
  toolCalls: OllamaToolCall[],
  navigate: ReturnType<typeof useNavigate>,
  batches: AssistantWorkspaceSnapshotInput["batches"],
  onCreateTransfer: (args: CreateTransferToolArgs) => void,
  opts?: { suppressNavigate?: boolean; suppressCreateTransfer?: boolean },
): string[] {
  const lines: string[] = [];
  for (const tc of toolCalls) {
    const name = tc.function?.name;
    const raw = parseOllamaToolArguments(tc);
    if (name === "navigate") {
      if (opts?.suppressNavigate) {
        lines.push("_(Navegación no ejecutada: la pregunta era informativa.)_");
        continue;
      }
      const args = parseNavigateArgs(raw);
      if (!args) {
        lines.push("Navegación rechazada: ruta o parámetros no válidos.");
        continue;
      }
      void navigate(navigateToolToOptions(args));
      lines.push(`Navegación: ${args.path}${args.search ? ` (${JSON.stringify(args.search)})` : ""}.`);
    } else if (name === "create_transfer") {
      if (opts?.suppressCreateTransfer) {
        lines.push(
          "_(No se abrió solicitud de transferencia: tu mensaje no incluye un pedido explícito de crear/solicitar transferencia.)_",
        );
        continue;
      }
      const args = parseCreateTransferArgs(raw);
      if (!args) {
        lines.push("Transferencia no solicitada: argumentos inválidos.");
        continue;
      }
      const err = validateTransferAgainstBatches(args, batches);
      if (err) {
        lines.push(`Transferencia no confirmada: ${err}`);
        continue;
      }
      onCreateTransfer(args);
      lines.push("Se abrió el diálogo de confirmación para la transferencia.");
    } else {
      lines.push(`Herramienta desconocida ignorada: ${name ?? "?"}`);
    }
  }
  return lines;
}

function processLegacyTools(
  tools: { name: string; args: unknown }[],
  navigate: ReturnType<typeof useNavigate>,
  batches: AssistantWorkspaceSnapshotInput["batches"],
  onCreateTransfer: (args: CreateTransferToolArgs) => void,
  opts?: { suppressNavigate?: boolean; suppressCreateTransfer?: boolean },
): string[] {
  const lines: string[] = [];
  for (const t of tools) {
    if (t.name === "navigate") {
      if (opts?.suppressNavigate) {
        lines.push("Navegación legacy omitida (pregunta informativa).");
        continue;
      }
      const args = parseNavigateArgs(t.args);
      if (!args) {
        lines.push("Navegación rechazada (bloque legacy).");
        continue;
      }
      void navigate(navigateToolToOptions(args));
      lines.push(`Navegación: ${args.path}.`);
    } else if (t.name === "create_transfer") {
      if (opts?.suppressCreateTransfer) {
        lines.push("Transferencia legacy omitida (sin pedido explícito).");
        continue;
      }
      const args = parseCreateTransferArgs(t.args);
      if (!args) {
        lines.push("Transferencia inválida (bloque legacy).");
        continue;
      }
      const err = validateTransferAgainstBatches(args, batches);
      if (err) {
        lines.push(`Transferencia: ${err}`);
        continue;
      }
      onCreateTransfer(args);
      lines.push("Diálogo de confirmación de transferencia.");
    }
  }
  return lines;
}

export function WorkspaceAssistantChat({
  snapshotInput,
}: {
  snapshotInput: AssistantWorkspaceSnapshotInput;
}) {
  const navigate = useNavigate();
  const createTransfer = useStore((s) => s.createTransfer);
  const batches = useStore((s) => s.batches);

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pendingTransfer, setPendingTransfer] = useState<CreateTransferToolArgs | null>(null);
  const [confirming, setConfirming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const snapshotJson = useMemo(() => buildWorkspaceAssistantContext(snapshotInput), [snapshotInput]);

  const openTransferDialog = useCallback((args: CreateTransferToolArgs) => {
    setPendingTransfer(args);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    const userMsg: UiMessage = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setStreaming(true);
    setStreamingText("");

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const history: ChatMessage[] = [
        { role: "system", content: buildSystemMessage(snapshotJson) },
        ...messages.flatMap((msg): ChatMessage[] =>
          msg.role === "user"
            ? [{ role: "user", content: msg.content }]
            : [{ role: "assistant", content: msg.content }],
        ),
        { role: "user", content: text },
      ];

      let fullContent = "";
      const collectedToolCalls: OllamaToolCall[] = [];

      for await (const event of streamAiChat({
        model: "llama-3.1-8b-instant",
        messages: history,
        tools: assistantTools,
        signal: ac.signal,
      })) {
        if (event.type === "text") {
          fullContent += event.content;
          setStreamingText(fullContent);
        } else if (event.type === "tool_calls") {
          for (const tc of event.tool_calls) {
            const existing = collectedToolCalls.find(
              (e) => (e.function?.name ?? "") === (tc.function?.name ?? ""),
            );
            if (existing) {
              if (typeof tc.function?.arguments === "string") {
                if (typeof existing.function?.arguments === "string") {
                  existing.function.arguments += tc.function.arguments;
                }
              }
            } else {
              collectedToolCalls.push(tc);
            }
          }
        } else if (event.type === "error") {
          toast.error("Error al consultar el asistente", { description: event.message.slice(0, 280) });
          setMessages((m) => [...m, { role: "assistant", content: `No pude obtener respuesta: ${event.message}` }]);
          setStreaming(false);
          setStreamingText("");
          return;
        }
      }

      let content = stripBareToolJsonFromAssistantContent(fullContent.trim() ?? "");
      const toolCalls = collectedToolCalls;

      const transferInfoQ = isTransferPipelineInfoQuestion(text);
      const suppressNavigate =
        isQuantityQuestionWithoutNavIntent(text) || transferInfoQ;
      const suppressCreateTransfer = !isExplicitTransferCreationIntent(text);
      const actionLines = processToolCalls(toolCalls, navigate, batches, openTransferDialog, {
        suppressNavigate,
        suppressCreateTransfer,
      });

      const legacy = extractLegacyToolBlocks(content);
      content = legacy.cleanContent;
      actionLines.push(
        ...processLegacyTools(legacy.tools, navigate, batches, openTransferDialog, {
          suppressNavigate,
          suppressCreateTransfer,
        }),
      );

      const suffix = actionLines.length > 0 ? `\n\n_${actionLines.join(" ")}_` : "";
      let assistantText = sanitizeHallucinatedToolOnlyReply(content || "Listo.") + suffix;

      if (suppressNavigate && isWeakModelStockReply(assistantText)) {
        let fill: string | null = null;
        if (transferInfoQ) {
          fill = answerTransferPipelineFromSnapshot(snapshotInput, text);
        } else {
          fill = answerStockQueryFromSnapshot(snapshotInput, text);
        }
        if (fill) {
          assistantText = `${fill}\n\n_(Cifras y listados calculados en la app a partir de los datos visibles en tu sesión.)_`;
        } else if (isQuantityQuestionWithoutNavIntent(text) && !transferInfoQ) {
          assistantText =
            `No pude emparejar tu consulta con un medicamento en el stock visible (o el modelo no devolvió cifras). ` +
            `Probá con el nombre exacto del catálogo o revisá **Inventario**.`;
        }
      }

      setMessages((m) => [...m, { role: "assistant", content: assistantText }]);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      if (err.includes("abort") || err.includes("Abort")) return;
      toast.error("Error al consultar el asistente", { description: err.slice(0, 280) });
      setMessages((m) => [...m, { role: "assistant", content: `No pude obtener respuesta: ${err}` }]);
    } finally {
      setStreaming(false);
      setStreamingText("");
      abortRef.current = null;
    }
  }, [input, streaming, messages, snapshotJson, snapshotInput, navigate, batches, openTransferDialog]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    if (streamingText) {
      setMessages((m) => [...m, { role: "assistant", content: streamingText + "\n\n_(Generación interrumpida por el usuario.)_" }]);
    }
    setStreaming(false);
    setStreamingText("");
    abortRef.current = null;
  }, [streamingText]);

  const confirmTransfer = useCallback(async () => {
    if (!pendingTransfer) return;
    setConfirming(true);
    try {
      await createTransfer(pendingTransfer);
      toast.success("Transferencia solicitada");
      setPendingTransfer(null);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      toast.error("No se pudo crear la transferencia", { description: err.slice(0, 240) });
    } finally {
      setConfirming(false);
    }
  }, [pendingTransfer, createTransfer]);

  return (
    <div className="flex min-h-[420px] flex-col gap-3">
      <div className="min-h-[280px] max-h-[min(55vh,520px)] flex-1 space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Escribí una pregunta sobre stock, vencimientos, transferencias o pedidos de la Institución actual.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[95%] rounded-lg px-3 py-2 text-sm ${
              msg.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "mr-auto border bg-background"
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          </div>
        ))}
        {streaming && (
          <div className="mr-auto max-w-[95%] rounded-lg border bg-background px-3 py-2 text-sm">
            <p className="whitespace-pre-wrap break-words">{streamingText || ""}</p>
            <span className="inline-block h-4 w-2 animate-pulse bg-primary align-text-bottom" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Textarea
          placeholder="Ej.: ¿Cuántas unidades tenemos de paracetamol? ¿Hay lotes críticos?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          disabled={streaming}
          className="min-h-[80px] flex-1 resize-y"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        {streaming ? (
          <Button type="button" variant="destructive" onClick={handleStop} className="shrink-0">
            <StopCircle className="h-4 w-4" />
            <span className="ml-2">Detener</span>
          </Button>
        ) : (
          <Button type="button" onClick={() => void handleSend()} disabled={!input.trim()} className="shrink-0">
            <Send className="h-4 w-4" />
            <span className="ml-2">Enviar</span>
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Asistente vía <code className="rounded bg-muted px-0.5">Groq</code> (modelo:{" "}
        <span className="font-mono">llama-3.1-8b-instant</span>).
        <span className="ml-2 font-semibold text-red-500">PRODUCTO DE PRUEBA, ESTE CHAT ESTÁ LIMITADO AL MODELO AI GRATUITO USADO QUE PERMITE 30 MENSAJES POR MINUTO</span>
      </p>

      <Dialog open={!!pendingTransfer} onOpenChange={(o) => !o && !confirming && setPendingTransfer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar transferencia</DialogTitle>
            <DialogDescription>
              El asistente solicitó crear una transferencia. Revisá los datos antes de confirmar.
            </DialogDescription>
          </DialogHeader>
          {pendingTransfer && (
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Medicamento: </span>
                {medName(pendingTransfer.medicationId)}
              </li>
              <li>
                <span className="font-medium text-foreground">Origen: </span>
                {warehouseName(pendingTransfer.fromWarehouseId)}
              </li>
              <li>
                <span className="font-medium text-foreground">Destino: </span>
                {warehouseName(pendingTransfer.toWarehouseId)}
              </li>
              <li>
                <span className="font-medium text-foreground">Cantidad: </span>
                {pendingTransfer.quantity} u
              </li>
              <li className="font-mono text-xs">Lote (batch): {pendingTransfer.sourceBatchId}</li>
            </ul>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPendingTransfer(null)} disabled={confirming}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void confirmTransfer()} disabled={confirming}>
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar transferencia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
