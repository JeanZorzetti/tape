/**
 * Scripts de abordagem — helpers puros (sem banco, sem browser).
 * Cobre o mapa passo→script, a substituição de placeholders (nunca deixa `[...]` cru, SC-004)
 * e a normalização de handle do Instagram. Textos derivam de docs/estrategia-prospeccao.md §4.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { passoDoLead, montarScript, scriptDoLead } from "../src/lib/scripts.ts";
import { instagramUrl, NICHOS } from "../src/lib/adminUi.ts";

// Nenhum [placeholder] cru: `[` + palavra + `]`. Casa a garantia da SC-004.
const TEM_PLACEHOLDER = /\[[^\]]*\]/;

test("passoDoLead mapeia a contagem de toques a 0..5 (satura no último)", () => {
  assert.equal(passoDoLead(0), 0);
  assert.equal(passoDoLead(1), 1);
  assert.equal(passoDoLead(5), 5);
  assert.equal(passoDoLead(6), 5, "6 toques → despedida (passo 5)");
  assert.equal(passoDoLead(99), 5);
  assert.equal(passoDoLead(-3), 0, "contagem negativa nunca vira índice inválido");
});

test("montarScript substitui empresa/nome e nunca deixa placeholder cru", () => {
  const comNome = montarScript("Oi, [nome]! Vi a [empresa] aqui.", { empresa: "Acme", nome: "Ana" });
  assert.match(comNome, /Ana/);
  assert.match(comNome, /Acme/);
  assert.doesNotMatch(comNome, TEM_PLACEHOLDER);
});

test("montarScript degrada sem nome — saudação neutra, sem `[nome]` nem vírgula órfã", () => {
  const semNome = montarScript("Oi, [nome]! Vi a [empresa] aqui.", { empresa: "Acme" });
  assert.match(semNome, /Acme/);
  assert.doesNotMatch(semNome, TEM_PLACEHOLDER);
  assert.doesNotMatch(semNome, /Oi,\s*!/, "não sobra 'Oi, !' com vírgula solta");
});

test("montarScript varre qualquer placeholder desconhecido remanescente", () => {
  const s = montarScript("Puxa [ramo] no volume, [empresa].", { empresa: "Acme" });
  assert.doesNotMatch(s, TEM_PLACEHOLDER);
  assert.match(s, /Acme/);
});

test("scriptDoLead devolve texto não-vazio para todo nicho, null e 'outro', em qualquer passo", () => {
  const nichos = [...NICHOS.map((n) => n.value), null, "outro", "nicho_inexistente"];
  for (const nicho of nichos) {
    for (let n = 0; n <= 6; n++) {
      const t = scriptDoLead(nicho, n);
      assert.equal(typeof t, "string");
      assert.ok(t.trim().length > 0, `script vazio para nicho=${nicho} toque=${n}`);
    }
  }
});

test("instagramUrl normaliza formatos mistos → URL do perfil", () => {
  assert.equal(instagramUrl("@marca"), "https://instagram.com/marca");
  assert.equal(instagramUrl("marca"), "https://instagram.com/marca");
  assert.equal(instagramUrl("instagram.com/marca"), "https://instagram.com/marca");
  assert.equal(instagramUrl("https://www.instagram.com/marca/"), "https://instagram.com/marca");
  assert.equal(instagramUrl("https://instagram.com/@marca?hl=pt"), "https://instagram.com/marca");
  assert.equal(instagramUrl("  @Marca_Oficial.br "), "https://instagram.com/marca_oficial.br");
});

test("instagramUrl devolve null para lixo/ausente", () => {
  assert.equal(instagramUrl(null), null);
  assert.equal(instagramUrl(""), null);
  assert.equal(instagramUrl("não é um perfil"), null);
  assert.equal(instagramUrl("@"), null);
});
