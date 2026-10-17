/**
 * Prévia "sua marca na fita" (página de produto): o nome digitado vai junto na mensagem
 * do WhatsApp, para o atendimento já abrir a conversa com a arte em mente.
 * Roda no runner nativo (`node --test`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { comNomeNaFita, comFonte, whatsappLink, NOME_NA_FITA_MAX } from "../src/lib/whatsapp.ts";

const textoDe = (url) => new URL(url).searchParams.get("text");
const BASE = whatsappLink("fita transparente personalizada (48mm × 100m)", "Prévia · Fita Transparente Personalizada");

test("comNomeNaFita acrescenta o nome entre aspas no fim do texto", () => {
  assert.equal(
    textoDe(comNomeNaFita(BASE, "Lyon Peças")),
    'Olá! Vim pelo site da TapePro (Prévia · Fita Transparente Personalizada) e quero um orçamento de fita transparente personalizada (48mm × 100m). Nome na fita: "Lyon Peças".',
  );
});

test("comNomeNaFita limpa espaços e corta no limite do campo", () => {
  assert.match(textoDe(comNomeNaFita(BASE, "  Lyon    Peças  ")), /Nome na fita: "Lyon Peças"\.$/);
  const longo = "x".repeat(NOME_NA_FITA_MAX + 15);
  assert.match(textoDe(comNomeNaFita(BASE, longo)), new RegExp(`"x{${NOME_NA_FITA_MAX}}"\\.$`));
});

test("comNomeNaFita sem nome devolve o link como estava", () => {
  assert.equal(comNomeNaFita(BASE, "   "), BASE);
});

test("a fonte da visita entra depois do nome", () => {
  assert.match(textoDe(comFonte(comNomeNaFita(BASE, "Lyon"), "Google")), /Nome na fita: "Lyon"\. Achei vocês pelo Google\.$/);
});
