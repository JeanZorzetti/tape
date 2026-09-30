/**
 * Fonte da visita na mensagem do WhatsApp: de onde a pessoa chegou ao site.
 * Roda no runner nativo (`node --test`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { fonteDaVisita, comFonte, whatsappLink } from "../src/lib/whatsapp.ts";

const HOST = "tapepro.roilabs.com.br";

test("buscadores e redes viram nome amigável", () => {
  assert.equal(fonteDaVisita("https://www.google.com/", "", HOST), "Google");
  assert.equal(fonteDaVisita("https://www.google.com.br/", "", HOST), "Google");
  assert.equal(fonteDaVisita("https://l.instagram.com/", "", HOST), "Instagram");
  assert.equal(fonteDaVisita("https://m.facebook.com/", "", HOST), "Facebook");
  assert.equal(fonteDaVisita("https://chatgpt.com/", "", HOST), "ChatGPT");
});

test("utm_source ganha do referrer", () => {
  assert.equal(fonteDaVisita("https://www.google.com/", "?utm_source=instagram", HOST), "Instagram");
});

test("domínio desconhecido vai como está, sem www", () => {
  assert.equal(fonteDaVisita("https://www.roilabs.com.br/", "", HOST), "roilabs.com.br");
});

test("acesso direto e navegação interna não geram fonte", () => {
  assert.equal(fonteDaVisita("", "", HOST), null);
  assert.equal(fonteDaVisita(`https://${HOST}/produtos/`, "", HOST), null);
  assert.equal(fonteDaVisita("não é url", "", HOST), null);
});

test("comFonte acrescenta a frase no fim do texto pronto", () => {
  const texto = new URL(comFonte(whatsappLink(undefined, "Home"), "Google")).searchParams.get("text");
  assert.equal(texto, "Olá! Vim pelo site da TapePro (Home) e quero um orçamento de fitas personalizadas. Achei vocês pelo Google.");
});
