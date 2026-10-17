/**
 * Separação da logo anexada em até 2 tintas (a fita imprime no máximo 2 cores) e vetorização.
 * Roda no runner nativo (`node --test`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { tintasDaLogo, chapasDaLogo, separarTintas } from "../src/lib/duasTintas.ts";
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

/** Tom de cinza ao longo de faixas: [início, fim, tom no início, tom no fim], o tom em linha reta entre os dois. */
function tomNasFaixas(faixas, y) {
  for (const [y0, y1, t0, t1] of faixas) if (y >= y0 && y < y1) return Math.round(t0 + ((t1 - t0) * (y - y0)) / Math.max(1, y1 - y0));
  return null;
}
// Letra cromada: prata, degradê até o preto, preto, degradê até o cinza, cinza. Degradê lento é plano.
const CROMADO = [[0, 15, 245, 245], [15, 45, 245, 20], [45, 60, 20, 20], [60, 80, 20, 140], [80, 95, 140, 140]];
const cinza = (t) => [t, t, t, 255];
/** O X azul de uma logo cromada: degradê horizontal do marinho ao celeste. */
const azulDoX = (x, x0, x1) => misturar([20, 170, 240, 255], [10, 60, 150, 255], (x - x0) / (x1 - x0)).map((c, k) => (k === 3 ? 255 : c));
const croma = ({ r, g, b }) => Math.max(r, g, b) - Math.min(r, g, b);

test("cromado: os cinzas do degradê viram uma chapa preta e o X azul fica com a outra", () => {
  // PNG transparente: a letra cromada à esquerda e o X azul à direita (a versão anterior escolhia
  // as 2 cores de maior área, prata e preto, e o azul sumia).
  const logo = imagem(300, 110, (x, y) => {
    const tom = tomNasFaixas(CROMADO, y - 8);
    if (x >= 10 && x < 140 && tom !== null) return cinza(tom);
    if (x >= 170 && x < 290 && y >= 10 && y < 100) return azulDoX(x, 170, 290);
    return TRANSPARENTE;
  });
  const { chapas } = chapasDaLogo(logo.dados, logo.largura, logo.altura, false, 1);
  assert.equal(chapas.length, 2, JSON.stringify(chapas));
  const cromo = chapas.find((c) => c.cores.length > 1 && c.cores.every((t) => croma(t) < 20));
  const azul = chapas.find((c) => c !== cromo);
  assert.ok(cromo, `cromado numa chapa: ${JSON.stringify(chapas)}`);
  // Prata não imprime: o designer refaz o cromado em preto.
  assert.ok(perto(cromo.tinta, [30, 30, 30], 4), JSON.stringify(cromo.tinta));
  // O tom mais vivo do degradê do X, não o marinho.
  assert.ok(azul.tinta.b > 200 && azul.tinta.g > 120 && azul.tinta.r < 60, JSON.stringify(azul.tinta));
  assert.deepEqual(tintasDaLogo(logo.dados, logo.largura, logo.altura, false, 1), chapas.map((c) => c.tinta));
});

test("fundo preto preso no cromado sai película; o preto que encosta na transparência fica", () => {
  // Recorte do iPhone: a moldura cromada guarda um miolo preto opaco. À direita, uma barra preta
  // solta no transparente (um nome preto ao lado do emblema).
  const logo = imagem(300, 110, (x, y) => {
    const tom = tomNasFaixas(CROMADO, y - 8);
    const naMoldura = x >= 10 && x < 160 && tom !== null;
    if (naMoldura && x >= 50 && x < 120 && y >= 30 && y < 80) return cinza(5);
    if (naMoldura) return cinza(tom);
    if (x >= 200 && x < 280 && y >= 30 && y < 80) return cinza(5);
    return TRANSPARENTE;
  });
  const { pelicula } = chapasDaLogo(logo.dados, logo.largura, logo.altura, false, 1);
  assert.ok(pelicula, "sem película");
  assert.equal(pelicula[55 * 300 + 85], 1, "miolo preto cercado pelo cromado");
  assert.equal(pelicula[55 * 300 + 240], 0, "barra preta solta");
});

