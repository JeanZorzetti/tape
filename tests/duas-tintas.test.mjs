/**
 * Separação da logo anexada em até 2 tintas (a fita imprime no máximo 2 cores) e vetorização.
 * Roda no runner nativo (`node --test`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { tintasDaLogo, separarTintas } from "../src/lib/duasTintas.ts";
import { vetorizarPixels } from "../src/lib/vetorizarLogo.ts";

const BRANCO = [255, 255, 255, 255];
const TRANSPARENTE = [0, 0, 0, 0];
const CINZA = [110, 110, 112, 255];
const NAVY = [35, 44, 122, 255];
const LARANJA = [242, 106, 27, 255];
const PRETO = [17, 17, 17, 255];
const VERMELHO = [232, 71, 47, 255];

/** Imagem 1×N a partir de uma lista de pixels RGBA. */
const linha = (...pixels) => ({ dados: new Uint8ClampedArray(pixels.flat()), largura: pixels.length, altura: 1 });
const repetir = (pixel, n) => Array.from({ length: n }, () => pixel);
const perto = (t, alvo, folga = 12) =>
  Math.abs(t.r - alvo[0]) <= folga && Math.abs(t.g - alvo[1]) <= folga && Math.abs(t.b - alvo[2]) <= folga;

/** Imagem `largura`×`altura` pintada por `cor(x, y)` (RGBA). */
function imagem(largura, altura, cor) {
  const dados = new Uint8ClampedArray(largura * altura * 4);
  for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) dados.set(cor(x, y), (y * largura + x) * 4);
  return { dados, largura, altura };
}

/** Borrão de caixa (raio em px), como a borda suavizada de um print ou JPG ampliado. */
function borrar({ dados, largura, altura }, raio) {
  const passada = (origem, horizontal) => {
    const saida = new Uint8ClampedArray(origem.length);
    for (let y = 0; y < altura; y++) {
      for (let x = 0; x < largura; x++) {
        const soma = [0, 0, 0, 0];
        let n = 0;
        for (let k = -raio; k <= raio; k++) {
          const vx = horizontal ? x + k : x;
          const vy = horizontal ? y : y + k;
          if (vx < 0 || vy < 0 || vx >= largura || vy >= altura) continue;
          const j = (vy * largura + vx) * 4;
          for (let c = 0; c < 4; c++) soma[c] += origem[j + c];
          n++;
        }
        saida.set(soma.map((s) => s / n), (y * largura + x) * 4);
      }
    }
    return saida;
  };
  return { dados: passada(passada(dados, true), false), largura, altura };
}

const misturar = (tinta, fundo, cobertura) => tinta.map((c, k) => Math.round(c * cobertura + fundo[k] * (1 - cobertura)));
const dentro = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;
/** Índice da grade separada no pixel (x, y) da imagem original. */
const indiceEm = (grade, fator, x, y) => grade.indices[(y * fator + (fator >> 1)) * grade.largura + x * fator + (fator >> 1)];
const SEPARACAO = { escalaFonte: 1, fator: 2 };

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

test("logo preta borrada não ganha uma tinta cinza na borda", () => {
  // Letras grossas e um fio fino, borrados: a borda e o fio são cinza, mas a tinta é uma só.
  const logo = borrar(
    imagem(300, 120, (x, y) => (dentro(x, y, 20, 20, 80, 90) || dentro(x, y, 110, 20, 170, 90) || dentro(x, y, 20, 104, 280, 107) ? PRETO : BRANCO)),
    4,
  );
  const tintas = tintasDaLogo(logo.dados, logo.largura, logo.altura, true, 3);
  assert.equal(tintas.length, 1, JSON.stringify(tintas));
  assert.ok(perto(tintas[0], PRETO), JSON.stringify(tintas[0]));
});

test("a cor da tinta sai do miolo, não da borda desbotada", () => {
  const logo = borrar(imagem(200, 100, (x, y) => (dentro(x, y, 30, 20, 90, 80) ? NAVY : dentro(x, y, 120, 20, 180, 80) ? LARANJA : BRANCO)), 5);
  const tintas = tintasDaLogo(logo.dados, logo.largura, logo.altura, true, 3);
  assert.equal(tintas.length, 2);
  assert.ok(tintas.some((t) => perto(t, LARANJA, 10)), `laranja desbotado: ${JSON.stringify(tintas)}`);
  assert.ok(tintas.some((t) => perto(t, NAVY, 10)), `navy: ${JSON.stringify(tintas)}`);
});

test("fio fino de outra cor (sem pixel plano) vira a segunda tinta", () => {
  // PNG transparente: nome navy grosso e um fio vermelho de 4 px embaixo (1 px do original, na
  // escala 4), borda suavizada.
  const logo = borrar(imagem(240, 100, (x, y) => (dentro(x, y, 10, 10, 230, 70) ? NAVY : dentro(x, y, 10, 84, 230, 88) ? VERMELHO : TRANSPARENTE)), 1);
  const tintas = tintasDaLogo(logo.dados, logo.largura, logo.altura, false, 4);
  assert.equal(tintas.length, 2, JSON.stringify(tintas));
  assert.ok(perto(tintas[0], NAVY, 20), JSON.stringify(tintas));
  assert.ok(perto(tintas[1], VERMELHO, 40), `vermelho: ${JSON.stringify(tintas[1])}`);
});

