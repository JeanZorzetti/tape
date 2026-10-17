// Regera o pôster do hero (src/assets/marca/rolo-3d-repouso.png): um quadro da própria
// cena 3D no comprimento de repouso, com fundo transparente. Pôster e cena precisam ser
// o mesmo quadro para a troca no carregamento não aparecer, então rode isto sempre que
// mexer em src/lib/rolo3d/cena.ts.
//
// Uso: com `npx astro dev --port 4399` no ar,
//   node scripts/rolo3d/gerar-poster.mjs
// playwright-core não é dependência do site (pesaria no build do Docker): instale onde
// quiser e aponte PLAYWRIGHT_CORE para a pasta dele. Usa o Chrome do sistema.
import sharp from "sharp";

const TAMANHO = 1200;
const SERVIDOR = process.env.SERVIDOR ?? "http://localhost:4399";
const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome";
const SAIDA = new URL("../../src/assets/marca/rolo-3d-repouso.png", import.meta.url);

const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? "playwright-core");
const navegador = await chromium.launch({
  executablePath: CHROME,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const pagina = await navegador.newPage();
// Qualquer página serve: só precisa do CSS global, que carrega as fontes da impressão.
await pagina.goto(`${SERVIDOR}/sobre/`, { waitUntil: "load" });
const dataUrl = await pagina.evaluate(async (tamanho) => {
  const cena3d = await import("/src/lib/rolo3d/cena.ts");
  await cena3d.carregarFontesDaImpressao();
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const cena = cena3d.criarCenaDoRolo(canvas, { densidadeDePixels: 1, preservarQuadro: true });
  cena.redimensionar(tamanho, tamanho);
  cena.renderizar();
  return canvas.toDataURL("image/png");
}, TAMANHO);
await navegador.close();
await sharp(Buffer.from(dataUrl.split(",")[1], "base64")).png({ compressionLevel: 9 }).toFile(SAIDA.pathname);
console.log(`pôster salvo em ${SAIDA.pathname}`);
