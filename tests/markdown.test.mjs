/** Conversão HTML → Markdown das páginas (scripts/markdown.mjs). */
import { test } from "node:test";
import assert from "node:assert/strict";

import { paginaParaMarkdown } from "../scripts/markdown.mjs";

const pagina = `<!doctype html><html lang="pt-BR"><head>
<title>Contato | TapePro</title>
<meta name="description" content="Fale com a &quot;TapePro&quot; &amp; peça orçamento">
<link rel="canonical" href="https://tapeprofitas.com.br/contato/">
<script>var x = 1;</script></head>
<body><header><a href="/">Menu fora</a></header>
<main><h1>Fale com a fábrica</h1><p>Texto com <a href="/produtos/">link relativo</a>.</p>
<svg><title>ícone</title></svg><canvas></canvas><span aria-hidden="true">decoração</span>
<form><input name="nome"><button>Enviar</button></form>
<img src="/_astro/foto.webp" alt="Rolo de fita"><img src="/x.png" alt=""></main>
<footer><h2>Contato</h2><a href="mailto:a@b.com">a@b.com</a></footer></body></html>`;

test("front matter com título, descrição e URL canônica", () => {
  const md = paginaParaMarkdown(pagina);
  assert.match(md, /^---\ntitle: "Contato \| TapePro"\ndescription: "Fale com a \\"TapePro\\" & peça orçamento"\nurl: https:\/\/tapeprofitas\.com\.br\/contato\/\n---/);
});

test("leva o <main> e o rodapé, e deixa o cabeçalho de navegação de fora", () => {
  const md = paginaParaMarkdown(pagina);
  assert.match(md, /^# Fale com a fábrica$/m);
  assert.match(md, /^## Contato$/m);
  assert.match(md, /\[a@b\.com\]\(mailto:a@b\.com\)/);
  assert.doesNotMatch(md, /Menu fora/);
});

test("links e imagens relativos viram absolutos", () => {
  const md = paginaParaMarkdown(pagina);
  assert.match(md, /\[link relativo\]\(https:\/\/tapeprofitas\.com\.br\/produtos\/\)/);
  assert.match(md, /!\[Rolo de fita\]\(https:\/\/tapeprofitas\.com\.br\/_astro\/foto\.webp\)/);
});

test("tira script, svg, canvas, formulário, ícones escondidos e imagem sem alt", () => {
  const md = paginaParaMarkdown(pagina);
  for (const fora of ["var x", "ícone", "decoração", "Enviar", "x.png"]) assert.doesNotMatch(md, new RegExp(fora));
});
