/**
 * Negociação de Markdown para agentes (acceptmarkdown.com): as regras puras e o
 * ouvinte HTTP, com um handler falso no lugar do Astro. Não precisa de build.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { APELIDOS, caminhoDePagina, prefereMarkdown, resolverApelido } from "../servidor/negociacao.mjs";
import { criarOuvinte } from "../servidor/ouvinte.mjs";

describe("prefereMarkdown", () => {
  const casos = [
    ["text/markdown", true],
    ["text/markdown, text/html;q=0.5", true],
    ["text/markdown;q=0.9, text/html", false],
    ["text/html, text/markdown", false],
    ["text/markdown, text/html", true],
    ["text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", false],
    ["*/*", false],
    ["text/*", false],
    ["text/markdown;q=0", false],
    ["TEXT/Markdown", true],
    ["text/markdown;q=abc", false],
    ["", false],
    [undefined, false],
  ];
  for (const [accept, esperado] of casos) {
    test(`${JSON.stringify(accept)} → ${esperado}`, () => assert.equal(prefereMarkdown(accept), esperado));
  }
});

describe("caminhoDePagina", () => {
  for (const caminho of ["/", "/sobre/", "/produtos/fita-gomada/", "/nao-existe", "/about"]) {
    test(`${caminho} é página`, () => assert.equal(caminhoDePagina(caminho), true));
  }
  for (const caminho of ["/admin", "/admin/login/", "/api/lead", "/_astro/x.js", "/_image", "/llms.txt", "/rss.xml", "/favicon.svg"]) {
    test(`${caminho} não é página`, () => assert.equal(caminhoDePagina(caminho), false));
  }
});

describe("resolverApelido", () => {
  test("com e sem barra", () => {
    assert.equal(resolverApelido("/about"), "/sobre/");
    assert.equal(resolverApelido("/about/"), "/sobre/");
    assert.equal(resolverApelido("/contact/"), "/contato/");
    assert.equal(resolverApelido("/privacy"), "/politica-de-privacidade/");
  });
  test("o que não é apelido segue", () => {
    assert.equal(resolverApelido("/sobre/"), null);
    assert.equal(resolverApelido("/about/team/"), null);
    assert.equal(Object.keys(APELIDOS).length, 3);
  });
});

describe("ouvinte", () => {
  let servidor;
  let base;
  const pedidosAoHandler = [];

  // Handler falso: / e /sobre/ são HTML, o resto dá 404 em HTML pelo writeHead, como o Astro.
  const handler = (req, res) => {
    pedidosAoHandler.push(req.url);
    const [caminho] = req.url.split("?");
    const existe = ["/", "/sobre/", "/admin/login/", "/llms.txt"].includes(caminho);
    const corpo = existe ? "<html>pagina</html>" : "<html>404</html>";
    res.setHeader("Cache-Control", "public, max-age=0");
    res.writeHead(existe ? 200 : 404, { "content-type": existe && caminho === "/llms.txt" ? "text/plain" : "text/html; charset=utf-8" });
    res.end(corpo);
  };
  const paginasMarkdown = new Map([
    ["/", "# Início\n"],
    ["/sobre/", "# Sobre\n"],
  ]);

  const pedir = (caminho, accept, init = {}) =>
    fetch(base + caminho, { redirect: "manual", ...init, headers: { ...(accept ? { Accept: accept } : {}), ...init.headers } });

  before(async () => {
    servidor = http.createServer(criarOuvinte({ handler, paginasMarkdown }));
    await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
    base = `http://127.0.0.1:${servidor.address().port}`;
  });
  after(() => new Promise((ok) => servidor.close(ok)));

  test("Accept: text/markdown numa página devolve o Markdown, com Vary: Accept", async () => {
    const r = await pedir("/", "text/markdown");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /^text\/markdown/);
    assert.match(r.headers.get("vary"), /\bAccept\b/);
    assert.equal(await r.text(), "# Início\n");
    assert.ok(Number(r.headers.get("x-markdown-tokens")) > 0);
  });

  test("Accept: text/html e sem Accept seguem no HTML, também com Vary: Accept", async () => {
    for (const accept of ["text/html", undefined, "*/*"]) {
      const r = await pedir("/", accept);
      assert.match(r.headers.get("content-type"), /^text\/html/);
      assert.match(r.headers.get("vary"), /\bAccept\b/);
      assert.equal(await r.text(), "<html>pagina</html>");
    }
  });

  test("HEAD em Markdown manda os cabeçalhos e nenhum corpo", async () => {
    const r = await pedir("/sobre/", "text/markdown", { method: "HEAD" });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /^text\/markdown/);
    assert.equal(await r.text(), "");
  });

  test("404 mantém o status e vira Markdown com link para llms.txt e sitemap", async () => {
    const r = await pedir("/nao-existe/", "text/markdown");
    assert.equal(r.status, 404);
    assert.match(r.headers.get("content-type"), /^text\/markdown/);
    assert.match(r.headers.get("vary"), /\bAccept\b/);
    assert.equal(r.headers.get("cache-control"), "private, max-age=0, must-revalidate");
    const corpo = await r.text();
    assert.ok(corpo.length > 20);
    assert.match(corpo, /^# Erro 404/m);
    assert.match(corpo, /\(https:\/\/tapeprofitas\.com\.br\/llms\.txt\)/);
    assert.match(corpo, /sitemap-index\.xml/);
  });

  test("404 sem pedir Markdown continua HTML", async () => {
    const r = await pedir("/nao-existe/", "text/html");
    assert.equal(r.status, 404);
    assert.match(r.headers.get("content-type"), /^text\/html/);
    assert.equal(await r.text(), "<html>404</html>");
  });

  test("área interna e arquivos não são negociados nem ganham Vary", async () => {
    const admin = await pedir("/admin/login/", "text/markdown");
    assert.match(admin.headers.get("content-type"), /^text\/html/);
    assert.equal(admin.headers.get("vary"), null);
    const txt = await pedir("/llms.txt", "text/markdown");
    assert.match(txt.headers.get("content-type"), /^text\/plain/);
    assert.equal(txt.headers.get("vary"), null);
  });

  test("POST passa direto ao handler", async () => {
    const r = await pedir("/", "text/markdown", { method: "POST", body: "a=1" });
    assert.match(r.headers.get("content-type"), /^text\/html/);
  });

  test("/about, /contact e /privacy chegam ao handler como a página em português, sem redirecionar", async () => {
    pedidosAoHandler.length = 0;
    const r = await pedir("/about?x=1", "text/html");
    assert.equal(r.status, 200);
    assert.deepEqual(pedidosAoHandler, ["/sobre/?x=1"]);
    await pedir("/privacy/", undefined);
    assert.equal(pedidosAoHandler.at(-1), "/politica-de-privacidade/");
  });

  test("o apelido também negocia Markdown", async () => {
    const r = await pedir("/about", "text/markdown");
    assert.equal(r.status, 200);
    assert.equal(await r.text(), "# Sobre\n");
  });
});
