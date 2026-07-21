/**
 * Seleção de URLs e guardas da submissão IndexNow.
 *
 * É a lógica que quebra em silêncio: uma URL de /admin ou de outro host passa
 * despercebida no log e o buscador recusa o lote inteiro. Ver
 * specs/002-indexacao-descoberta/contracts/artefatos-descoberta.md §5.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { urlsDoSitemap, filtrarPublicas, deveSubmeter, lerChave, submeter } from "../scripts/indexnow.mjs";

const HOST = "tapepro.roilabs.com.br";
const sitemap = (...locs) =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
  locs.map((l) => `<url><loc>${l}</loc></url>`).join("") +
  `</urlset>`;

test("urlsDoSitemap extrai todas as <loc>", () => {
  const xml = sitemap(`https://${HOST}/`, `https://${HOST}/sobre/`, `https://${HOST}/blog/`);
  assert.deepEqual(urlsDoSitemap(xml), [`https://${HOST}/`, `https://${HOST}/sobre/`, `https://${HOST}/blog/`]);
});

test("urlsDoSitemap devolve lista vazia num sitemap sem <loc> — não é erro", () => {
  assert.deepEqual(urlsDoSitemap(sitemap()), []);
});

test("filtrarPublicas descarta /admin e /api", () => {
  const urls = [`https://${HOST}/`, `https://${HOST}/admin/`, `https://${HOST}/admin/42/`, `https://${HOST}/api/lead`];
  assert.deepEqual(filtrarPublicas(urls, HOST), [`https://${HOST}/`]);
});

test("filtrarPublicas descarta <loc> terminada em .xml", () => {
  // O sitemap-index.xml é lido junto com o sitemap-0.xml e aponta para ele:
  // sem este filtro, a URL de um sitemap entraria na lista como se fosse página.
  const urls = [`https://${HOST}/`, `https://${HOST}/sitemap-0.xml`, `https://${HOST}/rss.xml`];
  assert.deepEqual(filtrarPublicas(urls, HOST), [`https://${HOST}/`]);
});

test("filtrarPublicas descarta URL de outro host", () => {
  const urls = [`https://${HOST}/`, "https://exemplo.com/", `https://outro.${HOST}/`];
  assert.deepEqual(filtrarPublicas(urls, HOST), [`https://${HOST}/`]);
});

test("filtrarPublicas remove duplicatas", () => {
  const urls = [`https://${HOST}/`, `https://${HOST}/sobre/`, `https://${HOST}/`];
  assert.deepEqual(filtrarPublicas(urls, HOST), [`https://${HOST}/`, `https://${HOST}/sobre/`]);
});

test("filtrarPublicas com lista vazia devolve lista vazia", () => {
  assert.deepEqual(filtrarPublicas([], HOST), []);
});

/** Caso feliz; cada teste abaixo estraga exatamente um campo. */
const permissaoValida = { host: HOST, ambiente: "production", marcadorExiste: false, urls: [`https://${HOST}/`] };

test("deveSubmeter aceita o caso normal", () => {
  assert.deepEqual(deveSubmeter(permissaoValida), { ok: true });
});

test("deveSubmeter pula fora do ambiente de produção", () => {
  // O host vem do sitemap e diz "produção" mesmo num build local: sem esta
  // guarda, `npm run build` na máquina de alguém submeteria de verdade.
  for (const ambiente of [undefined, "", "development"]) {
    const r = deveSubmeter({ ...permissaoValida, ambiente });
    assert.equal(r.ok, false, `ambiente ${ambiente} deveria pular`);
    assert.match(r.motivo, /não é produção/);
  }
});

test("deveSubmeter pula quando o host não é o de produção", () => {
  const r = deveSubmeter({ ...permissaoValida, host: "localhost", urls: ["http://localhost/"] });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /localhost/);
});

test("deveSubmeter pula quando o marcador já existe", () => {
  const r = deveSubmeter({ ...permissaoValida, marcadorExiste: true });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /já submetido/);
});

test("deveSubmeter pula com a lista vazia — nada a submeter não é erro", () => {
  const r = deveSubmeter({ ...permissaoValida, urls: [] });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /nada a submeter/);
});

test("lerChave encontra o .txt cujo conteúdo é igual ao nome", () => {
  const dir = mkdtempSync(join(tmpdir(), "indexnow-"));
  const chave = "a".repeat(32);
  writeFileSync(join(dir, `${chave}.txt`), chave);
  writeFileSync(join(dir, "robots.txt"), "User-agent: *\nAllow: /\n");
  writeFileSync(join(dir, "llms.txt"), "# TapePro\n");
  assert.deepEqual(lerChave(dir, HOST), { chave, keyLocation: `https://${HOST}/${chave}.txt` });
});

test("lerChave devolve null quando conteúdo e nome divergem — é o que causaria 403", () => {
  const dir = mkdtempSync(join(tmpdir(), "indexnow-"));
  writeFileSync(join(dir, `${"b".repeat(32)}.txt`), "chave-errada");
  assert.equal(lerChave(dir, HOST), null);
});

test("submeter engole falha de rede e devolve aviso — nunca lança (FR-004)", async () => {
  const r = await submeter({ host: HOST, key: "x", keyLocation: "y", urlList: [] }, () =>
    Promise.reject(new Error("ECONNREFUSED")),
  );
  assert.equal(r.aceito, false);
  assert.match(r.linha, /aviso/);
  assert.match(r.linha, /ECONNREFUSED/);
});

test("submeter registra a falha sem lançar quando a resposta não é 2xx", async () => {
  const r = await submeter({ host: HOST, key: "x", keyLocation: "y", urlList: [] }, () =>
    Promise.resolve({ ok: false, status: 403 }),
  );
  assert.equal(r.aceito, false);
  assert.match(r.linha, /falha: 403/);
});

test("submeter aceita 200 e 202 — 202 é a chave ainda em validação", async () => {
  for (const status of [200, 202]) {
    const r = await submeter({ host: HOST, key: "x", keyLocation: "y", urlList: [`https://${HOST}/`] }, () =>
      Promise.resolve({ ok: true, status }),
    );
    assert.equal(r.aceito, true);
    assert.match(r.linha, new RegExp(`1 URLs -> ${status} OK`));
  }
});

test("o script encerra com código 0 mesmo sem dist para ler (FR-004)", () => {
  const vazio = mkdtempSync(join(tmpdir(), "indexnow-cwd-"));
  mkdirSync(join(vazio, "node_modules"));
  const script = fileURLToPath(new URL("../scripts/indexnow.mjs", import.meta.url));
  // execFileSync lança se o código de saída não for 0 — é essa a asserção.
  const saida = execFileSync(process.execPath, [script], { cwd: vazio, encoding: "utf8" });
  assert.match(saida, /\[indexnow\] pulado/);
});
