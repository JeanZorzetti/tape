/**
 * Logos sintéticas com verdade conhecida, para medir a vetorização da prévia da fita (ver medir.mjs).
 * Cada uma é um SVG desenhado com fontes do sistema (Nimbus Sans, URW Gothic/Bookman, C059, Z003,
 * Liberation): `bg` é o fundo (null = transparente; `full` = fundo de cor que é parte da marca).
 *
 * As chapadas (as 9 primeiras) são a própria verdade. As outras chegam como a arte de verdade chega
 * (cromado de gerador de IA, recorte do iPhone com o fundo preto preso, sombra projetada) e trazem
 * em `verdade` a saída desejada em 2 tintas, como o designer da TapePro refaz: cromado em preto
 * 30,30,30 e o degradê de um matiz no tom mais vivo dele (layout da Maxmed, 14/10/2026).
 */
const T = (x, y, s, fam, w, fill, txt, extra = "") =>
  `<text x="${x}" y="${y}" font-family="${fam}" font-size="${s}" font-weight="${w}" fill="${fill}" ${extra}>${txt}</text>`;

const CROMO = `<linearGradient id="cromo" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#f4f5f7"/><stop offset="0.42" stop-color="#b9bcc2"/><stop offset="0.5" stop-color="#3a3c40"/>
  <stop offset="0.6" stop-color="#d9dbe0"/><stop offset="1" stop-color="#6d7076"/></linearGradient>`;
const AZUL = `<linearGradient id="azul" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b3d91"/><stop offset="1" stop-color="#12a6f2"/></linearGradient>`;
/** O X: duas faixas cruzadas entre as letras. */
const X = (fill) => `<g transform="translate(470 150)"><rect x="-26" y="-120" width="52" height="240" rx="10" transform="rotate(32)" fill="${fill}"/>
  <rect x="-26" y="-120" width="52" height="240" rx="10" transform="rotate(-32)" fill="${fill}"/></g>`;
const LETRAS = (fill) => `${T(40, 210, 170, "Nimbus Sans", 700, fill, "MA", 'letter-spacing="4"')}${T(560, 210, 170, "Nimbus Sans", 700, fill, "MED", 'letter-spacing="4"')}`;
const PRETO_DO_LAYOUT = "#1e1e1e";
const AZUL_VIVO = "#12a6f2";

