/**
 * Mede a vetorização da prévia da fita contra o corpus (gerar-corpus.mjs): para cada arquivo, faz o
 * que a página faz (pagina.mjs) e compara o SVG com a verdade renderizada na mesma caixa. Mede o
 * erro RGB médio e o IoU da tinta a 400 px, e o erro no tamanho da fita (~140 px). Grava o SVG, uma
 * folha de contato (entrada | saída | verdade) e resultado.json, que comparar.mjs lê.
 *
 * Uso: node scripts/vetor/medir.mjs <pasta-do-código> <corpus> <saída> [filtro]
 *   <pasta-do-código>: src/lib, ou a src/lib de outra versão para comparar. Para uma versão
 *   anterior: git worktree add /tmp/tape-antes <sha> && ln -s "$PWD/node_modules" /tmp/tape-antes/
 *   (Node 22 ou mais novo, que roda .ts sem compilar.)
 *
 * Referência de 17/10/2026 (ec3e781): corpus de 9 logos chapadas × 4 arquivos, erro 5,02 e IoU
 * 0,906 (antes 5,07 e 0,907 em 7cf9aae); casos cromados de 3,3 a 12,6 (antes de 81 a 232).
 */
import sharp from "sharp";
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { prepararComoAPagina } from "./pagina.mjs";

const [codigo, corpus, saida, filtro = ""] = process.argv.slice(2);
if (!codigo || !corpus || !saida) throw new Error("Uso: node scripts/vetor/medir.mjs <pasta-do-código> <corpus> <saída> [filtro]");
mkdirSync(saida, { recursive: true });
const { vetorizarPixels } = await import(resolve(codigo, "vetorizarLogo.ts"));
const ALTURA_NA_FITA = 140;

const sobreBranco = (buf, w, h) => sharp(buf).resize(w, h, { fit: "fill", kernel: "lanczos3" }).flatten({ background: "#fff" }).removeAlpha().raw().toBuffer();

function comparar(a, b) {
  let erro = 0;
  let uniao = 0;
  let inter = 0;
  const tinta = (d, i) => d[i] + d[i + 1] + d[i + 2] < 615;
  const n = a.length / 3;
  for (let i = 0; i < a.length; i += 3) {
    erro += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    const ta = tinta(a, i);
    const tb = tinta(b, i);
    if (ta || tb) uniao++;
    if (ta && tb) inter++;
  }
  return { erro: erro / n / 3, iou: uniao ? inter / uniao : 1 };
}

async function folhaDeContato(destino, quadros) {
  const H = 200;
  const tira = await Promise.all(quadros.map((q) => sharp(q).flatten({ background: "#fff" }).resize({ height: H }).png().toBuffer()));
  const metas = await Promise.all(tira.map((t) => sharp(t).metadata()));
  let x = 10;
  const posicoes = metas.map((m) => {
    const esquerda = x;
    x += m.width + 10;
    return esquerda;
  });
  await sharp({ create: { width: x, height: H + 20, channels: 3, background: "#bbb" } })
    .composite(tira.map((t, i) => ({ input: t, left: posicoes[i], top: 10 })))
    .png()
    .toFile(destino);
}

const linhas = [];
for (const arquivo of readdirSync(corpus).filter((f) => /\.(png|jpg)$/.test(f) && f.includes(filtro)).sort()) {
  const nome = arquivo.replace(/\.(png|jpg)$/, "");
  const [logo] = nome.split("__");
  const transformacao = JSON.parse(readFileSync(`${corpus}/${nome}.json`, "utf8"));
  const t0 = performance.now();
  const preparado = await prepararComoAPagina(readFileSync(`${corpus}/${arquivo}`), codigo);
  const svg = preparado ? vetorizarPixels(preparado.pedido) : null;
  const ms = performance.now() - t0;
  if (!svg) {
    linhas.push({ nome, erro: NaN, iou: NaN, erroFita: NaN, ms, bytes: 0 });
    continue;
  }
  writeFileSync(`${saida}/${nome}.svg`, svg);
  const { largura, altura, dados } = preparado.pedido;
  const { sx, sy, sw, sh } = preparado.caixa;
  // A verdade: o SVG da logo com o viewBox na caixa recortada (em unidades da logo).
  const viewBox = [(sx - transformacao.dx) / transformacao.ex, (sy - transformacao.dy) / transformacao.ey, sw / transformacao.ex, sh / transformacao.ey];
  const verdadeSvg = readFileSync(`${corpus}/${logo}.svg`, "utf8").replace(
    /<svg[^>]*>/,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="${viewBox.join(" ")}" preserveAspectRatio="none">`,
  );
  const verdade = await sharp(Buffer.from(verdadeSvg), { density: 72 }).png().toBuffer();
  const vetor = await sharp(Buffer.from(svg), { density: 72 }).png().toBuffer();
  const m = comparar(await sobreBranco(vetor, largura, altura), await sobreBranco(verdade, largura, altura));
  const larguraNaFita = Math.max(1, Math.round((largura * ALTURA_NA_FITA) / altura));
  const mf = comparar(await sobreBranco(vetor, larguraNaFita, ALTURA_NA_FITA), await sobreBranco(verdade, larguraNaFita, ALTURA_NA_FITA));
  const entrada = await sharp(Buffer.from(dados.buffer, dados.byteOffset, dados.length), { raw: { width: largura, height: altura, channels: 4 } }).png().toBuffer();
  await folhaDeContato(`${saida}/${nome}.contato.png`, [entrada, vetor, verdade]);
  linhas.push({ nome, erro: m.erro, iou: m.iou, erroFita: mf.erro, ms, bytes: svg.length });
}

const validas = (k) => linhas.filter((l) => !Number.isNaN(l[k]));
const media = (k) => validas(k).reduce((s, l) => s + l[k], 0) / Math.max(1, validas(k).length);
console.log("caso".padEnd(28), "erro".padStart(6), "IoU".padStart(6), "eFita".padStart(6), "ms".padStart(5), "kB".padStart(6));
for (const l of [...linhas, { nome: "MÉDIA", erro: media("erro"), iou: media("iou"), erroFita: media("erroFita"), ms: media("ms"), bytes: media("bytes") }]) {
  console.log(l.nome.padEnd(28), l.erro.toFixed(2).padStart(6), l.iou.toFixed(3).padStart(6), l.erroFita.toFixed(2).padStart(6), l.ms.toFixed(0).padStart(5), (l.bytes / 1024).toFixed(1).padStart(6));
}
writeFileSync(`${saida}/resultado.json`, JSON.stringify(linhas));
