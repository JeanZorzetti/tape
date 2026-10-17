/**
 * Recorte da margem da logo anexada na prévia: acha a caixa onde há tinta (o que não é
 * transparente nem fundo branco) para a logo ocupar a fita, e não o arquivo inteiro.
 * Roda no runner nativo (`node --test`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { caixaDaTinta } from "../src/lib/recorteLogo.ts";

const BRANCO = [255, 255, 255, 255];
const TRANSPARENTE = [0, 0, 0, 0];
const NAVY = [35, 44, 122, 255];

/** Imagem de `largura`×`altura` preenchida com `fundo` e um retângulo de `tinta`. */
function imagem(largura, altura, fundo, tinta, { x, y, w, h }) {
  const dados = new Uint8ClampedArray(largura * altura * 4);
  for (let py = 0; py < altura; py++) {
    for (let px = 0; px < largura; px++) {
      const dentro = px >= x && px < x + w && py >= y && py < y + h;
      dados.set(dentro ? tinta : fundo, (py * largura + px) * 4);
    }
  }
  return dados;
}

test("PNG com margem transparente: a caixa é só a logo", () => {
  const dados = imagem(200, 400, TRANSPARENTE, NAVY, { x: 60, y: 180, w: 80, h: 30 });
  assert.deepEqual(caixaDaTinta(dados, 200, 400), { x: 60, y: 180, w: 80, h: 30 });
});

test("JPG com margem branca e ruído de compressão: o quase-branco conta como fundo", () => {
  const dados = imagem(300, 300, [246, 248, 244, 255], NAVY, { x: 100, y: 120, w: 90, h: 40 });
  assert.deepEqual(caixaDaTinta(dados, 300, 300), { x: 100, y: 120, w: 90, h: 40 });
});

test("fundo colorido faz parte da marca: não recorta", () => {
  const vermelho = [200, 30, 30, 255];
  const dados = imagem(120, 80, vermelho, BRANCO, { x: 30, y: 20, w: 60, h: 40 });
  assert.deepEqual(caixaDaTinta(dados, 120, 80), { x: 0, y: 0, w: 120, h: 80 });
});

test("imagem sem tinta nenhuma devolve null", () => {
  assert.equal(caixaDaTinta(imagem(50, 50, BRANCO, BRANCO, { x: 0, y: 0, w: 0, h: 0 }), 50, 50), null);
  assert.equal(caixaDaTinta(imagem(50, 50, TRANSPARENTE, TRANSPARENTE, { x: 0, y: 0, w: 0, h: 0 }), 50, 50), null);
});
