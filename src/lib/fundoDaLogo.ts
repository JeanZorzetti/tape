/**
 * O fundo da arte que o cliente manda, lido antes de separar as tintas. A fita é película: o
 * designer da TapePro nunca imprime o bloco do fundo, ele tira o fundo e imprime a marca (os layouts
 * reais em sofia-ia/docs/clientes/Tape Pro). Dois casos que saíam errados (03/11/2026):
 * - papel de cor (o creme do rótulo recortado, sem a borda branca): o papel virava tinta;
 * - marca clara em fundo de cor (logo branca num retângulo marinho): o retângulo virava tinta e a marca, furo.
 *
 * Tudo vira a mesma entrada de sempre, uma arte sobre fundo branco, e o resto do motor não muda. A
 * leitura sai de uma cópia reduzida e a receita vale em qualquer tamanho (ver aplicarReceita).
 *
 * Só conta sobre pixels, sem DOM: roda na página, no Worker e no servidor.
 */
import { caixaDaTinta, temFundoBranco, type CaixaDaTinta } from "./recorteLogo.ts";

interface Cor {
  r: number;
  g: number;
  b: number;
}

/** Como a marca sai: `cor` é o que se lê na arte, `sai` é a tinta que ela imprime. */
export interface MarcaDoFundo {
  cor: Cor;
  sai: Cor;
}

export type ReceitaDoFundo =
  /** Papel claro: cada canal dividido pelo do papel, e o papel vira branco. Mantém ilustração e degradê. */
  | { tipo: "papel"; fundo: Cor }
  /** Fundo de cor com marca chapada: cada pixel é a mistura do fundo com uma das marcas. */
  | { tipo: "marcas"; fundo: Cor; marcas: MarcaDoFundo[] };

/** Faixa da borda lida: esta fração do menor lado da imagem. */
const FRACAO_DA_FAIXA = 0.01;
/** Borda com esta fração de pixels transparentes já é logo recortada: nada a tirar. */
const FRACAO_TRANSPARENTE = 0.2;
const ALFA_SOLIDO = 200;
/** A cor do fundo cobre esta fração da faixa da borda. Abaixo disso é foto, ou desenho que sangra. */
const FRACAO_FUNDO_NA_BORDA = 0.7;
/** E esta fração da imagem: moldura grossa em volta de outra cor tem borda uniforme, mas não é fundo. */
const FRACAO_FUNDO_NA_IMAGEM = 0.25;
/** Fundo de cor pede mais: errar aqui inverte a arte (o painel creme dentro de uma moldura marinho viraria tinta). */
const FRACAO_FUNDO_DE_COR = 0.45;
/**
 * E o fundo de cor continua para dentro: o anel a ANEL_INTERNO do menor lado ainda é ele, em pelo menos
 * FRACAO_NO_ANEL. Filete em volta de um nome também enche a borda, mas é fino.
 */
const ANEL_INTERNO = 0.1;
const FRACAO_NO_ANEL = 0.6;
/** Na segunda leitura, a beira borrada do corte (mistura com a margem branca) fica de fora: esta fração de cada lado. */
const RECUO_DA_SEGUNDA = 0.02;
/** Distância (soma dos 3 canais) até a qual o pixel é da cor do fundo. O ruído do JPG fica abaixo disso. */
const PERTO_DO_FUNDO = 45;
/** Os três canais acima disto: o fundo já é branco, e o motor cuida dele (o creme do rótulo fica em 228 a 232: é papel). */
const BRANCO_DO_MOTOR = 245;
/** O menor canal acima disto: é papel claro (creme, cinza-claro). */
const PAPEL_CLARO = 170;
/** Com menos tinta que isto a imagem é só o fundo: não há marca para salvar. */
const TINTA_MINIMA = 0.002;
/** Marca precisa estar longe do fundo (soma dos 3 canais): perto disso é borda suavizada. */
const LONGE_DO_FUNDO = 150;
const GRUPOS_DE_MARCA = 3;
const CICLOS = 6;
/** Grupo de marca com menos que isto dos pixels dela é ruído. */
const FRACAO_DA_MARCA = 0.03;
/** Duas marcas a menos que isto (soma dos 3 canais) são a mesma cor. */
const MESMA_MARCA = 90;
/**
 * Marca chapada: o meio do caminho entre o fundo e a marca é só a borda suavizada, que muda de repente.
 * Meio-tom plano (parecido com os vizinhos a RAIO_PLANO pixels) é degradê, como o cromado sobre preto. Com
 * mais que esta fração dele a arte segue pelo motor, que sabe refazer o cromado.
 */
