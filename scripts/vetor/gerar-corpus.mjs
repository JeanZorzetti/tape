/**
 * Gera o corpus de medida da vetorização: cada logo de logos.mjs em 4 arquivos, como a arte chega
 * (limpa: PNG 2×; pequena: 140 px de largura, ícone de site; jpgruim: 320 px borrado, JPEG q30
 * 4:2:0; print: celular borrado, reduzido e reampliado, com margem branca, JPEG q55; logo
 * transparente não tem as duas de JPG). Ao lado de cada arquivo, a transformação logo → arquivo
 * (.json), para medir.mjs renderizar a verdade exatamente na caixa que a página recortar.
 *
 * Uso: node scripts/vetor/gerar-corpus.mjs <pasta>   (a pasta é apagada e refeita)
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { LOGOS, svgDe } from "./logos.mjs";

const [saida] = process.argv.slice(2);
if (!saida) throw new Error("Uso: node scripts/vetor/gerar-corpus.mjs <pasta>");
rmSync(saida, { recursive: true, force: true });
mkdirSync(saida, { recursive: true });
const ESC_LIMPA = 2;

function gravar(nome, buf, ext, transformacao) {
  writeFileSync(`${saida}/${nome}.${ext}`, buf);
  writeFileSync(`${saida}/${nome}.json`, JSON.stringify(transformacao));
}

for (const [logo, l] of Object.entries(LOGOS)) {
  writeFileSync(`${saida}/${logo}.svg`, svgDe(l, 1, l.verdade ?? l.body));
  const grande = await sharp(Buffer.from(svgDe(l, ESC_LIMPA)), { density: 72 * ESC_LIMPA }).png().toBuffer();
  const g = await sharp(grande).metadata();
  const reduzir = async (largura) => {
    const b = await sharp(grande).resize(largura, null, { kernel: "lanczos3" }).png().toBuffer();
    const m = await sharp(b).metadata();
    return { b, ex: m.width / l.w, ey: m.height / l.h };
  };
  gravar(`${logo}__limpa`, grande, "png", { ex: g.width / l.w, ey: g.height / l.h, dx: 0, dy: 0 });
  const p = await reduzir(140);
  gravar(`${logo}__pequena`, p.b, "png", { ex: p.ex, ey: p.ey, dx: 0, dy: 0 });
  if (!l.bg) continue;
  const j = await reduzir(320);
  gravar(`${logo}__jpgruim`, await sharp(j.b).blur(0.7).jpeg({ quality: 30, chromaSubsampling: "4:2:0" }).toBuffer(), "jpg", { ex: j.ex, ey: j.ey, dx: 0, dy: 0 });
  const borrada = await sharp(grande).blur(1.4).resize(Math.round(g.width * 0.2)).png().toBuffer();
  const reampliada = await sharp(borrada).resize(Math.round(g.width * 0.375), null, { kernel: "linear" }).png().toBuffer();
  const r = await sharp(reampliada).metadata();
  const M = 40;
  const comMargem = await sharp(reampliada).extend({ top: M, bottom: M, left: M * 2, right: M * 2, background: "#fff" }).png().toBuffer();
  gravar(`${logo}__print`, await sharp(comMargem).jpeg({ quality: 55, chromaSubsampling: "4:2:0" }).toBuffer(), "jpg", { ex: r.width / l.w, ey: r.height / l.h, dx: M * 2, dy: M });
}
console.log(`corpus em ${saida}`);
