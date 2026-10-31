/**
 * Camada na frente do handler do Astro (adapter node, modo standalone).
 *
 * Existe porque as páginas são estáticas: o adapter as entrega do disco antes de
 * qualquer middleware do Astro rodar, então a negociação por `Accept` não cabe
 * em `src/middleware`. Aqui ela acontece antes, e todo o resto segue para o
 * handler de sempre, sem mudança:
 * - `Accept: text/markdown` numa página → o .md gerado no build (`scripts/markdown.mjs`).
 * - `Accept: text/markdown` num endereço que dá 404 → o mesmo 404, com corpo em Markdown.
 * - Toda resposta de página leva `Vary: Accept`, inclusive o HTML.
 * - /about, /contact e /privacy respondem com a página em português.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import {
  MARKDOWN_404,
  TIPO_MARKDOWN,
  caminhoDePagina,
  estimarTokens,
  prefereMarkdown,
  resolverApelido,
} from "./negociacao.mjs";

/** Mapa caminho da página → Markdown, lido uma vez na subida (o conteúdo só muda no deploy). */
export function carregarMarkdown(dir) {
  const paginas = new Map();
  if (!existsSync(dir)) return paginas;
  const visitar = (atual) => {
    for (const nome of readdirSync(atual)) {
      const caminho = join(atual, nome);
      if (statSync(caminho).isDirectory()) visitar(caminho);
      else if (nome === "index.md") {
        const pasta = relative(dir, atual).split(sep).filter(Boolean).join("/");
        paginas.set(pasta ? `/${pasta}/` : "/", readFileSync(caminho, "utf8"));
      }
    }
  };
  visitar(dir);
  return paginas;
}

function adicionarVaryAccept(res) {
  const atual = res.getHeader("Vary");
  const lista = atual ? String(atual).split(",").map((v) => v.trim()) : [];
  if (!lista.some((v) => v.toLowerCase() === "accept")) res.setHeader("Vary", [...lista, "Accept"].join(", "));
}

function enviarMarkdown(req, res, status, corpo) {
  res.writeHead(status, {
    "Content-Type": TIPO_MARKDOWN,
    "Content-Length": Buffer.byteLength(corpo),
    "X-Markdown-Tokens": String(estimarTokens(corpo)),
    // Sem cache compartilhado: nenhum proxy no caminho tem `Accept` na chave.
    "Cache-Control": "private, max-age=0, must-revalidate",
    Vary: "Accept",
  });
  res.end(req.method === "HEAD" ? undefined : corpo);
}

/**
 * Deixa o handler do Astro responder e, só se ele responder 404, troca o corpo
 * HTML pelo Markdown, mantendo o status. O handler escreve pelo `writeHead`
 * (`NodeApp.writeResponse`), e é nele que a troca acontece.
 */
function trocar404PorMarkdown(req, res) {
  const writeHeadOriginal = res.writeHead.bind(res);
  const writeOriginal = res.write.bind(res);
  const endOriginal = res.end.bind(res);
  let trocou = false;

  res.writeHead = (status, ...resto) => {
    if (status !== 404) return writeHeadOriginal(status, ...resto);
    trocou = true;
    for (const nome of res.getHeaderNames()) res.removeHeader(nome);
    enviarMarkdown(req, { writeHead: writeHeadOriginal, end: endOriginal }, 404, MARKDOWN_404);
    return res;
  };
  res.write = (...args) => (trocou ? true : writeOriginal(...args));
  res.end = (...args) => {
    if (!trocou) return endOriginal(...args);
    const callback = args.find((a) => typeof a === "function");
    if (callback) callback();
    return res;
  };
}

/** `(req, res)` para `http.createServer`. `handler` é o do Astro; `paginasMarkdown`, o de `carregarMarkdown`. */
export function criarOuvinte({ handler, paginasMarkdown }) {
  return (req, res) => {
    const leitura = req.method === "GET" || req.method === "HEAD";
    const [caminhoBruto, consulta] = (req.url ?? "/").split("?");
    const apelido = leitura ? resolverApelido(caminhoBruto) : null;
    const caminho = apelido ?? caminhoBruto;
    if (apelido) req.url = apelido + (consulta !== undefined ? `?${consulta}` : "");

    if (!leitura || !caminhoDePagina(caminho)) return handler(req, res);

    adicionarVaryAccept(res);
    if (!prefereMarkdown(req.headers.accept)) return handler(req, res);

    const markdown = paginasMarkdown.get(caminho);
    if (markdown) return enviarMarkdown(req, res, 200, markdown);
    trocar404PorMarkdown(req, res);
    return handler(req, res);
  };
}