const FRACAO_DEGRADE = 0.08;
const RAIO_PLANO = 2;
const VARIACAO_PLANA = 30;
/** A marca plana com mais dispersão que isto (soma dos 3 canais, média até a cor dela) também é degradê: o k-means partiu a rampa em cores. */
const DISPERSAO_DEGRADE = 40;
/** Desvio (euclidiano) da reta fundo–marca até o qual o pixel é mistura dos dois. */
const DESVIO_DA_RETA = 45;
/** Cor neutra (diferença entre o maior e o menor canal) e clara: é a marca branca, que imprime na cor do fundo. */
const NEUTRA = 40;
const CLARA = 170;

const somaDosCanais = (a: Cor, r: number, g: number, b: number) => Math.abs(a.r - r) + Math.abs(a.g - g) + Math.abs(a.b - b);
const luma = (c: Cor) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[ordenados.length >> 1] ?? 0;
}

/** A cor do fundo pela faixa da borda, ou null quando a borda não tem uma cor só. */
function corDaBorda(rgba: Uint8ClampedArray, largura: number, altura: number): Cor | null {
  const faixa = Math.max(1, Math.round(Math.min(largura, altura) * FRACAO_DA_FAIXA));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  let transparentes = 0;
  let total = 0;
  for (let y = 0; y < altura; y++) {
    const naFaixaY = y < faixa || y >= altura - faixa;
    for (let x = 0; x < largura; x++) {
      if (!naFaixaY && x >= faixa && x < largura - faixa) {
        x = largura - faixa - 1;
        continue;
      }
      const i = (y * largura + x) * 4;
      total++;
      if (rgba[i + 3] < ALFA_SOLIDO) {
        transparentes++;
        continue;
      }
      rs.push(rgba[i]);
      gs.push(rgba[i + 1]);
      bs.push(rgba[i + 2]);
    }
  }
  if (total === 0 || rs.length === 0 || transparentes > total * FRACAO_TRANSPARENTE) return null;
  const meio = { r: mediana(rs), g: mediana(gs), b: mediana(bs) };
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let k = 0; k < rs.length; k++) {
    if (somaDosCanais(meio, rs[k], gs[k], bs[k]) > PERTO_DO_FUNDO) continue;
    r += rs[k];
    g += gs[k];
    b += bs[k];
    n++;
  }
  if (n < rs.length * FRACAO_FUNDO_NA_BORDA) return null;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function continuaParaDentro(rgba: Uint8ClampedArray, largura: number, altura: number, fundo: Cor): boolean {
  const recuo = Math.round(Math.min(largura, altura) * ANEL_INTERNO);
  if (recuo < 1 || largura <= 2 * recuo || altura <= 2 * recuo) return false;
  let doFundo = 0;
  let total = 0;
  const contar = (x: number, y: number) => {
    const i = (y * largura + x) * 4;
    total++;
    if (somaDosCanais(fundo, rgba[i], rgba[i + 1], rgba[i + 2]) <= PERTO_DO_FUNDO) doFundo++;
  };
  for (let x = recuo; x < largura - recuo; x++) {
    contar(x, recuo);
    contar(x, altura - recuo - 1);
  }
  for (let y = recuo; y < altura - recuo; y++) {
    contar(recuo, y);
    contar(largura - recuo - 1, y);
  }
  return doFundo >= total * FRACAO_NO_ANEL;
}

/** k-means determinístico (parte da cor mais longe do fundo), das cores chapadas da marca. */
function coresDaMarca(amostras: number[], rgba: Uint8ClampedArray, fundo: Cor): Cor[] {
  const corEm = (i: number): Cor => ({ r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] });
  const longe = (i: number, c: Cor) => somaDosCanais(c, rgba[i], rgba[i + 1], rgba[i + 2]);
  const centros: Cor[] = [corEm(amostras.reduce((a, b) => (longe(b, fundo) > longe(a, fundo) ? b : a)))];
  while (centros.length < GRUPOS_DE_MARCA) {
    const proxima = amostras.reduce((a, b) => (Math.min(...centros.map((c) => longe(b, c))) > Math.min(...centros.map((c) => longe(a, c))) ? b : a));
    if (Math.min(...centros.map((c) => longe(proxima, c))) < MESMA_MARCA) break;
    centros.push(corEm(proxima));
  }
  let cores = centros;
  let contagem: number[] = [];
  for (let ciclo = 0; ciclo < CICLOS; ciclo++) {
    const soma = cores.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (const i of amostras) {
      let melhor = 0;
      for (let k = 1; k < cores.length; k++) if (longe(i, cores[k]) < longe(i, cores[melhor])) melhor = k;
      soma[melhor].r += rgba[i];
      soma[melhor].g += rgba[i + 1];
      soma[melhor].b += rgba[i + 2];
      soma[melhor].n++;
    }
    cores = soma.map((s, k) => (s.n ? { r: Math.round(s.r / s.n), g: Math.round(s.g / s.n), b: Math.round(s.b / s.n) } : cores[k]));
    contagem = soma.map((s) => s.n);
  }
  const juntas: { cor: Cor; n: number }[] = [];
  for (const [k, cor] of cores.entries()) {
    if (contagem[k] < amostras.length * FRACAO_DA_MARCA) continue;
    const igual = juntas.find((j) => somaDosCanais(j.cor, cor.r, cor.g, cor.b) < MESMA_MARCA);
    if (igual) igual.n += contagem[k];
    else juntas.push({ cor, n: contagem[k] });
  }
  return juntas.map((j) => j.cor);
}

