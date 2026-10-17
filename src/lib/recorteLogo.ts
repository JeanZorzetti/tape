/**
 * Recorte da margem da logo que a pessoa anexa na prévia da página de produto. Arquivo de logo
 * costuma vir com muita margem (print do celular, PNG exportado num quadro grande); sem recorte,
 * a margem entra na altura da fita e a logo de verdade fica minúscula.
 *
 * Só a conta sobre os pixels mora aqui (sem DOM), para o teste rodar no Node.
 */

export interface CaixaDaTinta {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Abaixo disso de opacidade o pixel é transparente: margem, não tinta. */
const ALFA_MINIMO = 16;
/** Os três canais acima disso = branco de fundo, com folga para o ruído de compressão do JPG. */
const LIMIAR_BRANCO = 230;

export const ehBranco = (r: number, g: number, b: number) => r >= LIMIAR_BRANCO && g >= LIMIAR_BRANCO && b >= LIMIAR_BRANCO;

/**
 * Fração da borda da imagem que precisa ser branca e opaca para a logo ter vindo sobre fundo branco
 * (JPG, print). Pela borda toda, não pelos cantos: símbolo que encosta num canto (a ponta de um
 * monograma, um degradê que sangra) fazia o fundo branco virar tinta.
 */
const FRACAO_BORDA_BRANCA = 0.5;

/** A logo veio sobre fundo branco (JPG, print), que não é tinta: ver FRACAO_BORDA_BRANCA. */
export function temFundoBranco(rgba: Uint8ClampedArray, largura: number, altura: number): boolean {
  const branco = (x: number, y: number) => {
    const i = (y * largura + x) * 4;
    return rgba[i + 3] >= ALFA_MINIMO && ehBranco(rgba[i], rgba[i + 1], rgba[i + 2]) ? 1 : 0;
  };
  let brancos = 0;
  let borda = 0;
  for (let x = 0; x < largura; x++) {
    brancos += branco(x, 0) + (altura > 1 ? branco(x, altura - 1) : 0);
    borda += altura > 1 ? 2 : 1;
  }
  for (let y = 1; y < altura - 1; y++) {
    brancos += branco(0, y) + (largura > 1 ? branco(largura - 1, y) : 0);
    borda += largura > 1 ? 2 : 1;
  }
  return brancos >= borda * FRACAO_BORDA_BRANCA;
}

/**
 * Caixa onde há tinta numa imagem RGBA. Transparente é sempre margem; branco só é margem quando
 * a imagem veio sobre fundo branco (temFundoBranco: JPG, print). Fundo de outra cor é parte da
 * marca e fica. Sem tinta nenhuma, devolve null.
 */
export function caixaDaTinta(rgba: Uint8ClampedArray, largura: number, altura: number): CaixaDaTinta | null {
  const pixel = (x: number, y: number) => (y * largura + x) * 4;
  const fundoBranco = temFundoBranco(rgba, largura, altura);

  let minX = largura;
  let minY = altura;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = pixel(x, y);
      if (rgba[i + 3] < ALFA_MINIMO) continue;
      if (fundoBranco && ehBranco(rgba[i], rgba[i + 1], rgba[i + 2])) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
