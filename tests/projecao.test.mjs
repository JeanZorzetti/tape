/**
 * Projeção de vendas — o helper puro que modela funil + receita a partir da base contatável.
 * A regra: respostas → orçamentos → vendas por 3 taxas; enriquecimento soma o uplift; ano 1
 * multiplica pelo nº de compras (1º pedido + recompras).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CENARIOS_PROJECAO,
  RECOMPRAS_ANO1,
  UPLIFT_ENRIQUECIMENTO,
  projetarCenario,
  taxasMetaFunil,
} from "../src/lib/adminUi.ts";

const realista = CENARIOS_PROJECAO.find((c) => c.id === "realista");

test("projetarCenario encadeia as três taxas sobre a base contatável", () => {
  const p = projetarCenario(215, realista);
  assert.equal(p.respostas, 215 * 0.25);
  assert.equal(p.orcamentos, 215 * 0.25 * 0.4);
  assert.equal(p.vendasBase, 215 * 0.25 * 0.4 * 0.3);
});

test("vendas somam o uplift de enriquecimento sobre a base", () => {
  const p = projetarCenario(215, realista);
  assert.equal(p.vendas, p.vendasBase * (1 + UPLIFT_ENRIQUECIMENTO));
});

test("receita do 1º pedido = vendas × ticket (centavos, arredondado)", () => {
  const p = projetarCenario(215, realista);
  assert.equal(p.receitaPrimeiroPedido, Math.round(p.vendas * realista.ticketCentavos));
});

test("receita do ano 1 = 1º pedido × (1 + recompras)", () => {
  const p = projetarCenario(215, realista);
  assert.equal(p.receitaAno1, p.receitaPrimeiroPedido * (1 + RECOMPRAS_ANO1));
});

test("base zero → tudo zero, sem NaN (import ainda não rodado)", () => {
  const p = projetarCenario(0, realista);
  assert.equal(p.vendas, 0);
  assert.equal(p.receitaPrimeiroPedido, 0);
  assert.equal(p.receitaAno1, 0);
});

test("taxasMetaFunil compõe as três taxas rumo ao ganho — casa com o funil real", () => {
  const t = taxasMetaFunil(realista);
  // meio → ganho é a última etapa; primeiro_toque → ganho tira a resposta; lead → ganho é tudo.
  assert.equal(t.taxaOrcadoFechado, realista.orcFechado);
  assert.equal(t.taxaEmContatoFechado, realista.respOrcamento * realista.orcFechado);
  assert.equal(t.taxaLeadFechado, realista.resposta * realista.respOrcamento * realista.orcFechado);
  // A composta é a taxa lead→venda que projetarCenario usa na base (sem uplift).
  assert.equal(t.taxaLeadFechado, projetarCenario(1000, realista).vendasBase / 1000);
});
