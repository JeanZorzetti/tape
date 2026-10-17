/**
 * Vetoriza a logo anexada: separa em até 2 tintas, como a fita imprime, e traça cada tinta em
 * curvas. Só conta sobre pixels (sem DOM): roda no Worker da prévia e no teste do Node.
 */
import ImageTracer from "imagetracerjs";
import { tintasDaLogo, separarTintas, type GradeDeTintas } from "./duasTintas.ts";

export interface PedidoVetorizacao {
  dados: Uint8ClampedArray;
  largura: number;
  altura: number;
  fundoBranco: boolean;
  /** Pixels desta imagem por pixel do arquivo original (a prévia amplia logo pequena). */
  escalaFonte: number;
}

/**
 * A separação sai nesta ampliação: a divisa entre tinta e película cai entre os pixels da imagem
 * e o traçador desenha a curva lisa, em vez do degrau de cada pixel.
 */
const FATOR_AMPLIACAO = 2;
// Na grade ampliada: tolerância de 1 px da imagem para reta e curva, e mancha com menos de
// 6 px de contorno da imagem é ruído de compressão (mais que isso apagava pedaço de letra fina).
const OPCOES_TRACADO = {
  ltres: FATOR_AMPLIACAO / 2,
  qtres: FATOR_AMPLIACAO / 2,
  pathomit: 6 * FATOR_AMPLIACAO,
  rightangleenhance: true,
  strokewidth: 0,
  linefilter: false,
  roundcoords: 1,
  viewbox: false,
  desc: false,
  scale: 1,
};
/** Índice 0 da grade: película, sem tinta. */
const PELICULA = { r: 0, g: 0, b: 0, a: 0 };

/** O SVG da logo em até 2 tintas, no tamanho da imagem recebida, ou null quando não há tinta nenhuma. */
export function vetorizarPixels({ dados, largura, altura, fundoBranco, escalaFonte }: PedidoVetorizacao): string | null {
  const tintas = tintasDaLogo(dados, largura, altura, fundoBranco, escalaFonte);
  if (tintas.length === 0) return null;
  const grade = separarTintas(dados, largura, altura, tintas, fundoBranco, { escalaFonte, fator: FATOR_AMPLIACAO });
  return (
    tracar(grade, [PELICULA, ...tintas.map((t) => ({ ...t, a: 255 }))])
      // As coordenadas estão na grade ampliada; o tamanho declarado volta ao da imagem recebida.
      .replace(/<svg[^>]*>/, `<svg width="${largura}" height="${altura}" viewBox="0 0 ${grade.largura} ${grade.altura}" version="1.1" xmlns="http://www.w3.org/2000/svg">`)
  );
}

/**
 * Traça a grade camada por camada de tinta, pelas mesmas etapas do imagedataToTracedata do
 * imagetracerjs, sem duas que aqui só gastam tempo: a quantização de cor (a grade já vem com o
 * índice da paleta) e o traçado da película, que não vai para o SVG.
 */
function tracar(grade: GradeDeTintas, paleta: { r: number; g: number; b: number; a: number }[]): string {
  const opcoes = ImageTracer.checkoptions({ ...OPCOES_TRACADO, pal: paleta, numberofcolors: paleta.length });
  const { indices, largura, altura } = grade;
  // A matriz indexada do traçador tem uma borda de -1 em volta da imagem.
  const borda = () => new Int16Array(largura + 2).fill(-1);
  const linhas = [borda()];
  for (let y = 0; y < altura; y++) {
    const linha = borda();
    linha.set(indices.subarray(y * largura, (y + 1) * largura), 1);
    linhas.push(linha);
  }
  linhas.push(borda());
  const indexada = { array: linhas, palette: paleta };
  const camadas = paleta.map((_, k) =>
    k === 0
      ? []
      : ImageTracer.batchtracepaths(
          ImageTracer.internodes(ImageTracer.pathscan(ImageTracer.layeringstep(indexada, k), opcoes.pathomit), opcoes),
          opcoes.ltres,
          opcoes.qtres,
        ),
  );
  return ImageTracer.getsvgstring({ layers: camadas, palette: paleta, width: largura, height: altura }, opcoes);
}
