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

// Fonte da visita (30/09/2026): a página de origem já vai no texto; isto diz COMO a pessoa
// chegou ao site, o dado que separa venda do Google de venda de indicação. Nome amigável para
// quem lê a conversa; domínio desconhecido vai como está. Sem fonte (acesso direto, navegador
// que esconde o referrer) = null, e a mensagem fica sem a frase.
const FONTES: [RegExp, string][] = [
  [/(^|\.)google(\.|$)/, "Google"],
  [/(^|\.)bing(\.com)?$/, "Bing"],
  [/(^|\.)instagram(\.com)?$/, "Instagram"],
  [/(^|\.)(facebook|fb)(\.com)?$/, "Facebook"],
  [/(^|\.)linkedin(\.com)?$|^lnkd\.in$/, "LinkedIn"],
  [/(^|\.)(youtube(\.com)?|youtu\.be)$/, "YouTube"],
  [/(^|\.)(chatgpt(\.com)?|openai\.com)$/, "ChatGPT"],
  [/(^|\.)perplexity(\.ai)?$/, "Perplexity"],
  [/(^|\.)duckduckgo(\.com)?$/, "DuckDuckGo"],
];

export function fonteDaVisita(referrer: string, search: string, host: string): string | null {
  const utm = new URLSearchParams(search).get("utm_source")?.trim().toLowerCase();
  let origem = utm || "";
  if (!origem && referrer) {
    try {
      origem = new URL(referrer).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
    if (origem === host.replace(/^www\./, "")) return null; // navegação interna
  }
  if (!origem) return null;
  const conhecida = FONTES.find(([re]) => re.test(origem));
  return conhecida ? conhecida[1] : origem;
}

/** Acrescenta "Achei vocês pelo X." ao texto de um link do WhatsApp. */
export function comFonte(href: string, fonte: string): string {
  const url = new URL(href);
  const texto = url.searchParams.get("text");
  if (!texto) return href;
  url.searchParams.set("text", `${texto} Achei vocês pelo ${fonte}.`);
  return url.toString();
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
