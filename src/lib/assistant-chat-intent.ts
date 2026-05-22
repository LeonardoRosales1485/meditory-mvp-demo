function normalizeIntentText(userText: string): string {
  return userText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * El usuario pidió explícitamente iniciar/solicitar una transferencia (habilita la tool `create_transfer`).
 */
export function isExplicitTransferCreationIntent(userText: string): boolean {
  const t = normalizeIntentText(userText);
  return (
    /\b(solicit[oae]?\s+(una\s+)?transfer|cre(ar|a)\s+(una\s+)?transfer|inici(ar|a)\s+(una\s+)?transfer|ped(i|ir)\s+(una\s+)?transfer)\b/.test(
      t,
    ) ||
    /\b(hac(e|er)\s+(una\s+)?transfer|mand(ar|a|ame)\s+(una\s+)?transfer|envi(ar|a|ame)\s+.*transfer)\b/.test(t) ||
    /\btransfer(ir|i)\s+(\d|de|el|la|las|los)\b/.test(t) ||
    /\b(mover|mueve)\s+(\d|stock|unidades)\b/.test(t)
  );
}

/**
 * Consulta informativa sobre transferencias en curso / por recibir (no crear una nueva).
 */
export function isTransferPipelineInfoQuestion(userText: string): boolean {
  const t = normalizeIntentText(userText);
  if (isExplicitTransferCreationIntent(userText)) return false;
  const transferCtx =
    /\b(transferencia|transferencias|transito)\b/.test(t) || /\b(entre\s+depositos?)\b/.test(t);
  if (!transferCtx) return false;
  const informative =
    /\b(cuanto|cuanta|cuantos|cuantas|hay|cual|cuales|como|cuantas?\s+hay|listado|resumen|estado|pendiente)\b/.test(
      t,
    ) || /\b(proximo|proxima|proximos|proximas|recibir|recibidos|despachad)\b/.test(t);
  return informative;
}

/**
 * Detecta si el usuario solo pide cantidades/stock sin pedir abrir una pantalla.
 * En ese caso no debemos ejecutar `navigate` aunque el modelo lo sugiera.
 */
export function isQuantityQuestionWithoutNavIntent(userText: string): boolean {
  const t = normalizeIntentText(userText);

  const navIntent =
    /\b(ir a|ir al|abrir|abri|abreme|lleva(me)?|llevame|mostra(me)?|muestra(me)?|muestrame|navega|entra a|entrar a|ver la pantalla|pantalla de|abre el|abre la)\b/.test(
      t,
    );
  if (navIntent) return false;

  const asksHowMuch =
    /\b(cuantas?|cuantos?|cuanta|cuanto)\b/.test(t) &&
    (/\b(unidades?|u\.?|medicamento|medicamentos)\b/.test(t) ||
      /\b(stock|existencias?)\b/.test(t) ||
      /\b(cantidad)\b/.test(t));
  const asksHay =
    /\b(cuantas?|cuantos?|cuanta|cuanto)\b/.test(t) && /\b(hay)\b/.test(t);
  const asksDisponible = /\b(hay)\b/.test(t) && /\b(disponible|disponibles)\b/.test(t);

  return asksHowMuch || asksHay || asksDisponible;
}

/** Respuesta del modelo sin cifras útiles (p. ej. solo "Listo" o solo aviso de navegación). */
export function isWeakModelStockReply(visibleText: string): boolean {
  const t = visibleText.replace(/\n\n_[\s\S]*$/s, "").trim();
  if (!t) return true;
  if (/^listo\.?!?$/i.test(t)) return true;
  if (t.length < 28 && !/\d/.test(t)) return true;
  if (/navegaci[oó]n no aplicada/i.test(t) && !/\d/.test(t)) return true;
  if (/navegaci[oó]n no ejecutada/i.test(t) && !/\d/.test(t)) return true;
  if (/navegaci[oó]n legacy omitida/i.test(t) && !/\d/.test(t)) return true;
  if (/transferencia no iniciada/i.test(t) && !/\d/.test(t)) return true;
  if (/"name"\s*:\s*"(navigate|create_transfer)"/i.test(t) && t.length < 4000) return true;
  /** El modelo devolvió JSON de una tool inventada; el cliente lo sustituyó por un aviso sin cifras de stock. */
  if (/no existe la herramienta\s*«/i.test(t) && !/\d/.test(t)) return true;
  return false;
}
