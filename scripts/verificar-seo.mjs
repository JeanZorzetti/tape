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
const BLOG = "src/content/blog";
const MAX_DESCRIPTION = 160;
const MAX_IMAGEM_KB = 200;

/** Acima disto, duas long-tails disputam a mesma busca (canibalização). */
const SOBREPOSICAO_MAX = 0.75;

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

  // 3. canonical + description + feed
  if (!src.includes('rel="canonical"')) erro(rota, "sem canonical");
  if (!src.includes('rel="alternate"')) erro(rota, "sem <link rel=alternate> apontando o feed");
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

// 9. duas long-tails de blog não podem mirar a mesma busca — com um post por dia,
// dois artigos disputando a mesma intenção dividem o próprio ranking.
// Compara conjuntos de palavras, não strings: "fita bopp ou gomada" e
// "gomada ou bopp fita" são a mesma busca para o Google.
const VAZIAS = new Set("a o e de da do em para por com que qual quais como e ou um uma no na os as".split(" "));

const termos = (frase) =>
  new Set(
    frase
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .split(/[^a-z0-9]+/)
      .filter((p) => p && !VAZIAS.has(p)),
  );

const sobreposicao = (a, b) => {
  const comuns = [...a].filter((p) => b.has(p)).length;
  return comuns / (a.size + b.size - comuns);
};

const intencoes = existsSync(BLOG)
  ? readdirSync(BLOG)
      .filter((n) => n.endsWith(".mdx"))
      .map((nome) => {
        const frontmatter = readFileSync(join(BLOG, nome), "utf8").split(/^---$/m)[1] ?? "";
        const intencao = frontmatter.match(/^intencao:\s*["']?(.+?)["']?\s*$/m)?.[1];
        return { nome, intencao };
      })
  : [];

for (const { nome, intencao } of intencoes) {
  if (!intencao) erro(`blog/${nome}`, "sem `intencao` no frontmatter");
}

const comIntencao = intencoes.filter((p) => p.intencao).map((p) => ({ ...p, termos: termos(p.intencao) }));
const colisoes = [];
for (let i = 0; i < comIntencao.length; i++) {
  for (let j = i + 1; j < comIntencao.length; j++) {
    const grau = sobreposicao(comIntencao[i].termos, comIntencao[j].termos);
    if (grau >= SOBREPOSICAO_MAX) colisoes.push({ a: comIntencao[i], b: comIntencao[j], grau });
  }
}

console.log(
  `\nIntenções de blog: ${comIntencao.length} posts, ${colisoes.length ? `${colisoes.length} colisão(ões)` : "sem colisão"}`,
);
for (const { a, b, grau } of colisoes) {
  erro(
    "blog",
    `intenção repetida (${(grau * 100).toFixed(0)}% igual) — reescreva uma delas:\n` +
      `          ${a.nome}: "${a.intencao}"\n` +
      `          ${b.nome}: "${b.intencao}"`,
  );
}

// 10. llms.txt — índice do site para motores de busca generativa. Confere as
// duas direções contra as rotas realmente construídas: link que não resolve
// (sobrar) e página de conteúdo que ficou de fora do índice (faltar). Só as
// duas juntas provam que o índice se mantém sozinho (FR-010).
const llms = join(RAIZ, "llms.txt");
if (!existsSync(llms)) erro("/llms.txt", "não existe no build");
else {
  const indexadas = new Set(
    [...readFileSync(llms, "utf8").matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => new URL(m[1]).pathname),
  );
  for (const destino of indexadas) {
    if (!rotas.has(destino)) erro("/llms.txt", `link para rota inexistente: ${destino}`);
  }

  const deConteudo = [...rotas].filter((r) => /^\/(produtos|segmentos|blog)\/[^/]+\/$/.test(r));
  for (const destino of deConteudo) {
    if (!indexadas.has(destino)) erro("/llms.txt", `rota de conteúdo fora do índice: ${destino}`);
  }
  console.log(`\nllms.txt: ${indexadas.size} links, ${deConteudo.length} páginas de conteúdo cobertas`);
}

// 11. robots.txt — o CRM de leads e o endpoint de formulário não são conteúdo
// público, e nenhum bloco pode reabri-los por engano de ordenação (FR-012).
const robots = readFileSync(join(RAIZ, "robots.txt"), "utf8");
for (const privada of ["/admin/", "/api/"]) {
  if (!robots.includes(`Disallow: ${privada}`)) erro("/robots.txt", `não bloqueia ${privada}`);
  if (new RegExp(`^Allow:\\s*${privada}`, "m").test(robots)) erro("/robots.txt", `libera ${privada}`);
}
if (!/^Sitemap:/m.test(robots)) erro("/robots.txt", "sem linha Sitemap:");

// 12. rss.xml — um <item> por post publicado. Divergência aqui significa que o
// feed e a listagem do blog saíram de fontes diferentes.
const feed = join(RAIZ, "rss.xml");
if (!existsSync(feed)) erro("/rss.xml", "não existe no build");
else {
  const itens = (readFileSync(feed, "utf8").match(/<item>/g) ?? []).length;
  const posts = [...rotas].filter((r) => /^\/blog\/[^/]+\/$/.test(r)).length;
  console.log(`rss.xml: ${itens} <item> para ${posts} posts publicados`);
  if (itens !== posts) erro("/rss.xml", `${itens} <item> para ${posts} posts publicados`);
}

// 13. chave IndexNow: o arquivo publicado precisa conter exatamente o próprio
// nome. Se divergirem, a submissão volta 403 e ninguém percebe — o site segue
// no ar, só deixa de ser indexado rápido. Mesma regra que scripts/indexnow.mjs
// usa para descobrir a chave, então `robots.txt` e `llms.txt` não confundem.
const chaves = readdirSync(RAIZ)
  .filter((nome) => nome.endsWith(".txt"))
  .filter((nome) => readFileSync(join(RAIZ, nome), "utf8").trim() === nome.slice(0, -".txt".length));

console.log(`\nChave IndexNow: ${chaves.length === 1 ? chaves[0] : `${chaves.length} arquivos (esperado 1)`}`);
if (chaves.length !== 1) {
  erro("global", "esperado exatamente 1 arquivo de chave IndexNow em dist/client (nome sem extensão == conteúdo)");
}

console.log(`\n${falhas === 0 ? "TUDO OK" : `${falhas} FALHA(S)`} — ${html.length} páginas`);
process.exit(falhas === 0 ? 0 : 1);
