/**
 * O fundo da arte lido antes de separar as tintas (fundoDaLogo.ts). Casos reais de 03/11/2026: a logo
 * branca num cartão marinho com filete (Logística) e o rótulo em papel creme (Mamãe Antônia).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { aplicarLeitura, aplicarReceita, caixaSemMoldura, encaixarNoVao, lerArte, lerFundo } from "../src/lib/fundoDaLogo.ts";
import { chapasDaLogo } from "../src/lib/duasTintas.ts";

const MARINHO = [2, 37, 103, 255];
const BRANCO = [255, 255, 255, 255];
const CREME = [252, 249, 228, 255];
const PRETO = [17, 17, 17, 255];

function imagem(largura, altura, cor) {
  const dados = new Uint8ClampedArray(largura * altura * 4);
  for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) dados.set(cor(x, y), (y * largura + x) * 4);
  return dados;
}
const pixel = (dados, largura, x, y) => [...dados.subarray((y * largura + x) * 4, (y * largura + x) * 4 + 4)];
const noRet = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;

test("marca branca em fundo marinho: sai marinho sobre película, sem o bloco", () => {
  const dados = imagem(300, 200, (x, y) => (noRet(x, y, 100, 60, 200, 140) ? BRANCO : MARINHO));
  const receita = lerFundo(dados, 300, 200);
  assert.equal(receita?.tipo, "marcas");
  aplicarReceita(dados, receita);
  assert.deepEqual(pixel(dados, 300, 5, 5).slice(0, 3), [255, 255, 255], "o fundo vira película");
  assert.deepEqual(pixel(dados, 300, 150, 100).slice(0, 3), MARINHO.slice(0, 3), "a marca imprime a cor do fundo");
});

test("marca colorida em fundo escuro mantém a cor dela", () => {
  const AMARELO = [255, 196, 0, 255];
  const dados = imagem(300, 200, (x, y) => (noRet(x, y, 40, 60, 120, 140) ? BRANCO : noRet(x, y, 180, 60, 260, 140) ? AMARELO : MARINHO));
  const receita = lerFundo(dados, 300, 200);
  aplicarReceita(dados, receita);
  assert.deepEqual(pixel(dados, 300, 80, 100).slice(0, 3), MARINHO.slice(0, 3));
  assert.deepEqual(pixel(dados, 300, 220, 100).slice(0, 3), AMARELO.slice(0, 3));
});

test("papel creme vira branco, e o desenho continua como é", () => {
  const dados = imagem(300, 200, (x, y) => (noRet(x, y, 100, 60, 200, 140) ? [2, 40, 107, 255] : CREME));
  const receita = lerFundo(dados, 300, 200);
  assert.equal(receita?.tipo, "papel");
  aplicarReceita(dados, receita);
  assert.deepEqual(pixel(dados, 300, 5, 5).slice(0, 3), [255, 255, 255]);
  assert.ok(pixel(dados, 300, 150, 100)[2] < 125);
});

test("não mexe no que já funcionava", () => {
  // Fundo branco: cuida o motor.
  assert.equal(lerFundo(imagem(100, 100, (x, y) => (noRet(x, y, 40, 40, 60, 60) ? PRETO : BRANCO)), 100, 100), null);
  // Logo recortada, com transparência.
  assert.equal(lerFundo(imagem(100, 100, (x, y) => (noRet(x, y, 40, 40, 60, 60) ? PRETO : [0, 0, 0, 0])), 100, 100), null);
  // Foto: a borda não tem uma cor só.
  assert.equal(lerFundo(imagem(100, 100, (x, y) => [(x * 7) % 255, (y * 11) % 255, ((x + y) * 3) % 255, 255]), 100, 100), null);
  // Imagem só de fundo, sem marca.
  assert.equal(lerFundo(imagem(100, 100, () => MARINHO), 100, 100), null);
  // Moldura grossa em volta de outra cor: a borda é uniforme, mas o fundo é outro.
  assert.equal(lerFundo(imagem(100, 100, (x, y) => (noRet(x, y, 8, 8, 92, 92) ? CREME : MARINHO)), 100, 100), null);
});

test("degradê sobre fundo escuro (cromado) segue pelo motor, que sabe refazer", () => {
  const dados = imagem(300, 200, (x, y) => (noRet(x, y, 40, 40, 260, 160) ? [50 + (y - 40) * 1.6, 50 + (y - 40) * 1.6, 55 + (y - 40) * 1.6, 255] : [0, 0, 0, 255]));
  assert.equal(lerFundo(dados, 300, 200), null);
});

test("moldura solta longe do miolo sai, e a marca enche a fita", () => {
  // Filete a 10 px da borda e marca pequena no meio.
  const dados = imagem(300, 200, (x, y) => {
    const naMoldura = noRet(x, y, 10, 10, 290, 190) && !noRet(x, y, 14, 14, 286, 186);
    return naMoldura || noRet(x, y, 120, 70, 180, 130) ? BRANCO : MARINHO;
  });
  const leitura = lerArte(dados, 300, 200);
  assert.equal(leitura.fundoBranco, true);
  assert.deepEqual(leitura.caixa, { x: 120, y: 70, w: 60, h: 60 });
});

test("moldura colada no nome é parte da marca e fica", () => {
  const dados = imagem(300, 100, (x, y) => {
    const naMoldura = noRet(x, y, 10, 10, 290, 90) && !noRet(x, y, 14, 14, 286, 86);
    return naMoldura || noRet(x, y, 24, 24, 276, 76) ? PRETO : BRANCO;
  });
  const leitura = lerArte(dados, 300, 100);
  assert.deepEqual(leitura.caixa, { x: 10, y: 10, w: 280, h: 80 });
});

test("anel redondo do selo não é moldura", () => {
  const dentro = (x, y, r) => (x - 100) ** 2 + (y - 100) ** 2 <= r * r;
  const dados = imagem(200, 200, (x, y) => ((dentro(x, y, 95) && !dentro(x, y, 88)) || dentro(x, y, 30) ? PRETO : BRANCO));
  const leitura = lerArte(dados, 200, 200);
  assert.ok(leitura.caixa.w >= 188 && leitura.caixa.h >= 188, JSON.stringify(leitura.caixa));
});

test("arte cortada: a sobra da moldura na beira sai, e o desenho fica", () => {
  // Filete em cima e à esquerda, cortado na direita e embaixo pelo recorte.
  const dados = imagem(900, 600, (x, y) => (y < 3 || x < 3 || noRet(x, y, 300, 180, 600, 420) ? [2, 40, 107, 255] : CREME));
  const leitura = lerArte(dados, 900, 600);
  assert.equal(leitura.receita?.tipo, "papel");
  assert.deepEqual(leitura.caixa, { x: 300, y: 180, w: 300, h: 240 });
});

test("sem a marca de arte cortada, filete encostado na beira é da logo", () => {
  const ehTinta = (p) => {
    const x = p % 100;
    const y = (p - x) / 100;
    return y >= 96 || noRet(x, y, 30, 30, 70, 70);
  };
  assert.deepEqual(caixaSemMoldura({ x: 0, y: 30, w: 100, h: 70 }, 100, 100, ehTinta, false), { x: 0, y: 30, w: 100, h: 70 });
});

test("a caixa do Claude cai no vão de verdade, qualquer que seja o erro dele", () => {
  // Desenho até x 440, vão até 470, tabela a partir daí; filete em cima e embaixo cruzando tudo.
  const dados = imagem(800, 400, (x, y) => {
    if (y < 6 || y >= 394) return [2, 40, 107, 255];
    if (noRet(x, y, 40, 40, 440, 360)) return (x + y) % 7 < 3 ? [2, 40, 107, 255] : CREME;
    if (noRet(x, y, 470, 40, 780, 360)) return y % 12 < 6 && (x + y) % 9 < 4 ? [2, 40, 107, 255] : CREME;
    return CREME;
  });
  for (const direita of [0.5, 0.56, 0.58, 0.62]) {
    const c = encaixarNoVao(dados, 800, 400, { esquerda: 0.02, topo: 0.03, direita, base: 0.97 });
    const fim = c.x + c.w - 1;
    assert.ok(fim >= 440 && fim < 470, `direita ${direita} caiu em ${fim}`);
  }
});

test("rótulo de ponta a ponta: papel creme sem borda branca não vira tinta", () => {
  const AZUL = [2, 40, 107, 255];
  const dados = imagem(300, 200, (x, y) => (noRet(x, y, 60, 50, 240, 150) && (x + y) % 8 < 3 ? AZUL : CREME));
  const leitura = lerArte(dados, 300, 200);
  assert.equal(leitura.receita?.tipo, "papel");
  const copia = new Uint8ClampedArray(dados);
  aplicarReceita(copia, leitura.receita);
  const { chapas } = chapasDaLogo(copia, 300, 200, true);
  assert.equal(chapas.length, 1);
  assert.ok(chapas[0].tinta.b < 150, JSON.stringify(chapas[0].tinta));
});

test("arte cortada dentro da moldura: o papel sai pela cor dominante, não pela borda", () => {
  const AZUL = [2, 40, 107, 255];
  // A borda é toda filete azul; dentro, papel creme e o desenho.
  const dados = imagem(600, 400, (x, y) => (x < 8 || y < 8 || x >= 592 || y >= 392 || (noRet(x, y, 200, 120, 400, 280) && (x + y) % 8 < 3) ? AZUL : CREME));
  assert.equal(lerFundo(dados, 600, 400), null, "sem o aviso de corte a borda manda");
  const leitura = lerArte(dados, 600, 400, { cortada: true });
  assert.equal(leitura.receita?.tipo, "papel");
  assert.equal(leitura.fundoBranco, true);
  assert.ok(leitura.caixa.x >= 190 && leitura.caixa.w <= 220, JSON.stringify(leitura.caixa));
});

test("o canto da moldura que entra na caixa é apagado, e o desenho ao lado fica", () => {
  const AZUL = [2, 40, 107, 255];
  // Filete no topo e à esquerda, com uma ponta em diagonal até (35, 35); o desenho começa em (30, 60) e (60, 30), e a caixa, em (30, 30).
  const emL = (x, y) => y < 3 || x < 3 || (x < 36 && y < 36 && Math.abs(x - y) < 3);
  const arte = (x, y) => emL(x, y) || noRet(x, y, 30, 60, 200, 120) || noRet(x, y, 60, 30, 200, 60) ? AZUL : CREME;
  const dados = imagem(600, 400, arte);
  const leitura = lerArte(dados, 600, 400, { cortada: true });
  assert.ok(leitura.apagar, "há o que apagar");
  const { caixa } = leitura;
  assert.deepEqual([caixa.x, caixa.y], [30, 30]);
  const recorte = new Uint8ClampedArray(caixa.w * caixa.h * 4);
  for (let y = 0; y < caixa.h; y++) recorte.set(dados.subarray(((y + caixa.y) * 600 + caixa.x) * 4, ((y + caixa.y) * 600 + caixa.x + caixa.w) * 4), y * caixa.w * 4);
  aplicarLeitura(recorte, caixa.w, caixa.h, leitura);
  const naCaixa = (x, y) => pixel(recorte, caixa.w, x - caixa.x, y - caixa.y).slice(0, 3);
  assert.ok(naCaixa(100, 100)[2] < 125, "o desenho fica");
  assert.deepEqual(naCaixa(33, 33), [255, 255, 255], "o canto da moldura some");
  assert.ok(naCaixa(30, 62)[2] < 125, "o desenho colado no canto fica");
});
