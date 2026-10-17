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

/** Os quatro cantos brancos e opacos = a logo veio sobre fundo branco (JPG, print), que não é tinta. */
export function temFundoBranco(rgba: Uint8ClampedArray, largura: number, altura: number): boolean {
  const pixel = (x: number, y: number) => (y * largura + x) * 4;
  const cantos = [pixel(0, 0), pixel(largura - 1, 0), pixel(0, altura - 1), pixel(largura - 1, altura - 1)];
  return cantos.every((i) => rgba[i + 3] >= ALFA_MINIMO && ehBranco(rgba[i], rgba[i + 1], rgba[i + 2]));
}

/**
 * Caixa onde há tinta numa imagem RGBA. Transparente é sempre margem; branco só é margem quando
 * os quatro cantos são brancos (fundo de JPG ou de print). Fundo de outra cor é parte da marca e
 * fica. Sem tinta nenhuma, devolve null.
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
