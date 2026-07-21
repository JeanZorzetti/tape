/**
 * Helpers puros do funil de orçamento — sem browser, sem banco.
 *
 * Roda no runner nativo (`node --test`). Os módulos são `.ts` e o Node 22.18+
 * remove os tipos sozinho; por isso os imports internos de `src/lib` precisam
 * da extensão explícita (o resolvedor ESM do Node não completa extensão).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { whatsappLink, whatsappParaNumero } from "../src/lib/whatsapp.ts";
import { tipoFitaLabel, whatsappFromLead, TIPOS_FITA } from "../src/lib/quoteForm.ts";
import { WHATSAPP_NUMERO } from "../src/lib/constants.ts";

const numeroDe = (url) => new URL(url).pathname.slice(1);
const textoDe = (url) => new URL(url).searchParams.get("text");

test("whatsappParaNumero prefixa o DDI 55 quando falta", () => {
  assert.equal(numeroDe(whatsappParaNumero("62983443919")), "5562983443919");
});

test("whatsappParaNumero não duplica um DDI já presente", () => {
  assert.equal(numeroDe(whatsappParaNumero("5562983443919")), "5562983443919");
});

test("whatsappParaNumero descarta a máscara do telefone", () => {
  assert.equal(numeroDe(whatsappParaNumero("(62) 98344-3919")), "5562983443919");
});

test("whatsappParaNumero só inclui ?text= quando há texto", () => {
  assert.equal(whatsappParaNumero("62983443919"), "https://wa.me/5562983443919");
  assert.equal(textoDe(whatsappParaNumero("62983443919", "olá & cia")), "olá & cia");
});

test("whatsappLink registra a página de origem entre parênteses", () => {
  const texto = textoDe(whatsappLink("fita gomada personalizada", "Página de produto"));
  assert.match(texto, /\(Página de produto\)/);
  assert.match(texto, /orçamento de fita gomada personalizada\.$/);
});

test("whatsappLink cai no assunto genérico sem contexto", () => {
  const texto = textoDe(whatsappLink());
  assert.equal(texto, "Olá! Vim pelo site da TapePro e quero um orçamento de fitas personalizadas.");
});

test("whatsappLink aponta para o número da marca", () => {
  assert.equal(numeroDe(whatsappLink()), WHATSAPP_NUMERO);
});

test("tipoFitaLabel resolve todo valor do select", () => {
  for (const { value, label } of TIPOS_FITA) assert.equal(tipoFitaLabel(value), label);
});

test("tipoFitaLabel cai no rótulo genérico em valor desconhecido", () => {
  assert.equal(tipoFitaLabel("valor_inexistente"), "fitas personalizadas");
  assert.equal(tipoFitaLabel(""), "fitas personalizadas");
});

test("whatsappFromLead não quebra com o lead vazio", () => {
  const texto = textoDe(whatsappFromLead({}));
  assert.match(texto, /\(sem nome\)/);
  assert.match(texto, /\(sem empresa\)/);
  assert.match(texto, /Quantidade estimada: a definir\./);
  assert.match(texto, /orçamento de fitas personalizadas/);
});

test("whatsappFromLead monta a mensagem completa e só inclui mensagem se houver", () => {
  const base = { nome: "Ana", empresa: "Acme", tipoFita: "gomada", quantidadeEstimada: "100 rolos" };
  assert.equal(
    textoDe(whatsappFromLead(base)),
    "Olá! Sou Ana da Acme. Quero um orçamento de Fita gomada (kraft). Quantidade estimada: 100 rolos.",
  );
  assert.match(textoDe(whatsappFromLead({ ...base, mensagem: "Urgente" })), /100 rolos\. Urgente$/);
});
