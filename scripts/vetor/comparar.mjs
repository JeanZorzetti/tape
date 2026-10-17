/**
 * Casos do corpus em que o erro mudou entre duas medidas (resultado.json de medir.mjs).
 *
 * Uso: node scripts/vetor/comparar.mjs <antes/resultado.json> <depois/resultado.json> [diferença mínima = 0,1]
 */
import { readFileSync } from "node:fs";

const [antes, depois, minimo = "0.1"] = process.argv.slice(2);
if (!antes || !depois) throw new Error("Uso: node scripts/vetor/comparar.mjs <antes.json> <depois.json> [diferença mínima]");
const [a, b] = [antes, depois].map((f) => JSON.parse(readFileSync(f, "utf8")));
const porNome = new Map(a.map((l) => [l.nome, l]));
for (const l of b) {
  const o = porNome.get(l.nome);
  if (!o || Math.abs(o.erro - l.erro) < Number(minimo)) continue;
  console.log(l.nome.padEnd(28), o.erro.toFixed(2), "→", l.erro.toFixed(2), "  IoU", o.iou.toFixed(3), "→", l.iou.toFixed(3));
}
