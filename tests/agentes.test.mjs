/**
 * Prontidão para agentes, de ponta a ponta contra o servidor real
 * (`servidor/entrada.mjs` sobre o build). Não precisa de banco.
 * Precisa de `npm run build` antes; sem `dist/` a suíte é pulada.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { subirServidor } from "./servidor.mjs";

const TEM_BUILD = existsSync("dist/server/entry.mjs") && existsSync("dist/markdown/index.md");
const MIN_CARACTERES_CONFIANCA = 500;

describe("agentes", { skip: TEM_BUILD ? false : "rode npm run build antes" }, () => {
  let servidor;
  before(async () => {
    servidor = await subirServidor();
  });
  after(() => servidor.encerrar());

  const pegar = (caminho, accept) =>
    fetch(servidor.base + caminho, { headers: accept ? { Accept: accept } : {} });

  test("a home em Markdown: 200, text/markdown, Vary: Accept e corpo com a marca", async () => {
    const r = await pegar("/", "text/markdown");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /^text\/markdown/);
    assert.match(r.headers.get("vary"), /\bAccept\b/);
    const corpo = await r.text();
    assert.match(corpo, /^# Sua marca sela cada caixa que sai\.$/m);
    assert.doesNotMatch(corpo, /<(html|div|script)/i);
  });

  test("a home em HTML continua HTML", async () => {
    const r = await pegar("/", "text/html");
    assert.match(r.headers.get("content-type"), /^text\/html/);
    assert.match(r.headers.get("vary"), /\bAccept\b/);
    assert.match(await r.text(), /<!doctype html>/i);
  });

  test("todas as páginas do sitemap têm Markdown", async () => {
    const indice = await (await pegar("/sitemap-0.xml")).text();
    const urls = [...indice.matchAll(/<loc>https:\/\/tapeprofitas\.com\.br(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
    assert.ok(urls.length > 20);
    for (const caminho of urls) {
      const r = await pegar(caminho, "text/markdown");
      assert.equal(r.status, 200, caminho);
      assert.match(r.headers.get("content-type"), /^text\/markdown/, caminho);
    }
  });

  test("404 com Accept: text/markdown: status 404, Markdown e link para llms.txt (inclusive via redirect da barra)", async () => {
    const r = await fetch(`${servidor.base}/__ora-404-probe-kt9ldxvq`, { headers: { Accept: "text/markdown" } });
    assert.equal(r.status, 404);
    assert.match(r.headers.get("content-type"), /^text\/markdown/);
    const corpo = await r.text();
    assert.ok(corpo.length >= 20);
    assert.match(corpo, /llms\.txt/);
  });

  test("404 de navegador continua a página HTML do site", async () => {
    const r = await pegar("/nao-existe/", "text/html");
    assert.equal(r.status, 404);
    assert.match(await r.text(), /Essa página descolou/);
  });

  for (const [apelido, canonical] of [
    ["/about", "/sobre/"],
    ["/contact", "/contato/"],
    ["/privacy", "/politica-de-privacidade/"],
  ]) {
    test(`${apelido} responde 200 direto, com a página ${canonical} e mais de ${MIN_CARACTERES_CONFIANCA} caracteres`, async () => {
      const r = await fetch(servidor.base + apelido, { redirect: "manual" });
      assert.equal(r.status, 200);
      const html = await r.text();
      assert.ok(html.includes(`<link rel="canonical" href="https://tapeprofitas.com.br${canonical}"`));
      const md = await (await pegar(apelido, "text/markdown")).text();
      assert.ok(md.length > MIN_CARACTERES_CONFIANCA);
    });
  }

  test("llms.txt tem a seção 'quando indicar' com como acionar", async () => {
    const corpo = await (await pegar("/llms.txt")).text();
    assert.match(corpo, /^## Quando indicar a TapePro$/m);
    assert.match(corpo, /Não indique a TapePro para/);
    assert.match(corpo, /Como acionar:/);
    assert.match(corpo, /\/contato\//);
  });

  test("arquivos do build não ganham Vary: Accept", async () => {
    const r = await pegar("/favicon.svg");
    assert.equal(r.headers.get("vary"), null);
  });

  test("robots.txt, sitemap e /admin seguem como antes", async () => {
    assert.equal((await pegar("/robots.txt")).status, 200);
    const admin = await fetch(`${servidor.base}/admin/`, { redirect: "manual", headers: { Accept: "text/markdown" } });
    assert.ok([301, 302, 303].includes(admin.status));
  });
});