/** Onde o pixel cai na reta do fundo até a marca (0 = fundo, 1 = marca) e a que distância dela. */
function naRetaDaMarca(r: number, g: number, b: number, fundo: Cor, marca: Cor) {
  const vr = marca.r - fundo.r;
  const vg = marca.g - fundo.g;
  const vb = marca.b - fundo.b;
  const pr = r - fundo.r;
  const pg = g - fundo.g;
  const pb = b - fundo.b;
  const t = (pr * vr + pg * vg + pb * vb) / Math.max(1, vr * vr + vg * vg + vb * vb);
  return { t, desvio: Math.hypot(pr - t * vr, pg - t * vg, pb - t * vb) };
}

/** A tinta que a marca imprime: a marca branca sai na cor do fundo (a fita é película, e a marca é o que aparece). */
function tintaDaMarca(marca: Cor, fundo: Cor): Cor {
  const neutra = Math.max(marca.r, marca.g, marca.b) - Math.min(marca.r, marca.g, marca.b) <= NEUTRA;
  return neutra && Math.min(marca.r, marca.g, marca.b) >= CLARA ? fundo : marca;
}

/**
 * O papel da arte cortada, pela cor dominante da imagem. O corte pode cair dentro da moldura, e aí a borda
 * é o filete, não o papel. Null quando a cor dominante não é clara ou não domina.
 */
function papelDaArteCortada(rgba: Uint8ClampedArray, largura: number, altura: number): Cor | null {
  const total = largura * altura;
  const passo = Math.max(1, Math.ceil(total / 60_000));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let p = 0; p < total; p += passo) {
    const i = p * 4;
    if (rgba[i + 3] < ALFA_SOLIDO) continue;
    rs.push(rgba[i]);
    gs.push(rgba[i + 1]);
    bs.push(rgba[i + 2]);
  }
  const meio = { r: mediana(rs), g: mediana(gs), b: mediana(bs) };
  if (Math.min(meio.r, meio.g, meio.b) < PAPEL_CLARO) return null;
  let perto = 0;
  for (let k = 0; k < rs.length; k++) if (somaDosCanais(meio, rs[k], gs[k], bs[k]) <= PERTO_DO_FUNDO) perto++;
  return perto >= rs.length * FRACAO_FUNDO_NA_IMAGEM ? meio : null;
}

