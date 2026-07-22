/**
 * Money path do CRM: reais digitados (formato BR) → centavos inteiros e a volta.
 * Nunca float acumulado; por isso tem teste próprio.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatarBRL, reaisParaCentavos } from "../src/lib/adminUi.ts";

test("reaisParaCentavos entende o formato BR (ponto milhar, vírgula decimal)", () => {
  assert.equal(reaisParaCentavos("1.234,50"), 123450);
  assert.equal(reaisParaCentavos("50"), 5000);
  assert.equal(reaisParaCentavos("50,00"), 5000);
  assert.equal(reaisParaCentavos("0,99"), 99);
  assert.equal(reaisParaCentavos("R$ 1.000"), 100000);
});

test("reaisParaCentavos devolve null para vazio ou ilegível", () => {
  assert.equal(reaisParaCentavos(""), null);
  assert.equal(reaisParaCentavos("   "), null);
  assert.equal(reaisParaCentavos("abc"), null);
});

test("formatarBRL exibe centavos como moeda e '—' quando ausente", () => {
  assert.equal(formatarBRL(null), "—");
  assert.match(formatarBRL(123450), /1\.234,50/);
  assert.match(formatarBRL(5000), /50,00/);
});

test("round-trip: reaisParaCentavos → formatarBRL preserva o valor", () => {
  assert.match(formatarBRL(reaisParaCentavos("1.234,50")), /1\.234,50/);
});
