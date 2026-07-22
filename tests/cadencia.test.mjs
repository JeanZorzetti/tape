/**
 * Cadência de 1ª venda — helpers puros (sem banco, sem browser).
 * A régua é CADENCIA_DIAS = [0,1,3,7,14,21]: 6 toques contados da entrada do lead.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { CADENCIA_DIAS, cadenciaEsgotada, proximaDataCadencia } from "../src/lib/adminUi.ts";

test("proximaDataCadencia devolve as 6 datas D+0,+1,+3,+7,+14,+21 a partir da base", () => {
  const base = "2026-01-01";
  const esperado = ["2026-01-01", "2026-01-02", "2026-01-04", "2026-01-08", "2026-01-15", "2026-01-22"];
  esperado.forEach((data, n) => assert.equal(proximaDataCadencia(n, base), data, `toque ${n}`));
});

test("proximaDataCadencia atravessa a virada de mês corretamente", () => {
  assert.equal(proximaDataCadencia(5, "2026-01-20"), "2026-02-10"); // +21 dias
});

test("proximaDataCadencia devolve null após o 6º toque (cadência esgotada)", () => {
  assert.equal(proximaDataCadencia(CADENCIA_DIAS.length, "2026-01-01"), null);
  assert.equal(proximaDataCadencia(99, "2026-01-01"), null);
});

test("cadenciaEsgotada vira true exatamente no 6º toque", () => {
  assert.equal(cadenciaEsgotada(5), false);
  assert.equal(cadenciaEsgotada(6), true);
  assert.equal(cadenciaEsgotada(0), false);
});