/** A receita para tirar o fundo da arte, ou null quando não há o que tirar (logo recortada, fundo branco, foto). */
export function lerFundo(rgba: Uint8ClampedArray, largura: number, altura: number, { cortada = false }: { cortada?: boolean } = {}): ReceitaDoFundo | null {
  const papel = cortada ? papelDaArteCortada(rgba, largura, altura) : null;
  const fundo = papel ?? corDaBorda(rgba, largura, altura);
  if (!fundo || Math.min(fundo.r, fundo.g, fundo.b) >= BRANCO_DO_MOTOR) return null;

  const total = largura * altura;
  const passo = Math.max(1, Math.ceil(total / 60_000));
  let lidos = 0;
  let doFundo = 0;
  let somaLuma = 0;
  const tinta: number[] = [];
  for (let p = 0; p < total; p += passo) {
    const i = p * 4;
    if (rgba[i + 3] < ALFA_SOLIDO) continue;
    lidos++;
    const d = somaDosCanais(fundo, rgba[i], rgba[i + 1], rgba[i + 2]);
    if (d <= PERTO_DO_FUNDO) {
      doFundo++;
      continue;
    }
    somaLuma += luma({ r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] });
    if (d >= LONGE_DO_FUNDO) tinta.push(i);
  }
  const fora = lidos - doFundo;
  if (lidos === 0 || doFundo < lidos * FRACAO_FUNDO_NA_IMAGEM || fora < lidos * TINTA_MINIMA) return null;

  // Papel claro com desenho mais escuro que ele: o papel some, e o desenho segue como é.
  if (Math.min(fundo.r, fundo.g, fundo.b) >= PAPEL_CLARO && somaLuma / fora <= luma(fundo)) return { tipo: "papel", fundo };
  if (tinta.length === 0 || doFundo < lidos * FRACAO_FUNDO_DE_COR || !continuaParaDentro(rgba, largura, altura, fundo)) return null;

  const cores = coresDaMarca(tinta, rgba, fundo);
  if (cores.length === 0) return null;
  const plano = (p: number) => {
    const x = p % largura;
    const y = (p - x) / largura;
    if (x < RAIO_PLANO || y < RAIO_PLANO || x >= largura - RAIO_PLANO || y >= altura - RAIO_PLANO) return false;
    const i = p * 4;
    for (const q of [p - RAIO_PLANO, p + RAIO_PLANO, p - RAIO_PLANO * largura, p + RAIO_PLANO * largura]) {
      const j = q * 4;
      if (Math.abs(rgba[i] - rgba[j]) + Math.abs(rgba[i + 1] - rgba[j + 1]) + Math.abs(rgba[i + 2] - rgba[j + 2]) > VARIACAO_PLANA) return false;
    }
    return true;
  };
  let degrade = 0;
  const dispersao = cores.map(() => ({ soma: 0, n: 0 }));
  for (let p = 0; p < total; p += passo) {
    const i = p * 4;
    if (rgba[i + 3] < ALFA_SOLIDO || somaDosCanais(fundo, rgba[i], rgba[i + 1], rgba[i + 2]) <= PERTO_DO_FUNDO) continue;
    let menor = Infinity;
    let t = 0;
    for (const marca of cores) {
      const na = naRetaDaMarca(rgba[i], rgba[i + 1], rgba[i + 2], fundo, marca);
      if (na.desvio < menor) {
        menor = na.desvio;
        t = na.t;
      }
    }
    if (!plano(p)) continue;
    if (menor > DESVIO_DA_RETA || t < 0.8) degrade++;
    else {
      let k = 0;
      for (let j = 1; j < cores.length; j++) if (somaDosCanais(cores[j], rgba[i], rgba[i + 1], rgba[i + 2]) < somaDosCanais(cores[k], rgba[i], rgba[i + 1], rgba[i + 2])) k = j;
      dispersao[k].soma += somaDosCanais(cores[k], rgba[i], rgba[i + 1], rgba[i + 2]);
      dispersao[k].n++;
    }
  }
  if (degrade > fora * FRACAO_DEGRADE || dispersao.some((d) => d.n > 0 && d.soma / d.n > DISPERSAO_DEGRADE)) return null;
  return { tipo: "marcas", fundo, marcas: cores.map((cor) => ({ cor, sai: tintaDaMarca(cor, fundo) })) };
}

/** Reescreve a arte sobre fundo branco, no lugar, em qualquer tamanho. */
export function aplicarReceita(rgba: Uint8ClampedArray, receita: ReceitaDoFundo): void {
  const { fundo } = receita;
  if (receita.tipo === "papel") {
    const fr = 255 / Math.max(1, fundo.r);
    const fg = 255 / Math.max(1, fundo.g);
    const fb = 255 / Math.max(1, fundo.b);
    for (let i = 0; i < rgba.length; i += 4) {
      // Uint8ClampedArray corta em 255: o que é mais claro que o papel também vira branco.
      rgba[i] = rgba[i] * fr;
      rgba[i + 1] = rgba[i + 1] * fg;
      rgba[i + 2] = rgba[i + 2] * fb;
    }
    return;
  }
  const { marcas } = receita;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    let melhor = marcas[0];
    let menor = Infinity;
    let t = 0;
    for (const marca of marcas) {
      const na = naRetaDaMarca(r, g, b, fundo, marca.cor);
      if (na.desvio < menor) {
        menor = na.desvio;
        melhor = marca;
        t = na.t;
      }
    }
    const cobre = Math.min(1, Math.max(0, t));
    rgba[i] = 255 + (melhor.sai.r - 255) * cobre;
    rgba[i + 1] = 255 + (melhor.sai.g - 255) * cobre;
    rgba[i + 2] = 255 + (melhor.sai.b - 255) * cobre;
  }
}