test("nome cinza grosso ao lado de símbolo preto continua com as duas tintas", () => {
  const logo = borrar(imagem(300, 100, (x, y) => (dentro(x, y, 10, 10, 90, 90) ? PRETO : dentro(x, y, 120, 20, 290, 80) ? [120, 120, 120, 255] : BRANCO)), 2);
  const tintas = tintasDaLogo(logo.dados, logo.largura, logo.altura, true, 2);
  assert.equal(tintas.length, 2, JSON.stringify(tintas));
});

test("separação: a borda clara de um traço navy continua navy, não vira a outra tinta", () => {
  // Traço navy de 2 px borrado: o miolo dele é navy clareado, mais perto do laranja que do navy em cor crua.
  const logo = borrar(imagem(120, 60, (x, y) => (dentro(x, y, 10, 29, 60, 31) ? NAVY : dentro(x, y, 80, 10, 110, 50) ? LARANJA : BRANCO)), 2);
  const tintas = [{ r: 35, g: 44, b: 122 }, { r: 242, g: 106, b: 27 }];
  const grade = separarTintas(logo.dados, logo.largura, logo.altura, tintas, true, SEPARACAO);
  for (const x of [20, 35, 50]) assert.equal(indiceEm(grade, 2, x, 30), 1, `x = ${x}`);
  assert.equal(indiceEm(grade, 2, 95, 30), 2);
});

test("separação: traço fino de pouca cobertura aparece, furo pequeno não fecha", () => {
  const tinta = { r: 35, g: 44, b: 122 };
  const traco = misturar(NAVY, BRANCO, 0.4);
  const furo = misturar(NAVY, BRANCO, 0.45);
  const logo = imagem(120, 60, (x, y) => {
    if (x === 20 && y >= 10 && y < 50) return traco; // 1 px, 40% de tinta
    if (dentro(x, y, 60, 10, 110, 50)) return dentro(x, y, 84, 29, 86, 31) ? furo : NAVY; // furo de 2 px que não clareia de todo
    return BRANCO;
  });
  const grade = separarTintas(logo.dados, logo.largura, logo.altura, [tinta], true, SEPARACAO);
  assert.equal(indiceEm(grade, 2, 20, 30), 1, "traço fino");
  assert.equal(indiceEm(grade, 2, 10, 30), 0, "fundo ao lado do traço");
  assert.equal(indiceEm(grade, 2, 84, 29), 0, "furo");
  assert.equal(indiceEm(grade, 2, 70, 20), 1, "chapa");
});

test("separação: ruído de JPG no fundo branco não vira pinta", () => {
  let semente = 7;
  const aleatorio = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const logo = imagem(100, 60, (x, y) => (dentro(x, y, 60, 10, 90, 50) ? NAVY : BRANCO.map((c, k) => (k === 3 ? 255 : c - Math.round(aleatorio() * 24)))));
  const grade = separarTintas(logo.dados, logo.largura, logo.altura, [{ r: 35, g: 44, b: 122 }], true, SEPARACAO);
  let pintas = 0;
  for (let y = 0; y < 60; y++) for (let x = 0; x < 50; x++) pintas += indiceEm(grade, 2, x, y) ? 1 : 0;
  assert.equal(pintas, 0);
});

test("separação de PNG transparente: meia opacidade decide entre tinta e película", () => {
  const { dados, largura, altura } = imagem(40, 20, (x) => [35, 44, 122, x < 20 ? 60 : 230]);
  const grade = separarTintas(dados, largura, altura, [{ r: 35, g: 44, b: 122 }], false, SEPARACAO);
  assert.equal(indiceEm(grade, 2, 5, 10), 0);
  assert.equal(indiceEm(grade, 2, 35, 10), 1);
});

test("vetorização: logo preta borrada sai numa tinta só, no tamanho da imagem recebida", () => {
  const logo = borrar(imagem(240, 100, (x, y) => (dentro(x, y, 20, 20, 100, 80) || dentro(x, y, 140, 20, 220, 80) ? PRETO : BRANCO)), 3);
  const svg = vetorizarPixels({ ...logo, fundoBranco: true, escalaFonte: 3 });
  const cores = new Set(svg.match(/fill="rgb\([^)]*\)"/g));
  assert.equal(cores.size, 1, [...cores].join(" "));
  assert.match(svg, /<svg width="240" height="100" viewBox="0 0 480 200"/);
});

test("vetorização: imagem sem tinta nenhuma devolve null", () => {
  const vazia = imagem(50, 20, () => BRANCO);
  assert.equal(vetorizarPixels({ ...vazia, fundoBranco: true, escalaFonte: 1 }), null);
});
