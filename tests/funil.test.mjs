/**
 * Funil por coorte — o helper puro que calcula as três taxas (sem banco).
 * A regra: numerador de cada taxa "chegou a fechado E àquela etapa"; divisor zero → null.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { taxasFunil } from "../src/lib/adminUi.ts";

test("taxasFunil calcula lead→fechado, em contato→fechado e orçado→fechado", () => {
  const t = taxasFunil({
    totalLeads: 10,
    chegaramEmContato: 8,
    chegaramOrcado: 5,
    chegaramFechado: 3,
    fechadoDesdeEmContato: 3,
    fechadoDesdeOrcado: 2,
  });
  assert.equal(t.taxaLeadFechado, 3 / 10);
  assert.equal(t.taxaEmContatoFechado, 3 / 8);
  assert.equal(t.taxaOrcadoFechado, 2 / 5);
});

test("taxasFunil usa o numerador condicional (fechado E a etapa), não só 'fechado'", () => {
  // 4 fecharam, mas só 1 passou por 'orçado' → orçado→fechado = 1/2, não 4/2.
  const t = taxasFunil({
    totalLeads: 6,
    chegaramEmContato: 6,
    chegaramOrcado: 2,
    chegaramFechado: 4,
    fechadoDesdeEmContato: 4,
    fechadoDesdeOrcado: 1,
  });
  assert.equal(t.taxaOrcadoFechado, 1 / 2);
});

test("taxasFunil devolve null (não NaN) quando o divisor é zero", () => {
  const t = taxasFunil({
    totalLeads: 0,
    chegaramEmContato: 0,
    chegaramOrcado: 0,
    chegaramFechado: 0,
    fechadoDesdeEmContato: 0,
    fechadoDesdeOrcado: 0,
  });
  assert.equal(t.taxaLeadFechado, null);
  assert.equal(t.taxaEmContatoFechado, null);
  assert.equal(t.taxaOrcadoFechado, null);
});
