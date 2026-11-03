/**
 * O que a PreviaNaFita.astro entrega ao Worker, no Node: corta a margem da logo (na cópia de até
 * 1200 px), leva o recorte a 400 px de altura (até 2400 de largura) e devolve o pedido de
 * vetorização. `codigo` é a pasta com recorteLogo.ts (a src/lib do repo, ou a de outra versão).
 *
 * O navegador redimensiona com o filtro dele, não com o do sharp: as cores da tinta saem perto,
 * não iguais (a Turquia saiu 27,60,137 aqui e 55,108,157 no Chrome). A última palavra é a página.
 */
import sharp from "sharp";
import { resolve } from "node:path";

const LADO_MAX_ANALISE = 1200;
// A página usa 400; o servidor da Polaris (fita.ts), 800. ALTURA_VETOR=800 mede a do servidor.
const ALTURA_VETORIZACAO = Number(process.env.ALTURA_VETOR ?? 400);
const LARGURA_MAX_VETORIZACAO = 2400;

async function lerRgba(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { dados: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), w: info.width, h: info.height };
}

/** `{ pedido, caixa }`: o pedido do Worker e a caixa (em pixels do arquivo) que a página recortou. Null sem tinta. */
export async function prepararComoAPagina(buf, codigo, { cortada = false, alturaVetor = ALTURA_VETORIZACAO } = {}) {
  const { caixaDaTinta, temFundoBranco } = await import(resolve(codigo, "recorteLogo.ts"));
  // Versão anterior a 03/11/2026 não tem fundoDaLogo.ts: segue sem ler o fundo.
  const fundoDaLogo = await import(resolve(codigo, "fundoDaLogo.ts")).catch((e) => { if (e.code === "ERR_MODULE_NOT_FOUND" && String(e.message).includes("fundoDaLogo")) return null; throw e; });
  const img = await lerRgba(buf);
  const escala = Math.min(1, LADO_MAX_ANALISE / Math.max(img.w, img.h));
  const aw = Math.max(1, Math.round(img.w * escala));
  const ah = Math.max(1, Math.round(img.h * escala));
  const analise = escala === 1 ? img : await lerRgba(await sharp(buf).ensureAlpha().resize(aw, ah, { kernel: "cubic", fit: "fill" }).png().toBuffer());
  const leitura = fundoDaLogo
    ? fundoDaLogo.lerArte(analise.dados, aw, ah, { cortada })
    : (() => {
        const caixa = caixaDaTinta(analise.dados, aw, ah);
        return caixa && { caixa, fundoBranco: temFundoBranco(analise.dados, aw, ah) };
      })();
  if (!leitura) return null;
  const { caixa: tinta, fundoBranco } = leitura;
  // Volta à escala do arquivo, com 1 pixel de folga, como a página.
  const sx = Math.max(0, Math.floor((tinta.x - 1) / escala));
  const sy = Math.max(0, Math.floor((tinta.y - 1) / escala));
  const sw = Math.min(img.w - sx, Math.ceil((tinta.w + 2) / escala));
  const sh = Math.min(img.h - sy, Math.ceil((tinta.h + 2) / escala));
  const esc = Math.min(alturaVetor / sh, LARGURA_MAX_VETORIZACAO / sw);
  const largura = Math.max(1, Math.round(sw * esc));
  const altura = Math.max(1, Math.round(sh * esc));
  const alvo = await lerRgba(
    await sharp(buf)
      .ensureAlpha()
      .extract({ left: sx, top: sy, width: sw, height: sh })
      .resize(largura, altura, { kernel: esc > 1 ? "cubic" : "lanczos3", fit: "fill" })
      .png()
      .toBuffer(),
  );
  fundoDaLogo?.aplicarLeitura(alvo.dados, largura, altura, leitura);
  return { pedido: { dados: alvo.dados, largura, altura, fundoBranco, escalaFonte: esc }, caixa: { sx, sy, sw, sh } };
}
