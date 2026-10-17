// imagetracerjs 1.2.6 não traz tipos. Só o que a prévia da fita usa: as etapas do traçado, chamadas
// uma a uma (ver vetorizarLogo.ts).
declare module "imagetracerjs" {
  interface Cor {
    r: number;
    g: number;
    b: number;
    a: number;
  }
  interface Opcoes {
    ltres: number;
    qtres: number;
    pathomit: number;
    [opcao: string]: unknown;
  }
  /** Matriz de índices da paleta, com borda de -1. */
  interface ImagemIndexada {
    array: ArrayLike<number>[];
    palette: Cor[];
  }
  type Camada = unknown[];
  const ImageTracer: {
    checkoptions(opcoes: Record<string, unknown>): Opcoes;
    layeringstep(imagem: ImagemIndexada, indice: number): number[][];
    pathscan(camada: number[][], pathomit: number): unknown[];
    internodes(caminhos: unknown[], opcoes: Opcoes): unknown[];
    batchtracepaths(caminhos: unknown[], ltres: number, qtres: number): Camada;
    getsvgstring(tracado: { layers: Camada[]; palette: Cor[]; width: number; height: number }, opcoes: Opcoes): string;
  };
  export default ImageTracer;
}
