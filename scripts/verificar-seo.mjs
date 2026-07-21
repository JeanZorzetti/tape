/**
 * Confere o HTML gerado contra contracts/routing-seo.md e structured-data.md.
 * Roda depois do build: `npm run verificar` (ou `npm run build && npm run verificar`).
 *
 * ponytail: 90 linhas de regex sobre o dist no lugar de Playwright + parser de
 * DOM. Não há test runner no projeto e estas são as regras que quebram SEO em
 * silêncio. Migrar para os testes de verdade quando T024/T030/T037 entrarem.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = "dist/client";
const MAX_DESCRIPTION = 160;
const MAX_IMAGEM_KB = 200;

const html = [];
(function varrer(dir) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) varrer(p);
    else if (nome.endsWith(".html")) html.push(p);
  }
})(RAIZ);

let falhas = 0;
const erro = (rota, msg) => {
  console.log(`  ERRO  ${rota}: ${msg}`);
  falhas++;
};

const links = new Map(); // rota -> destinos internos
const rotas = new Set();

for (const arquivo of html.sort()) {
  const rota = "/" + relative(RAIZ, arquivo).replace(/\\/g, "/").replace(/index\.html$/, "");
  rotas.add(rota);
  const src = readFileSync(arquivo, "utf8");

  // 1. exatamente um h1
  const h1 = src.match(/<h1[\s>]/g) ?? [];
  if (h1.length !== 1) erro(rota, `${h1.length} <h1> (esperado 1)`);

  // 2. JSON-LD válido
  const blocos = [...src.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const tipos = [];
  for (const [, json] of blocos) {
    try {
      tipos.push(JSON.parse(json)["@type"]);
    } catch (e) {
      erro(rota, `JSON-LD inválido: ${e.message}`);
    }
  }

  // 3. canonical + description
  if (!src.includes('rel="canonical"')) erro(rota, "sem canonical");
  const desc = src.match(/<meta name="description" content="([^"]*)"/);
  if (!desc) erro(rota, "sem meta description");
  else if (desc[1].length > MAX_DESCRIPTION)
    erro(rota, `description com ${desc[1].length} chars (máx. ${MAX_DESCRIPTION})`);

  // 4. toda <img> com alt (alt="" sai como `alt` puro no HTML — decorativa, é válido)
  const semAlt = [...src.matchAll(/<img(?![^>]*\balt[=\s>])[^>]*>/g)];
  if (semAlt.length) erro(rota, `${semAlt.length} <img> sem alt`);

  // 5. nenhum placeholder / hotlink
  if (/placehold\.co|picsum\.photos|via\.placeholder/.test(src)) erro(rota, "usa serviço de placeholder");

  // 5b. imagens: arquivo existe, dimensão setada (CLS) e peso sob controle
  for (const [tag] of src.matchAll(/<img[^>]*>/g)) {
    const arquivos = [
      ...(tag.match(/\ssrc="([^"]+)"/) ?? []).slice(1),
      ...[...(tag.match(/srcset="([^"]+)"/) ?? []).slice(1)].flatMap((s) =>
        s.split(",").map((p) => p.trim().split(/\s+/)[0]),
      ),
    ].filter((u) => u.startsWith("/"));

    for (const url of new Set(arquivos)) {
      const disco = join(RAIZ, url);
      if (!existsSync(disco)) {
        erro(rota, `imagem inexistente no dist: ${url}`);
        continue;
      }
      const kb = statSync(disco).size / 1024;
      if (kb > MAX_IMAGEM_KB) erro(rota, `${url} tem ${kb.toFixed(0)} KB (máx. ${MAX_IMAGEM_KB})`);
    }
    // Sem width+height (ou aspect-ratio no style) o layout pula quando a imagem carrega.
    const temDimensao = /\bwidth="\d+"/.test(tag) && /\bheight="\d+"/.test(tag);
    if (!temDimensao && !/aspect-ratio/.test(tag)) erro(rota, `<img> sem width/height: ${tag.slice(0, 80)}`);
  }

  links.set(
    rota,
    [...src.matchAll(/href="(\/[^"#?]*)"/g)]
      .map((m) => m[1])
      .filter((h) => !/\.\w+$/.test(h)) // arquivo (favicon.svg, og-default.png) não é rota
      .map((h) => (h.endsWith("/") ? h : h + "/")),
  );

  console.log(`  ok    ${rota.padEnd(48)} [${tipos.join(", ")}]`);
}

// 6. FAQPage só em /perguntas-frequentes
const comFaq = html.filter((f) => readFileSync(f, "utf8").includes('"@type":"FAQPage"'));
console.log(`\nFAQPage em: ${comFaq.map((f) => relative(RAIZ, f)).join(", ") || "nenhuma"}`);
if (comFaq.length !== 1 || !comFaq[0].includes("perguntas-frequentes")) {
  erro("global", "FAQPage deve existir em exatamente 1 página (/perguntas-frequentes)");
}

// 7. nenhuma página órfã (alcançável a partir de outra). A /404 não é linkada
// de propósito — o servidor é quem a serve; em troca, ela precisa ser noindex.
const rota404 = "/404.html";
const html404 = html.find((f) => f.endsWith("404.html"));
if (!html404) erro(rota404, "não existe no build");
else if (!/<meta name="robots" content="noindex/.test(readFileSync(html404, "utf8")))
  erro(rota404, "sem <meta name=robots content=noindex>");

const apontadas = new Set([...links.values()].flat());
const orfas = [...rotas].filter((r) => r !== "/" && r !== rota404 && !apontadas.has(r));
console.log(`\nÓrfãs: ${orfas.length ? orfas.join(", ") : "nenhuma"}`);
if (orfas.length) falhas++;

// 8. nenhum link interno quebrado
const quebrados = [...links].flatMap(([de, para]) =>
  para.filter((p) => !rotas.has(p) && !p.startsWith("/_astro") && !p.startsWith("/admin")).map((p) => `${de} -> ${p}`),
);
console.log(`Links internos quebrados: ${quebrados.length ? quebrados.join(", ") : "nenhum"}`);
if (quebrados.length) falhas++;

console.log(`\n${falhas === 0 ? "TUDO OK" : `${falhas} FALHA(S)`} — ${html.length} páginas`);
process.exit(falhas === 0 ? 0 : 1);
