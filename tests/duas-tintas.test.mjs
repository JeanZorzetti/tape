/**
 * Separação da logo anexada em até 2 tintas (a fita imprime no máximo 2 cores).
 * Roda no runner nativo (`node --test`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { tintasDaLogo, separarTintas } from "../src/lib/duasTintas.ts";

/** Imagem 1×N a partir de uma lista de pixels RGBA. */
const linha = (...pixels) => ({ dados: new Uint8ClampedArray(pixels.flat()), largura: pixels.length, altura: 1 });
const repetir = (pixel, n) => Array.from({ length: n }, () => pixel);
const perto = (t, alvo, folga = 12) =>
  Math.abs(t.r - alvo[0]) <= folga && Math.abs(t.g - alvo[1]) <= folga && Math.abs(t.b - alvo[2]) <= folga;

const BRANCO = [255, 255, 255, 255];
const CINZA = [110, 110, 112, 255];
const NAVY = [35, 44, 122, 255];

test("cinza do nome + degradê azul-verde viram duas tintas, a mais usada primeiro", () => {
  const degrade = [[20, 90, 170, 255], [20, 120, 160, 255], [30, 150, 140, 255]];
  const { dados, largura, altura } = linha(...repetir(BRANCO, 10), ...repetir(CINZA, 30), ...degrade.flatMap((p) => repetir(p, 5)));
  const tintas = tintasDaLogo(dados, largura, altura, true);
  assert.equal(tintas.length, 2);
  assert.ok(perto(tintas[0], CINZA), `cinza: ${JSON.stringify(tintas[0])}`);
  assert.ok(perto(tintas[1], [23, 120, 157], 20), `degradê: ${JSON.stringify(tintas[1])}`);
});

test("logo de uma cor só não inventa segunda tinta", () => {
  const { dados, largura, altura } = linha(...repetir(BRANCO, 5), ...repetir(NAVY, 20), ...repetir([40, 48, 128, 255], 10));
  assert.equal(tintasDaLogo(dados, largura, altura, true).length, 1);
});

test("separação: borda clara vira película, borda escura vira tinta", () => {
  const bordaClara = [235, 236, 240, 255];
  const bordaEscura = [70, 76, 140, 255];
  const { dados, largura, altura } = linha(BRANCO, bordaClara, bordaEscura, NAVY);
  const saida = separarTintas(dados, largura, altura, [{ r: 35, g: 44, b: 122 }], true);
  assert.deepEqual([...saida.slice(0, 8)], [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([...saida.slice(8)], [35, 44, 122, 255, 35, 44, 122, 255]);
});

test("PNG transparente: meia opacidade decide entre tinta e película", () => {
  const { dados, largura, altura } = linha([35, 44, 122, 100], [35, 44, 122, 180]);
  const saida = separarTintas(dados, largura, altura, [{ r: 35, g: 44, b: 122 }], false);
  assert.equal(saida[3], 0);
  assert.equal(saida[7], 255);
});

test("logo borrada: a faixa clara da borda não vira a segunda tinta", () => {
  // 300×300 (a prévia amplia a logo para 400 px de altura antes da conta), fundo branco:
  // um bloco cinza com 4 px de borda cinza-claro e um bloco azul menor.
  const largura = 300, altura = 300;
  const dados = new Uint8ClampedArray(largura * altura * 4);
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      let cor = [255, 255, 255, 255];
      if (x >= 20 && x < 180 && y >= 20 && y < 280) cor = [175, 178, 182, 255];
      if (x >= 24 && x < 176 && y >= 24 && y < 276) cor = [105, 105, 108, 255];
      if (x >= 210 && x < 270 && y >= 100 && y < 200) cor = [25, 120, 160, 255];
      dados.set(cor, (y * largura + x) * 4);
    }
  }
  const tintas = tintasDaLogo(dados, largura, altura, true);
  assert.equal(tintas.length, 2);
  assert.ok(perto(tintas[0], [105, 105, 108]), `cinza: ${JSON.stringify(tintas[0])}`);
  assert.ok(perto(tintas[1], [25, 120, 160]), `azul: ${JSON.stringify(tintas[1])}`);
});
