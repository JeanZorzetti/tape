/**
 * Gera public/og-default.png — a imagem que aparece em TODO link compartilhado
 * no WhatsApp, que é o canal principal deste negócio.
 *
 * Layout: painel de marca à esquerda (logo real + specs), foto real do produto
 * à direita. Assimétrico de propósito — ver CLAUDE.md, "kill the AI look".
 *
 * Rodar da raiz: node scripts/gerar-og.mjs
 */
import sharp from "sharp";

const LARGURA = 1200;
const ALTURA = 630;
const LARGURA_PAINEL = 500;
const LARGURA_FOTO = LARGURA - LARGURA_PAINEL;
const ESPESSURA_FILETE = 6;

const PAPER = "#faf8f4";
const NAVY = "#232c7a";
const LARANJA = "#f47c20";

const MARGEM_PAINEL = 64;
const LARGURA_LOGO = 372;
const PROPORCAO_LOGO = 1627 / 1167;
const ALTURA_LOGO = Math.round(LARGURA_LOGO / PROPORCAO_LOGO);
const TOPO_LOGO = 140;

/** 128 cores segura o arquivo em ~100 KB sem banding visível — a foto é
 *  quase toda kraft/laranja/cinza. Acima disso o PNG pula para ~220 KB. */
const CORES_PALETA = 128;

/** Specs em caixa alta tracked — sinal de confiança, não enfeite (CLAUDE.md). */
const LINHAS_SPEC = ["BOPP IMPRESSA · FITA GOMADA", "SOB MEDIDA · A PARTIR DE 20 ROLOS"];
const TOPO_SPEC = TOPO_LOGO + ALTURA_LOGO + 56;
const ENTRELINHA_SPEC = 30;

const fundo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}">
  <rect width="${LARGURA}" height="${ALTURA}" fill="${PAPER}" />
  <rect x="${LARGURA_PAINEL - ESPESSURA_FILETE}" y="0" width="${ESPESSURA_FILETE}" height="${ALTURA}" fill="${LARANJA}" />
</svg>`);

const specs = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA_PAINEL}" height="${ALTURA}">
  ${LINHAS_SPEC.map(
    (linha, i) =>
      `<text x="${MARGEM_PAINEL}" y="${TOPO_SPEC + i * ENTRELINHA_SPEC}" fill="${NAVY}"
        font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="600" letter-spacing="1.6">${linha}</text>`,
  ).join("\n  ")}
</svg>`);

const foto = await sharp("src/assets/conteudo/rolos-tapepro-prateleira.jpg")
  .resize({ width: LARGURA_FOTO, height: ALTURA, fit: "cover", position: sharp.strategy.attention })
  .toBuffer();

const logo = await sharp("src/assets/marca/logo-tapepro.png").resize({ width: LARGURA_LOGO }).toBuffer();

await sharp(fundo)
  .composite([
    { input: foto, left: LARGURA_PAINEL, top: 0 },
    { input: logo, left: MARGEM_PAINEL, top: TOPO_LOGO },
    { input: specs, left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9, palette: true, colors: CORES_PALETA })
  .toFile("public/og-default.png");

console.log("public/og-default.png gerado");
