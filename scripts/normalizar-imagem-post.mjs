/**
 * Normaliza uma imagem gerada para a capa de post: 1200×800, JPEG mozjpeg.
 *
 *   node scripts/normalizar-imagem-post.mjs <origem> <destino> [corte] [recorte]
 *
 * `corte` é `center` (padrão), `atencao` (o `strategy.attention` do sharp) ou
 * qualquer posição do sharp — `bottom`, `top`, `left`… Só importa quando o Gemini
 * devolve 1:1 em vez do 3:2 pedido e o assunto não está no centro vertical.
 *
 * `recorte` é `left,top,width,height` na escala da origem, aplicado ANTES do
 * redimensionamento. Serve para **cortar o watermark ✦ do Gemini**, que fica
 * perto do canto inferior direito — a uns 10% da borda, não colado nela, então
 * não dá para tirar com uma margem fixa: confira cada imagem e recorte na mão.
 * Ver handoff-imagens-blog.md.
 */
import sharp from "sharp";
import { join } from "node:path";

const LARGURA = 1200;
const ALTURA = 800;

const [origem, destino, corte = "center", recorte] = process.argv.slice(2);
if (!origem || !destino) {
  console.error(
    "uso: node scripts/normalizar-imagem-post.mjs <origem> <destino.jpg> [corte] [l,t,w,h]",
  );
  process.exit(1);
}

const imagem = sharp(join("imagens/gerado", origem));
if (recorte) {
  const [left, top, width, height] = recorte.split(",").map(Number);
  imagem.extract({ left, top, width, height });
}

await imagem
  .resize({
    width: LARGURA,
    height: ALTURA,
    fit: "cover",
    position: corte === "atencao" ? sharp.strategy.attention : corte,
  })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(join("src/assets/conteudo", destino));

console.log(`ok  src/assets/conteudo/${destino}  ${LARGURA}×${ALTURA}`);