export interface LeituraDaArte {
  /** A caixa onde cortar, sem margem e sem moldura. */
  caixa: CaixaDaTinta;
  fundoBranco: boolean;
  /** Aplicar nos pixels do recorte (ver aplicarLeitura), já no tamanho do traçado. */
  receita: ReceitaDoFundo | null;
  /**
   * A moldura cortada sai do cálculo da caixa, mas os cantos arredondados dela entram na caixa, onde o corte não
   * alcança. Máscara do tamanho da caixa (1 = apagar), pixel a pixel: um retângulo comeria a voluta do lado.
   */
  apagar: Uint8Array | null;
}

/** Aplica a leitura nos pixels do recorte, em qualquer tamanho. */
export function aplicarLeitura(rgba: Uint8ClampedArray, largura: number, altura: number, { receita, apagar, fundoBranco, caixa }: LeituraDaArte): void {
  if (receita) aplicarReceita(rgba, receita);
  if (!apagar || !fundoBranco) return;
  for (let y = 0; y < altura; y++) {
    const my = Math.min(caixa.h - 1, Math.floor((y / altura) * caixa.h));
    for (let x = 0; x < largura; x++) {
      const mx = Math.min(caixa.w - 1, Math.floor((x / largura) * caixa.w));
      if (apagar[my * caixa.w + mx]) rgba.fill(255, (y * largura + x) * 4, (y * largura + x) * 4 + 4);
    }
  }
}

/** A máscara das sobras da moldura dentro da caixa, com folga de FOLGA_DA_MASCARA para levar a borda suavizada junto. */
function mascaraDasSobras(sobras: Int32Array[], largura: number, caixa: CaixaDaTinta): Uint8Array | null {
  let alguma = false;
  const mascara = new Uint8Array(caixa.w * caixa.h);
  for (const pontos of sobras) {
    for (const p of pontos) {
      const px = p % largura;
      const py = (p - px) / largura;
      for (let dy = -FOLGA_DA_MASCARA; dy <= FOLGA_DA_MASCARA; dy++) {
        for (let dx = -FOLGA_DA_MASCARA; dx <= FOLGA_DA_MASCARA; dx++) {
          const x = px + dx - caixa.x;
          const y = py + dy - caixa.y;
          if (x < 0 || y < 0 || x >= caixa.w || y >= caixa.h) continue;
          mascara[y * caixa.w + x] = 1;
          alguma = true;
        }
      }
    }
  }
  return alguma ? mascara : null;
}

/**
 * Tudo o que se lê da arte antes de cortar. `pixels` é a cópia reduzida da análise (não é alterada).
 * Lê duas vezes: arte com margem branca (print da logo num bloco de cor) só mostra o fundo depois do corte.
 */
export function lerArte(pixels: Uint8ClampedArray, largura: number, altura: number, { cortada = false }: { cortada?: boolean } = {}): LeituraDaArte | null {
  let receita = lerFundo(pixels, largura, altura, { cortada });
  const limpa = new Uint8ClampedArray(pixels);
  if (receita) aplicarReceita(limpa, receita);
  // Arte cortada em papel branco: o filete da moldura na borda não muda o fundo.
  const papelBranco = cortada && !receita && papelDaArteCortada(pixels, largura, altura) !== null;
  const fundoBranco = receita || papelBranco ? true : temFundoBranco(limpa, largura, altura);
  let caixa = caixaDaTinta(limpa, largura, altura);
  if (!caixa) return null;
  if (!receita && fundoBranco && !cortada) {
    const recuo = Math.round(Math.min(caixa.w, caixa.h) * RECUO_DA_SEGUNDA);
    const miolo = { x: caixa.x + recuo, y: caixa.y + recuo, w: caixa.w - 2 * recuo, h: caixa.h - 2 * recuo };
    const dentro = miolo.w > 0 && miolo.h > 0 ? lerFundo(cortar(limpa, largura, miolo), miolo.w, miolo.h) : null;
    if (dentro) {
      receita = dentro;
      limpa.set(pixels);
      aplicarReceita(limpa, receita);
      const achada = caixaDaTinta(limpa, largura, altura);
      if (!achada) return null;
      caixa = achada;
    }
  }
  // O mesmo corte do motor (LONGE_DO_BRANCO em duasTintas.ts): o creme perto do branco é película, e não cola as peças numa mancha só.
  const ehTinta = (p: number) => limpa[p * 4 + 3] >= 128 && (!fundoBranco || 255 * 3 - limpa[p * 4] - limpa[p * 4 + 1] - limpa[p * 4 + 2] > LONGE_DO_BRANCO);
  // Sem fundo branco nem transparência, tudo é tinta: não há o que ler.
  const sobras: Int32Array[] = [];
  if (fundoBranco || caixa.w < largura || caixa.h < altura) caixa = caixaSemMoldura(caixa, largura, altura, ehTinta, cortada || receita !== null, sobras);
  const apagar = mascaraDasSobras(sobras, largura, caixa);
  return { caixa, fundoBranco, receita, apagar };
}

