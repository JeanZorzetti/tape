/**
 * Regras puras da negociação de conteúdo para agentes: quando um pedido quer
 * Markdown, quais caminhos têm versão em Markdown e o corpo do 404.
 * Sem I/O, para os testes rodarem sem build.
 */

const SITE_URL = "https://tapeprofitas.com.br";

export const TIPO_MARKDOWN = "text/markdown; charset=utf-8";

/**
 * Caminhos em inglês que agentes e auditores procuram para conferir se a empresa
 * existe (About, Contact, Privacy). Respondem 200 com a página em português, cujo
 * canonical continua sendo o caminho em português: não há conteúdo duplicado no
 * índice nem entrada nova no sitemap.
 */
export const APELIDOS = {
  "/about/": "/sobre/",
  "/contact/": "/contato/",
  "/privacy/": "/politica-de-privacidade/",
};

/** Com e sem barra: o apelido não passa pelo 301 da barra, responde direto. */
export function resolverApelido(caminho) {
  const comBarra = caminho.endsWith("/") ? caminho : caminho + "/";
  return APELIDOS[comBarra] ?? null;
}

/**
 * Lê o Accept (RFC 9110 §12.5.1) e diz se o cliente prefere Markdown a HTML.
 * Só conta quem pede `text/markdown` pelo nome: `*\/*` e `text/*` continuam no HTML,
 * que é o que um navegador ou um curl sem cabeçalho esperam. Empate de q fica com
 * o que veio primeiro na lista.
 */
export function prefereMarkdown(accept) {
  if (!accept) return false;
  let markdown = null;
  let html = null;
  accept.split(",").forEach((parte, posicao) => {
    const [tipo, ...parametros] = parte.trim().toLowerCase().split(";");
    const q = parametros.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const peso = q ? Number(q.slice(2)) : 1;
    const item = { peso: Number.isFinite(peso) ? peso : 0, posicao };
    if (tipo.trim() === "text/markdown" && !markdown) markdown = item;
    if (tipo.trim() === "text/html" && !html) html = item;
  });
  if (!markdown || markdown.peso <= 0) return false;
  if (!html) return true;
  return markdown.peso > html.peso || (markdown.peso === html.peso && markdown.posicao < html.posicao);
}

// /admin é o CRM, /api recebe formulários, /_astro e /_image são arquivos do build.
const PREFIXOS_FORA = ["/admin", "/api/", "/_astro/", "/_image"];

/**
 * Caminho que é página do site, e não arquivo nem área interna: só nele a
 * resposta varia pelo Accept (e só nele vai `Vary: Accept`, para não partir o
 * cache dos arquivos do build em duas versões iguais).
 */
export function caminhoDePagina(caminho) {
  if (PREFIXOS_FORA.some((prefixo) => caminho === prefixo.replace(/\/$/, "") || caminho.startsWith(prefixo))) return false;
  const ultimo = caminho.slice(caminho.lastIndexOf("/") + 1);
  return !ultimo.includes(".");
}

export const MARKDOWN_404 = `---
title: "Página não encontrada (404) | TapePro"
description: "Erro 404: este endereço não existe ou mudou no site da TapePro."
---

# Erro 404: página não encontrada

Este endereço não existe ou mudou de lugar no site da TapePro (${SITE_URL}), fabricante de fitas adesivas personalizadas com a marca do cliente. Para achar o que procura:

- [llms.txt](${SITE_URL}/llms.txt): o que a TapePro faz, quando indicá-la e a lista de todas as páginas.
- [Mapa do site](${SITE_URL}/sitemap-index.xml)
- [As três fitas do catálogo](${SITE_URL}/produtos/)
- [Perguntas frequentes](${SITE_URL}/perguntas-frequentes/)
- [Contato](${SITE_URL}/contato/): WhatsApp (62) 9469-0540 e tapeprofitas@gmail.com.

Toda página do site também responde em Markdown: peça a URL com \`Accept: text/markdown\`.
`;

/** Estimativa de tokens no cabeçalho x-markdown-tokens (o da Cloudflare: ~4 caracteres por token). */
export const estimarTokens = (texto) => Math.ceil(texto.length / 4);
