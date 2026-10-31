/**
 * Postbuild: a versão em Markdown de cada página, para agentes de IA
 * (negociação por `Accept: text/markdown`, acceptmarkdown.com).
 *
 * Para cada `dist/client/**\/index.html` grava `dist/markdown/<mesmo caminho>/index.md`
 * com o `<main>` da página e o rodapé (é lá que estão WhatsApp, e-mail e CNPJ).
 * Fica fora de `dist/client` de propósito: o servidor de arquivos estáticos não
 * publica o .md numa URL própria, só `servidor/ouvinte.mjs` o entrega, na mesma
 * URL do HTML. Gerar no build e não a cada pedido: as páginas são estáticas e
 * só mudam no deploy.
 *
 * Mesmo desenho do site da ROI Labs (roilabs/site/src/scripts/markdown.mjs).
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import TurndownService from "turndown";

export const DIR_HTML = "dist/client";
export const DIR_MARKDOWN = "dist/markdown";
const SITE_URL = "https://tapeprofitas.com.br";

const pegar = (html, re) => html.match(re)?.[1]?.trim() ?? "";
const desescapar = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

function conversor(base) {
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
  // Fora do texto: código, o formulário (o orçamento é pelo navegador ou pelo WhatsApp),
  // o rolo 3D e o que é só visual.
  td.remove(["script", "style", "noscript", "svg", "canvas", "form", "button", "iframe", "template"]);
  td.addRule("escondido", {
    filter: (n) => n.getAttribute?.("aria-hidden") === "true" || n.hasAttribute?.("hidden"),
    replacement: () => "",
  });
  // Link e imagem relativos viram absolutos: o agente lê o Markdown fora do site.
  td.addRule("linkAbsoluto", {
    filter: (n) => n.nodeName === "A" && n.getAttribute("href"),
    replacement: (conteudo, n) => {
      const texto = conteudo.replace(/\s+/g, " ").trim();
      return texto ? `[${texto}](${new URL(n.getAttribute("href"), base).href})` : "";
    },
  });
  td.addRule("imagemAbsoluta", {
    filter: "img",
    replacement: (_, n) => {
      const alt = (n.getAttribute("alt") || "").trim();
      return alt ? `![${alt}](${new URL(n.getAttribute("src") || "", base).href})` : "";
    },
  });
  return td;
}

/** HTML de uma página do site → Markdown com front matter (title, description, url). */
export function paginaParaMarkdown(html) {
  const url = pegar(html, /<link rel="canonical" href="([^"]+)"/) || `${SITE_URL}/`;
  const titulo = desescapar(pegar(html, /<title>([^<]*)<\/title>/));
  const descricao = desescapar(pegar(html, /<meta name="description" content="([^"]*)"/));
  const td = conversor(url);
  const limpar = (trecho) => td.turndown(trecho).replace(/\n{3,}/g, "\n\n").trim();

  const principal = limpar(pegar(html, /<main[^>]*>([\s\S]*)<\/main>/) || pegar(html, /<body[^>]*>([\s\S]*)<\/body>/));
  const rodape = pegar(html, /<footer[^>]*>([\s\S]*)<\/footer>/);
  const cabecalho = ["---", `title: ${JSON.stringify(titulo)}`, `description: ${JSON.stringify(descricao)}`, `url: ${url}`, "---"];

  return [cabecalho.join("\n"), principal, rodape && `---\n\n${limpar(rodape)}`].filter(Boolean).join("\n\n") + "\n";
}

const paginasHtml = (dir) =>
  readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? paginasHtml(caminho) : nome === "index.html" ? [caminho] : [];
  });

export function gerarMarkdown(dirHtml = DIR_HTML, dirMarkdown = DIR_MARKDOWN) {
  rmSync(dirMarkdown, { recursive: true, force: true });
  const arquivos = paginasHtml(dirHtml);
  for (const arquivo of arquivos) {
    const destino = join(dirMarkdown, relative(dirHtml, arquivo).replace(/index\.html$/, "index.md"));
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, paginaParaMarkdown(readFileSync(arquivo, "utf8")));
  }
  return arquivos.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`markdown: ${gerarMarkdown()} páginas com versão em Markdown para agentes`);
}