export const LOGOS = {
  navyOrange: {
    w: 900, h: 300, bg: "#fff",
    body: `${T(40, 170, 150, "Nimbus Sans", 700, "#1b2a6b", "TAPE", 'letter-spacing="-3"')}${T(440, 170, 150, "Nimbus Sans", 700, "#f26a1b", "PRO", 'letter-spacing="-3"')}
      ${T(46, 235, 34, "Nimbus Sans", 400, "#1b2a6b", "FITAS PERSONALIZADAS", 'letter-spacing="9"')}`,
  },
  cinzaDegrade: {
    w: 1000, h: 320, bg: "#fff",
    defs: `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1664c0"/><stop offset="1" stop-color="#1fa37a"/></linearGradient>`,
    body: `<path d="M60 220 C60 90 190 40 270 90 C190 90 140 150 150 230 Z" fill="url(#g)"/><circle cx="215" cy="215" r="55" fill="url(#g)"/>
      ${T(340, 190, 118, "Liberation Sans", 700, "#6a6a70", "nuvem")}${T(344, 250, 38, "Liberation Sans", 400, "#8b8b92", "DISTRIBUIDORA", 'letter-spacing="6"')}`,
  },
  selo: {
    w: 520, h: 520, bg: "#fff",
    body: `<circle cx="260" cy="260" r="240" fill="#c8102e"/><circle cx="260" cy="260" r="212" fill="none" stroke="#fff" stroke-width="6"/>
      ${T(260, 245, 96, "URW Gothic", 700, "#fff", "BRAVO", 'text-anchor="middle"')}${T(260, 320, 38, "URW Gothic", 400, "#fff", "CAFÉ ESPECIAL", 'text-anchor="middle" letter-spacing="5"')}
      <path d="M140 370 H380" stroke="#fff" stroke-width="4"/>${T(260, 415, 30, "URW Gothic", 400, "#fff", "DESDE 1987", 'text-anchor="middle" letter-spacing="6"')}`,
  },
  serifaFina: {
    w: 1100, h: 280, bg: "#fff",
    body: `${T(40, 140, 120, "C059", 400, "#111", "Estúdio Aurora", 'font-style="italic"')}${T(48, 215, 30, "Liberation Sans", 400, "#111", "ARQUITETURA &amp; INTERIORES", 'letter-spacing="14"')}
      <path d="M48 175 H1040" stroke="#111" stroke-width="2"/>`,
  },
  folha: {
    w: 900, h: 300, bg: "#fff",
    body: `<path d="M120 250 C40 190 60 70 220 40 C250 120 220 220 120 250 Z" fill="#2e8b3d"/><path d="M120 250 C140 180 170 120 215 62" stroke="#fff" stroke-width="7" fill="none"/>
      ${T(280, 170, 130, "URW Bookman", 700, "#17512a", "Nature’s")}${T(286, 232, 36, "URW Bookman", 400, "#17512a", "Produtos naturais", 'letter-spacing="3"')}`,
  },
  monograma: {
    w: 480, h: 480, bg: "#fff",
    body: `<circle cx="240" cy="240" r="218" fill="none" stroke="#6b4a1e" stroke-width="5"/><circle cx="240" cy="240" r="198" fill="none" stroke="#6b4a1e" stroke-width="2"/>
      ${T(240, 300, 210, "Z003", 400, "#6b4a1e", "Lm", 'text-anchor="middle"')}${T(240, 90, 28, "Liberation Sans", 400, "#6b4a1e", "LYON MÓVEIS", 'text-anchor="middle" letter-spacing="7"')}
      <path d="M140 400 H340" stroke="#6b4a1e" stroke-width="2"/>`,
  },
  fundoEscuro: {
    w: 800, h: 280, bg: "#14234f", full: true,
    body: `${T(60, 150, 120, "Nimbus Sans", 700, "#ffffff", "QUEMED")}<circle cx="700" cy="140" r="58" fill="#ffc400"/>${T(60, 220, 34, "Nimbus Sans", 400, "#ffffff", "farmácia de manipulação", 'letter-spacing="3"')}`,
  },
  transparente: {
    w: 800, h: 240, bg: null,
    body: `${T(30, 150, 140, "Liberation Sans", 700, "#232c7a", "Halyee")}<rect x="32" y="185" width="520" height="12" fill="#e8472f"/>`,
  },
  tresTintas: {
    w: 900, h: 300, bg: "#fff",
    body: `<rect x="40" y="60" width="150" height="150" rx="26" fill="#0f7b6c"/><circle cx="115" cy="135" r="46" fill="#ffd23f"/><path d="M80 135 H150" stroke="#e4572e" stroke-width="12"/>
      ${T(230, 150, 112, "URW Gothic", 700, "#0f7b6c", "Yanmei")}${T(236, 210, 34, "URW Gothic", 400, "#e4572e", "COMÉRCIO &amp; IMPORTAÇÃO", 'letter-spacing="5"')}`,
  },
  cromadoRecorte: {
    w: 1000, h: 300, bg: null,
    defs: CROMO + AZUL,
    // O recorte do iPhone: o fundo de fora some, o preto entre as letras fica opaco.
    body: `<rect x="40" y="88" width="910" height="124" rx="8" fill="#03070f"/>${LETRAS("url(#cromo)")}${X("url(#azul)")}`,
    verdade: `${LETRAS(PRETO_DO_LAYOUT)}${X(AZUL_VIVO)}`,
  },
  cromadoNoPreto: {
    w: 1000, h: 300, bg: "#000", full: true,
    defs: CROMO + AZUL,
    body: `${LETRAS("url(#cromo)")}${X("url(#azul)")}`,
    verdade: `<rect width="1000" height="300" fill="#fff"/>${LETRAS(PRETO_DO_LAYOUT)}${X(AZUL_VIVO)}`,
  },
  sombra: {
    w: 900, h: 280, bg: "#fff",
    defs: `<filter id="borra" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>`,
    body: `<g filter="url(#borra)">${T(52, 190, 150, "URW Gothic", 700, "#9a9aa0", "NORTE")}</g>${T(40, 176, 150, "URW Gothic", 700, "#1b2a6b", "NORTE")}`,
    verdade: `<rect width="900" height="280" fill="#fff"/>${T(40, 176, 150, "URW Gothic", 700, "#1b2a6b", "NORTE")}`,
  },
};

/** O SVG da logo em `esc` pixels por unidade; `corpo` troca o desenho (a verdade sai sem o fundo da entrada). */
export const svgDe = (l, esc = 1, corpo = l.body) => {
  const W = Math.round(l.w * esc);
  const H = Math.round(l.h * esc);
  const fundo = l.bg && corpo === l.body ? `<rect width="${l.w}" height="${l.h}" fill="${l.bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${l.w} ${l.h}"><defs>${l.defs ?? ""}</defs>${fundo}${corpo}</svg>`;
};