export function cortar(rgba: Uint8ClampedArray, largura: number, { x, y, w, h }: CaixaDaTinta): Uint8ClampedArray {
  const saida = new Uint8ClampedArray(w * h * 4);
  for (let linha = 0; linha < h; linha++) saida.set(rgba.subarray((y + linha) * largura * 4 + x * 4, (y + linha) * largura * 4 + (x + w) * 4), linha * w * 4);
  return saida;
}

/** Moldura ocupa quase toda a caixa da tinta. */
const MOLDURA_NA_CAIXA = 0.9;
/** A faixa das bordas da moldura: esta fração do menor lado dela. */
const FAIXA_DA_MOLDURA = 0.06;
/** Quase toda a tinta da moldura está nessa faixa, e ela cobre cada um dos 4 lados (o anel redondo do selo não cobre). */
const TINTA_NA_FAIXA = 0.9;
const LADO_COBERTO = 0.7;
/** Só sai a moldura longe do miolo: com o miolo em menos que isto dela nos dois sentidos. Moldura colada no nome é parte da marca. */
const MIOLO_DA_MOLDURA = 0.8;
/** Mancha menor que esta fração da tinta não conta como miolo: é ruído. */
const MANCHA_MINIMA = 0.0005;
const MOLDURAS_MAX = 3;
const LONGE_DO_BRANCO = 90;
/**
 * Arte recortada à mão ou pelo Claude: sobra um pedaço da moldura na beira. É sobra a mancha que encosta
 * na beira, cobre esta fração de um lado e tem quase toda a tinta na faixa da beira (FAIXA_DA_SOBRA do menor
 * lado da imagem); e a pontinha num canto.
 */
const FILETE_NO_LADO = 0.4;
const FAIXA_DA_SOBRA = 0.05;
const PONTA_NO_CANTO = 0.06;
const FOLGA_DA_MASCARA = 2;

interface Mancha {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  n: number;
  /** Índices dos pixels. */
  pontos: Int32Array;
}

/** As manchas de tinta (8-vizinhança) dentro da caixa. */
function manchasDaCaixa(tinta: Uint8Array, largura: number, caixa: CaixaDaTinta): Mancha[] {
  const manchas: Mancha[] = [];
  const visto = new Uint8Array(tinta.length);
  const fila = new Int32Array(tinta.length);
  const altura = tinta.length / largura;
  for (let y = caixa.y; y < caixa.y + caixa.h; y++) {
    for (let x = caixa.x; x < caixa.x + caixa.w; x++) {
      const semente = y * largura + x;
      if (!tinta[semente] || visto[semente]) continue;
      let inicio = 0;
      let fim = 0;
      fila[fim++] = semente;
      visto[semente] = 1;
      const m: Mancha = { x0: x, y0: y, x1: x, y1: y, n: 0, pontos: new Int32Array(0) };
      while (inicio < fim) {
        const p = fila[inicio++];
        const px = p % largura;
        const py = (p - px) / largura;
        if (px < m.x0) m.x0 = px;
        if (px > m.x1) m.x1 = px;
        if (py < m.y0) m.y0 = py;
        if (py > m.y1) m.y1 = py;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const vx = px + dx;
            const vy = py + dy;
            if (vx < 0 || vy < 0 || vx >= largura || vy >= altura) continue;
            const q = vy * largura + vx;
            if (tinta[q] && !visto[q]) {
              visto[q] = 1;
              fila[fim++] = q;
            }
          }
        }
      }
      m.n = fim;
      m.pontos = fila.slice(0, fim);
      manchas.push(m);
    }
  }
  return manchas;
}

/** A mancha é um retângulo vazado, com a tinta só nas 4 bordas. */
function ehMoldura(m: Mancha, largura: number, caixa: CaixaDaTinta): boolean {
  const w = m.x1 - m.x0 + 1;
  const h = m.y1 - m.y0 + 1;
  if (w < caixa.w * MOLDURA_NA_CAIXA || h < caixa.h * MOLDURA_NA_CAIXA) return false;
  const faixa = Math.max(2, Math.round(Math.min(w, h) * FAIXA_DA_MOLDURA));
  const cima = new Uint8Array(w);
  const baixo = new Uint8Array(w);
  const esquerda = new Uint8Array(h);
  const direita = new Uint8Array(h);
  let naFaixa = 0;
  for (const p of m.pontos) {
    const px = p % largura;
    const x = px - m.x0;
    const y = (p - px) / largura - m.y0;
    const emCima = y < faixa;
    const embaixo = y >= h - faixa;
    const naEsquerda = x < faixa;
    const naDireita = x >= w - faixa;
    if (emCima) cima[x] = 1;
    if (embaixo) baixo[x] = 1;
    if (naEsquerda) esquerda[y] = 1;
    if (naDireita) direita[y] = 1;
    if (emCima || embaixo || naEsquerda || naDireita) naFaixa++;
  }
  if (naFaixa < m.n * TINTA_NA_FAIXA) return false;
  const coberto = (lado: Uint8Array) => lado.reduce((s, v) => s + v, 0) >= lado.length * LADO_COBERTO;
  return coberto(cima) && coberto(baixo) && coberto(esquerda) && coberto(direita);
}

