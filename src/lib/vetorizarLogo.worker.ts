/**
 * Vetoriza a logo anexada na prévia da página de produto, fora da thread da página (o traçado
 * leva centenas de ms no celular). Separa em até 2 tintas, como a fita imprime, e traça cada
 * tinta em curvas: a logo sai com borda limpa mesmo vinda de print ou JPG.
 * Só é baixado quando alguém anexa uma logo.
 */
import ImageTracer from "imagetracerjs";
import { tintasDaLogo, separarTintas } from "./duasTintas.ts";

export interface PedidoVetorizacao {
  dados: Uint8ClampedArray;
  largura: number;
  altura: number;
  fundoBranco: boolean;
}

export interface RespostaVetorizacao {
  svg: string | null;
}

// Tolerância de 1 px para reta e curva; mancha com menos de 6 px de contorno é ruído de compressão
// (mais que isso apagava pedaço de letra fina, como o "DISTRIBUIDORA" de uma logo borrada).
// Paleta fixa e um ciclo só: as cores já vêm separadas, o traçador não pode recalculá-las.
const OPCOES_TRACADO = {
  ltres: 1,
  qtres: 1,
  pathomit: 6,
  rightangleenhance: true,
  colorsampling: 0,
  colorquantcycles: 1,
  blurradius: 0,
  strokewidth: 0,
  linefilter: false,
  roundcoords: 1,
  viewbox: false,
  desc: false,
  scale: 1,
};
const PELICULA = { r: 0, g: 0, b: 0, a: 0 };

self.onmessage = (evento: MessageEvent<PedidoVetorizacao>) => {
  const { dados, largura, altura, fundoBranco } = evento.data;
  const tintas = tintasDaLogo(dados, largura, altura, fundoBranco);
  if (tintas.length === 0) {
    self.postMessage({ svg: null } satisfies RespostaVetorizacao);
    return;
  }
  const separada = separarTintas(dados, largura, altura, tintas, fundoBranco);
  const pal = [PELICULA, ...tintas.map((t) => ({ ...t, a: 255 }))];
  const svg = ImageTracer.imagedataToSVG({ width: largura, height: altura, data: separada }, { ...OPCOES_TRACADO, pal, numberofcolors: pal.length })
    // A camada da película é invisível (opacity 0): só peso no arquivo.
    .replace(/<path[^>]*opacity="0"[^>]*\/>/g, "");
  self.postMessage({ svg } satisfies RespostaVetorizacao);
};
