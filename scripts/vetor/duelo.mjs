/**
 * Logos reais (sem verdade conhecida), antes × depois: entrada | versão antes | versão depois, uma
 * logo por linha, sobre papelão claro. Imprime tempo, número de caminhos e as tintas de cada uma.
 * É a conferência no olho que o corpus não faz: arte que chega de cliente (print do Instagram,
 * cromado de IA, PNG recortado no iPhone) não tem verdade, e a referência é o layout do designer.
 *
 * Uso: node scripts/vetor/duelo.mjs <saída.png> <código-antes> <código-depois> <imagem>...
 *   (as pastas de código como em medir.mjs)
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { prepararComoAPagina } from "./pagina.mjs";

const [saida, codigoAntes, codigoDepois, ...imagens] = process.argv.slice(2);
if (!saida || !codigoAntes || !codigoDepois || imagens.length === 0) {
  throw new Error("Uso: node scripts/vetor/duelo.mjs <saída.png> <código-antes> <código-depois> <imagem>...");
}
const versoes = [await import(resolve(codigoAntes, "vetorizarLogo.ts")), await import(resolve(codigoDepois, "vetorizarLogo.ts"))];
const H = 120;
const PAPELAO = "#d8c3a0";

const quadro = (buf) => sharp(buf).resize({ height: H }).flatten({ background: PAPELAO }).png().toBuffer();
const tintas = (svg) => (svg ? [...new Set(svg.match(/fill="rgb\([^)]*\)"/g))].map((c) => c.slice(10, -1)).join(" ") : "—");
const caminhos = (svg) => (svg ? (svg.match(/<path/g) ?? []).length : 0);

const linhas = [];
for (const caminho of imagens) {
  const preparado = await prepararComoAPagina(readFileSync(caminho), codigoDepois);
  if (!preparado) continue;
  const { dados, largura, altura } = preparado.pedido;
  const entrada = await sharp(Buffer.from(dados.buffer, dados.byteOffset, dados.length), { raw: { width: largura, height: altura, channels: 4 } }).png().toBuffer();
  const linha = [await quadro(entrada)];
  const relato = [];
  for (const [k, versao] of versoes.entries()) {
    const t0 = performance.now();
    const svg = versao.vetorizarPixels({ ...preparado.pedido, dados: new Uint8ClampedArray(dados) });
    const ms = performance.now() - t0;
    relato.push(`${k ? "depois" : "antes "} ${ms.toFixed(0).padStart(4)} ms ${String(caminhos(svg)).padStart(4)} caminhos ${tintas(svg).padEnd(26)}`);
    linha.push(await quadro(svg ? Buffer.from(svg) : entrada));
  }
  console.log(basename(caminho).padEnd(32), relato.join("  "));
  linhas.push(linha);
}

const metas = await Promise.all(linhas.map((l) => Promise.all(l.map((b) => sharp(b).metadata()))));
const colunas = [0, 1, 2].map((j) => Math.max(...metas.map((m) => m[j].width)));
const composicao = [];
let y = 8;
for (const linha of linhas) {
  let x = 12;
  linha.forEach((b, j) => {
    composicao.push({ input: b, left: x, top: y });
    x += colunas[j] + 12;
  });
  y += H + 8;
}
const W = colunas.reduce((s, c) => s + c + 12, 12);
await sharp({ create: { width: W, height: y, channels: 3, background: "#7a7a7a" } }).composite(composicao).png().toFile(saida);
console.log(`folha em ${saida}`);