test("o papel claro atrás do desenho não vira tinta", () => {
  // Faixa de papel cinza-claro (a folha rasgada de um selo) com o nome preto em cima, e um desenho navy.
  const papel = [218, 223, 225, 255];
  const logo = imagem(300, 120, (x, y) => {
    if (dentro(x, y, 20, 40, 280, 80)) return dentro(x, y, 40, 52, 260, 68) ? PRETO : papel;
    if (dentro(x, y, 100, 90, 200, 115) || dentro(x, y, 100, 5, 200, 30)) return NAVY;
    return BRANCO;
  });
  const tintas = tintasDaLogo(logo.dados, logo.largura, logo.altura, true, 1);
  assert.ok(!tintas.some((t) => perto(t, papel, 15)), JSON.stringify(tintas));
});

test("matiz perdido: o vermelho miúdo de uma estampa azul vira tinta", () => {
  // Estampa: miolo navy grande e pontos vermelhos de 1 px, sem pixel plano, uns 4% da tinta: abaixo
  // do mínimo do traço fino (5%), e a versão anterior só via o navy.
  const VERMELHO_TELHA = [150, 60, 45, 255];
  const logo = imagem(300, 120, (x, y) => {
    if (dentro(x, y, 10, 10, 190, 110)) return NAVY;
    if (dentro(x, y, 200, 10, 240, 110) && x % 3 === 0 && y % 2 === 0) return VERMELHO_TELHA;
    return BRANCO;
  });
  const tintas = tintasDaLogo(logo.dados, logo.largura, logo.altura, true, 1);
  assert.equal(tintas.length, 2, JSON.stringify(tintas));
  assert.ok(tintas.some((t) => t.r > 100 && t.r > 2 * t.b), `vermelho: ${JSON.stringify(tintas)}`);
});

test("cor dominante com brilho de outra imprime a dominante", () => {
  // Nome marinho (quase toda a arte) com o brilho ciano de uma letra em degradê para o marinho, e um
  // detalhe roxo: a chapa do marinho e do ciano imprime marinho, não o ciano mais vivo.
  const MARINHO = [4, 18, 55, 255];
  const logo = imagem(320, 100, (x, y) => {
    if (dentro(x, y, 10, 10, 230, 90)) return dentro(x, y, 10, 10, 60, 40) ? misturar([5, 212, 250, 255], MARINHO, Math.max(0, 1 - (x - 10) / 50)) : MARINHO;
    if (dentro(x, y, 250, 30, 310, 70)) return [125, 39, 237, 255];
    return TRANSPARENTE;
  });
  const tintas = tintasDaLogo(logo.dados, logo.largura, logo.altura, false, 1);
  assert.ok(tintas.some((t) => perto(t, MARINHO, 12)), JSON.stringify(tintas));
});

test("separação: degradê de ouro claro a bronze, sobre branco, sai cheio", () => {
  // Perto do branco os raios do ouro claro e do bronze quase se encontram; o pixel claro que caía
  // no raio do bronze saía pela metade e rachava o traço.
  const OURO = [221, 192, 115, 255];
  const BRONZE = [146, 98, 33, 255];
  const logo = imagem(240, 80, (x, y) => (dentro(x, y, 20, 20, 220, 60) ? misturar(BRONZE, OURO, (x - 20) / 200).map((c, k) => (k === 3 ? 255 : c)) : BRANCO));
  const tintas = [{ r: 183, g: 136, b: 54 }];
  const grade = separarTintas(logo.dados, logo.largura, logo.altura, tintas, true, { ...SEPARACAO, coresDeCada: [[OURO, BRONZE].map(([r, g, b]) => ({ r, g, b }))] });
  for (let x = 24; x < 216; x += 6) for (const y of [26, 40, 54]) assert.equal(indiceEm(grade, 2, x, y), 1, `(${x}, ${y})`);
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
