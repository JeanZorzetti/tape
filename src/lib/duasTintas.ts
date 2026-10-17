/**
 * Separação da logo anexada em até 2 tintas, como o clichê faz na fita real: cada cor da arte
 * vira uma chapa, e a fita imprime no máximo 2. Degradê vira a cor média dele; o fundo (branco
 * ou transparente) vira película sem tinta. A saída alimenta a vetorização (imagetracerjs).
 *
 * Só conta sobre pixels, sem DOM: roda no Worker da prévia e no teste do Node.
 */
import { ehBranco } from "./recorteLogo.ts";

export interface Tinta {
  r: number;
  g: number;
  b: number;
}

/** Só pixel quase opaco entra na conta da cor: a borda semitransparente puxaria a tinta para o fundo. */
const ALFA_SOLIDO = 200;
/** Na separação, meia opacidade decide entre tinta e película. */
const ALFA_TINTA = 128;
/** Sobre fundo branco, só entra na conta da cor o pixel com algum canal abaixo disto (a borda suavizada fica fora). */
const LIMIAR_SOLIDO = 200;
/** Distância retilínea (soma dos 3 canais) abaixo da qual as duas tintas achadas são a mesma. */
const MESMA_TINTA = 90;
/**
 * Miolo do traço: só conta para a cor o pixel cujos vizinhos a esta distância (fração da altura)
 * também são tinta. Em logo borrada (print, JPG ampliado) a borda é uma faixa larga de tinta
 * misturada com o fundo; sem isso, as duas tintas achadas viram "escuro" e "borda clara".
 */
const FRACAO_NUCLEO = 0.015;
/** Teto de pixels amostrados para achar as cores: a conta fica igual e rápida em logo grande. */
const AMOSTRAS_MAX = 40_000;
/**
 * Sobre fundo branco, o pixel só vira película quando está bem mais perto do branco que da tinta.
 * Em 1 (meio a meio) o texto fino de uma logo borrada, que é quase todo borda clara, se picota.
 */
const VIES_PARA_TINTA = 0.7;
const CICLOS_KMEANS = 8;
const BRANCO: Tinta = { r: 255, g: 255, b: 255 };

const distancia = (t: Tinta, r: number, g: number, b: number) => Math.abs(t.r - r) + Math.abs(t.g - g) + Math.abs(t.b - b);

/**
 * As até 2 tintas da logo (k-means com k = 2), a mais usada primeiro. Duas tintas parecidas
 * demais viram uma só. Logo sem tinta nenhuma devolve lista vazia.
 */
export function tintasDaLogo(rgba: Uint8ClampedArray, largura: number, altura: number, fundoBranco: boolean): Tinta[] {
  const total = largura * altura;
  const tinta = new Uint8Array(total);
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    tinta[p] = rgba[i + 3] >= ALFA_SOLIDO && (!fundoBranco || Math.min(rgba[i], rgba[i + 1], rgba[i + 2]) < LIMIAR_SOLIDO) ? 1 : 0;
  }
  const raio = Math.max(1, Math.round(altura * FRACAO_NUCLEO));
  const noMiolo = (p: number) => {
    const x = p % largura;
    const y = (p - x) / largura;
    return (
      x >= raio && x < largura - raio && y >= raio && y < altura - raio &&
      tinta[p - raio] === 1 && tinta[p + raio] === 1 && tinta[p - raio * largura] === 1 && tinta[p + raio * largura] === 1
    );
  };

  const passo = Math.max(1, Math.floor(total / AMOSTRAS_MAX));
  let amostras: number[] = [];
  const bordas: number[] = [];
  for (let p = 0; p < total; p += passo) {
    if (!tinta[p]) continue;
    (noMiolo(p) ? amostras : bordas).push(p * 4);
  }
  // Logo de traço muito fino não tem miolo: aí a borda é tudo o que há.
  if (amostras.length === 0) amostras = bordas;
  if (amostras.length === 0) return [];

  const corDe = (i: number): Tinta => ({ r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] });
  const brilho = (i: number) => rgba[i] + rgba[i + 1] + rgba[i + 2];
  // Ponto de partida estável: a amostra mais escura e a mais distante dela.
  let centros = [corDe(amostras.reduce((a, b) => (brilho(b) < brilho(a) ? b : a)))];
  centros.push(corDe(amostras.reduce((a, b) => (distancia(centros[0], ...rgbDe(rgba, b)) > distancia(centros[0], ...rgbDe(rgba, a)) ? b : a))));

  let contagem = [0, 0];
  for (let ciclo = 0; ciclo < CICLOS_KMEANS; ciclo++) {
    const soma = [{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }];
    contagem = [0, 0];
    for (const i of amostras) {
      const [r, g, b] = rgbDe(rgba, i);
      const k = distancia(centros[0], r, g, b) <= distancia(centros[1], r, g, b) ? 0 : 1;
      soma[k].r += r;
      soma[k].g += g;
      soma[k].b += b;
      contagem[k]++;
    }
    centros = centros.map((c, k) =>
      contagem[k] ? { r: Math.round(soma[k].r / contagem[k]), g: Math.round(soma[k].g / contagem[k]), b: Math.round(soma[k].b / contagem[k]) } : c,
    );
  }

  if (contagem[1] === 0 || distancia(centros[0], centros[1].r, centros[1].g, centros[1].b) < MESMA_TINTA) {
    const n = contagem[0] + contagem[1];
    const media = (canal: keyof Tinta) => Math.round((centros[0][canal] * contagem[0] + centros[1][canal] * contagem[1]) / n);
    return [{ r: media("r"), g: media("g"), b: media("b") }];
  }
  return contagem[0] >= contagem[1] ? centros : [centros[1], centros[0]];
}

function rgbDe(rgba: Uint8ClampedArray, i: number): [number, number, number] {
  return [rgba[i], rgba[i + 1], rgba[i + 2]];
}

/**
 * A logo reimpressa só com as tintas dadas: cada pixel vira a tinta mais próxima ou película
 * (transparente). Sobre fundo branco, pixel mais perto do branco que de qualquer tinta é película.
 */
export function separarTintas(
  rgba: Uint8ClampedArray,
  largura: number,
  altura: number,
  tintas: Tinta[],
  fundoBranco: boolean,
): Uint8ClampedArray {
  const saida = new Uint8ClampedArray(largura * altura * 4);
  if (tintas.length === 0) return saida;
  for (let i = 0; i < saida.length; i += 4) {
    if (rgba[i + 3] < ALFA_TINTA) continue;
    const [r, g, b] = rgbDe(rgba, i);
    if (fundoBranco && ehBranco(r, g, b)) continue;
    let melhor = tintas[0];
    let menor = distancia(melhor, r, g, b);
    for (const t of tintas.slice(1)) {
      const d = distancia(t, r, g, b);
      if (d < menor) {
        melhor = t;
        menor = d;
      }
    }
    if (fundoBranco && distancia(BRANCO, r, g, b) < menor * VIES_PARA_TINTA) continue;
    saida[i] = melhor.r;
    saida[i + 1] = melhor.g;
    saida[i + 2] = melhor.b;
    saida[i + 3] = 255;
  }
  return saida;
}
