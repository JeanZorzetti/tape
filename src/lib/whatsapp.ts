// Extensão explícita: deixa `node --test` importar este módulo direto, sem
// bundler. O resolvedor ESM do Node não completa extensões (ver tests/).
import { WHATSAPP_NUMERO } from "./constants.ts";

/**
 * Monta o link do WhatsApp com mensagem pré-preenchida.
 * `contexto` = produto/assunto da página (ex.: "fita gomada personalizada").
 * `paginaOrigem` = rótulo da página de origem (rastreio de qual página converteu).
 */
/** Link para falar com um lead do CRM (assume DDI 55 quando o número vem só com DDD). */
export function whatsappParaNumero(telefone: string, texto?: string): string {
  const digitos = telefone.replace(/\D/g, "");
  const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

export function whatsappLink(contexto?: string, paginaOrigem?: string): string {
  let abertura = "Olá! Vim pelo site da TapePro";
  if (paginaOrigem) abertura += ` (${paginaOrigem})`;
  const assunto = contexto
    ? `e quero um orçamento de ${contexto}.`
    : "e quero um orçamento de fitas personalizadas.";
  const texto = encodeURIComponent(`${abertura} ${assunto}`);
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${texto}`;
}