/** Ver FILETE_NO_LADO. */
function ehSobraDaMoldura(m: Mancha, largura: number, altura: number): boolean {
  const w = m.x1 - m.x0 + 1;
  const h = m.y1 - m.y0 + 1;
  const emCimaOuEmbaixo = m.y0 === 0 || m.y1 === altura - 1;
  const nosLados = m.x0 === 0 || m.x1 === largura - 1;
  // A pontinha, inteira no canto: a voluta da moldura nem sempre encosta na beira.
  const noCantoX = m.x1 < largura * PONTA_NO_CANTO || m.x0 >= largura * (1 - PONTA_NO_CANTO);
  const noCantoY = m.y1 < altura * PONTA_NO_CANTO || m.y0 >= altura * (1 - PONTA_NO_CANTO);
  if (noCantoX && noCantoY) return true;
  if (!emCimaOuEmbaixo && !nosLados) return false;
  if (w < largura * FILETE_NO_LADO && h < altura * FILETE_NO_LADO) return false;
  const faixa = Math.max(2, Math.round(Math.min(largura, altura) * FAIXA_DA_SOBRA));
  let naFaixa = 0;
  for (const p of m.pontos) {
    const x = p % largura;
    const y = (p - x) / largura;
    if (x < faixa || y < faixa || x >= largura - faixa || y >= altura - faixa) naFaixa++;
  }
  return naFaixa >= m.n * TINTA_NA_FAIXA;
}

/**
 * A caixa sem a moldura retangular decorativa em volta da marca (o cartão com filete da logo da
 * Logística, que ocupa a altura da fita e deixa a marca pequena). `ehTinta` diz se o pixel tem tinta.
 * Moldura colada no miolo fica: ali ela é parte da marca (ver MIOLO_DA_MOLDURA).
 */
