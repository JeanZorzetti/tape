// imagetracerjs 1.2.6 não traz tipos. Só o que a prévia da fita usa.
declare module "imagetracerjs" {
  interface ImagemRgba {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  }
  const ImageTracer: {
    imagedataToSVG(imagem: ImagemRgba, opcoes?: Record<string, unknown>): string;
  };
  export default ImageTracer;
}
