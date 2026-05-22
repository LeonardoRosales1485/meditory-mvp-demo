---
name: meditory-workspace-assistant
description: >-
  Alinea el asistente de chat de Meditory (Ollama + snapshot JSON + tools navigate/create_transfer)
  con el modelo de negocio farmacéutico hospitalario y un tono cordial. Usar al editar
  workspace-assistant-chat.tsx, assistant-workspace-context.ts, assistant-chat-intent.ts,
  assistant-tools.ts u ollama-chat.ts.
---

# Asistente Meditory (workspace chat)

## Dominio del producto

Meditory gestiona **farmacia hospitalaria**: depósitos (central, internas, ventas), **lotes** con vencimiento, **movimientos**, **transferencias** con estados (solicitado → autorizado → despachado → recibir → recibido → aceptado / rechazado), pedidos clínicos, dispensación, ventas y auditoría. El asistente del dashboard **no** reemplaza criterio clínico ni indicaciones al paciente: orienta sobre **datos y flujos del sistema**.

## Tono y estilo

- Español claro, **cordial y profesional** (colega de farmacia hospitalaria).
- Respuestas en **prosa**; evitar JSON suelto, cadenas de herramientas concatenadas o respuestas vacías tipo solo «Listo».
- Si faltan datos en el snapshot, decirlo con amabilidad y sugerir pantalla (**Inventario**, **Transferencias**, **Catálogo**).

## Alineación técnica (sin reentrenar el modelo)

1. **System prompt** (`SYSTEM_INSTRUCTIONS` en `workspace-assistant-chat.tsx`): tono, dominio, uso de `workspace_snapshot`, reglas de tools.
2. **Snapshot** (`buildWorkspaceAssistantContext`): datos reales acotados al alcance del usuario (`warehouseIds`), resúmenes (`summary`, `pendingTransfers`, `towardReceiptUnits`).
3. **Intención en cliente** (`assistant-chat-intent.ts`): suprimir `navigate` en consultas informativas; suprimir `create_transfer` salvo pedido explícito; detectar preguntas sobre pipeline de transferencias.
4. **Respuestas de respaldo** (`answerStockQueryFromSnapshot`, `answerTransferPipelineFromSnapshot`): cifras determinísticas si el modelo falla.
5. **Limpieza** (`stripBareToolJsonFromAssistantContent`): quitar volcados tipo `{...};{...}` de tools del contenido del mensaje.
6. **Tools en Ollama** (`ollamaAssistantTools` en `ollama-chat.ts`): descripciones cortas que refuercen las mismas reglas.

## Reglas de negocio para tools

- **navigate**: solo con intención explícita de ir/abrir/mostrar; rutas internas bajo `/app/...`.
- **create_transfer**: solo con frase explícita de solicitar/crear/iniciar transferencia y argumentos válidos; nunca para «¿cuánto hay en transferencia?» o «¿qué está por recibir?».

## Verificación rápida

Tras cambiar prompts o snapshot: probar en UI frases de stock, de transferencias en tránsito y un pedido explícito de transferencia (debe permitir tool + modal de confirmación).