export function caixaSemMoldura(
  caixa: CaixaDaTinta,
  largura: number,
  altura: number,
  ehTinta: (p: number) => boolean,
  cortada = false,
  sobras: Int32Array[] = [],
): CaixaDaTinta {
  const tinta = new Uint8Array(largura * altura);
  for (let y = caixa.y; y < caixa.y + caixa.h; y++) for (let x = caixa.x; x < caixa.x + caixa.w; x++) if (ehTinta(y * largura + x)) tinta[y * largura + x] = 1;
  let atual = caixa;
  if (cortada) {
    const manchas = manchasDaCaixa(tinta, largura, atual);
    const restantes = manchas.filter((m) => !ehSobraDaMoldura(m, largura, altura));
    if (restantes.length > 0 && restantes.length < manchas.length) {
      for (const m of manchas) if (!restantes.includes(m)) sobras.push(m.pontos);
      const x0 = Math.min(...restantes.map((m) => m.x0));
      const y0 = Math.min(...restantes.map((m) => m.y0));
      atual = { x: x0, y: y0, w: Math.max(...restantes.map((m) => m.x1)) - x0 + 1, h: Math.max(...restantes.map((m) => m.y1)) - y0 + 1 };
    }
  }
  for (let vez = 0; vez < MOLDURAS_MAX; vez++) {
    const manchas = manchasDaCaixa(tinta, largura, atual);
    const moldura = manchas.find((m) => ehMoldura(m, largura, atual));
    if (!moldura) break;
    const totalDeTinta = manchas.reduce((s, m) => s + m.n, 0);
    const miolo = manchas.filter((m) => m !== moldura && m.n >= totalDeTinta * MANCHA_MINIMA);
    if (miolo.length === 0) break;
    const x0 = Math.min(...miolo.map((m) => m.x0));
    const y0 = Math.min(...miolo.map((m) => m.y0));
    const x1 = Math.max(...miolo.map((m) => m.x1));
    const y1 = Math.max(...miolo.map((m) => m.y1));
    if (x1 - x0 + 1 > (moldura.x1 - moldura.x0 + 1) * MIOLO_DA_MOLDURA || y1 - y0 + 1 > (moldura.y1 - moldura.y0 + 1) * MIOLO_DA_MOLDURA) break;
    for (const p of moldura.pontos) tinta[p] = 0;
    atual = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  return atual;
}

/** Caixa da marca dentro da arte, em fração da largura e da altura. */
export interface CaixaEmFracao {
  esquerda: number;
  topo: number;
  direita: number;
  base: number;
}

/** O vão é procurado até esta fração do lado, para dentro e para fora da caixa pedida. */
const JANELA_DO_VAO = 0.07;
/** Tinta (soma dos 3 canais) em relação à cor mais comum da caixa. */
const LONGE_DO_PAPEL = 90;
/** Coluna com até esta fração de tinta ainda é vão (ruído de JPG, uma ponta de letra). */
const FOLGA_DO_VAO = 0.004;
/** Linha (ou coluna) com mais tinta que esta fração é reta: a moldura ou um filete. */
const RETA_LONGA = 0.6;

/**
 * Encaixa a caixa que o Claude deu (precisa só até uns 3%) no vão de verdade da arte, para o corte não
 * pegar meia letra da tabela nem comer a ponta do desenho. `pixels` é a cópia reduzida da análise.
 */
export function encaixarNoVao(pixels: Uint8ClampedArray, largura: number, altura: number, pedida: CaixaEmFracao): CaixaDaTinta {
  const limitar = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v)));
  const x0 = limitar(pedida.esquerda * largura, largura - 1);
  const x1 = limitar(pedida.direita * largura, largura);
  const y0 = limitar(pedida.topo * altura, altura - 1);
  const y1 = limitar(pedida.base * altura, altura);

  // O papel é a cor mais comum na beira da caixa pedida: no miolo, um desenho cheio ganharia dele.
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const guardar = (x: number, y: number) => {
    const i = (y * largura + x) * 4;
    rs.push(pixels[i]);
    gs.push(pixels[i + 1]);
    bs.push(pixels[i + 2]);
  };
  for (let x = x0; x < x1; x++) {
    guardar(x, y0);
    guardar(x, Math.max(y0, y1 - 1));
  }
  for (let y = y0; y < y1; y++) {
    guardar(x0, y);
    guardar(Math.max(x0, x1 - 1), y);
  }
  const papel = { r: mediana(rs), g: mediana(gs), b: mediana(bs) };
  // Primeiro as retas longas (a moldura, um filete): elas cruzam todo vão e não contam.
  const tintaNaLinha = new Int32Array(altura);
  const tintaNaColuna = new Int32Array(largura);
  const ehTinta = (i: number) => pixels[i + 3] >= ALFA_SOLIDO && somaDosCanais(papel, pixels[i], pixels[i + 1], pixels[i + 2]) > LONGE_DO_PAPEL;
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      if (!ehTinta((y * largura + x) * 4)) continue;
      tintaNaLinha[y]++;
      tintaNaColuna[x]++;
    }
  }
  const colunas = new Int32Array(largura);
  const linhas = new Int32Array(altura);
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      if (!ehTinta((y * largura + x) * 4)) continue;
      if (tintaNaLinha[y] <= largura * RETA_LONGA) colunas[x]++;
      if (tintaNaColuna[x] <= altura * RETA_LONGA) linhas[y]++;
    }
  }
  // O vão mais perto indo para dentro da caixa (fica dentro da moldura); sem vão ali, para fora.
  const noVao = (contagem: Int32Array, pedido: number, janela: number, paraDentro: 1 | -1) => {
    const folga = (contagem.length === largura ? altura : largura) * FOLGA_DO_VAO;
    for (const sentido of [paraDentro, -paraDentro]) {
      for (let k = pedido, passos = 0; k >= 0 && k < contagem.length && passos <= janela; k += sentido, passos++) {
        if (contagem[k] <= folga) return k;
      }
    }
    return pedido;
  };
  const janelaX = Math.max(2, Math.round(largura * JANELA_DO_VAO));
  const janelaY = Math.max(2, Math.round(altura * JANELA_DO_VAO));
  const esquerda = noVao(colunas, x0, janelaX, 1);
  const direita = noVao(colunas, Math.min(x1, largura - 1), janelaX, -1);
  const topo = noVao(linhas, y0, janelaY, 1);
  const base = noVao(linhas, Math.min(y1, altura - 1), janelaY, -1);
  return { x: esquerda, y: topo, w: Math.max(1, direita - esquerda + 1), h: Math.max(1, base - topo + 1) };
}
