/**
 * Separação da logo anexada em até 2 tintas, como o clichê faz na fita real: a fita imprime no
 * máximo 2 chapas, e a arte é refeita nelas como o designer da TapePro refaz. Com mais de 2 cores,
 * as parecidas dividem chapa e matiz diferente ganha a sua (ver PESO_CLARIDADE_LIGADA); sombra e
 * brilho de uma superfície saem numa cor chapada (ver tintaDaChapa); o fundo (branco ou
 * transparente), o papel claro atrás do desenho e o fundo preto preso entre letras cromadas viram
 * película sem tinta. A saída alimenta a vetorização (imagetracerjs).
 *
 * Só conta sobre pixels, sem DOM: roda no Worker da prévia e no teste do Node.
 *
 * Sobre fundo branco, todo pixel é lido como uma tinta mais branco: fica no raio que sai do
 * branco e passa pela cor da tinta, e a distância até o branco diz quanto de tinta ele tem. A
 * borda suavizada de uma letra navy é navy clareado, no raio do navy — nunca a cor mais perto
 * dela (que pode ser a outra tinta).
 *
 * `escalaFonte` é quantos pixels da imagem recebida valem 1 pixel do arquivo original (a prévia
 * amplia logo pequena para 400 px de altura). A borda suavizada do arquivo tem 1 ou 2 pixels
 * dele; ampliada, tem 1 ou 2 × escalaFonte: os raios das contas abaixo seguem essa medida.
 */

export interface Tinta {
  r: number;
  g: number;
  b: number;
}

/** Só pixel quase opaco entra na conta da cor: a borda semitransparente puxaria a tinta para o fundo. */
const ALFA_SOLIDO = 200;
/** Abaixo disso de opacidade o pixel é transparente (ver FRACAO_DETALHE). */
const ALFA_TRANSPARENTE = 16;
/** Sobre fundo branco, pixel a menos que isto do branco (soma dos 3 canais) não conta para a cor: é fundo ou ruído de JPG. */
const LONGE_DO_BRANCO = 90;
/** Distância retilínea (soma dos 3 canais) abaixo da qual duas cores achadas são a mesma tinta (e o degradê, uma só). */
const MESMA_TINTA = 90;
/**
 * Só conta para a cor o pixel plano: parecido (até esta soma dos 3 canais) com os vizinhos a
 * RAIO_PLANO_FONTE pixels do original. Borda suavizada nunca é plana: é a mistura da tinta com o
 * fundo, e contá-la inventava uma segunda tinta (logo preta saía com uma tinta cinza contornando
 * cada letra). Degradê e o ruído de um JPG razoável ficam abaixo disto.
 */
const VARIACAO_PLANA = 40;
const RAIO_PLANO_FONTE = 1;
const RAIO_MIN = 2;
/** Teto de pixels amostrados para achar as cores: a conta fica igual e rápida em logo grande. */
const AMOSTRAS_MAX = 40_000;
/** Grupos de cor procurados antes de juntar os parecidos e ficar com os 2 de maior área. */
const GRUPOS_DE_COR = 4;
const CICLOS_KMEANS = 8;
/** Cor que cobre menos que isto das amostras planas é ruído (pixel solto de compressão), não chapa. */
const AREA_MIN = 0.01;
/**
 * Logo com transparência não é JPG (o JPG não tem alfa): não há ruído de compressão para virar
 * tinta, e um detalhe pequeno de outra cor (a seta laranja de uma logo branca, ~1% da área) é
 * tinta a partir de FRACAO_DETALHE, se for um grupo compacto (até DISPERSAO_DETALHE, soma dos 3
 * canais). Sem transparência valem AREA_MIN e FRACAO_TRACO_FINO: a borda de um JPG ruim também
 * forma grupinhos de cor.
 */
const FRACAO_DETALHE = 0.003;
const DISPERSAO_DETALHE = 20;
/**
 * Logo só de traço fino (nenhum pixel plano): a cor sai da metade das amostras mais longe do
 * branco, que é onde o traço chega mais perto da tinta pura.
 */
const FRACAO_TINTA_PURA = 0.5;
/**
 * Mistura: cor a até esta distância (euclidiana, RGB) do raio de uma tinta, ou do segmento entre
 * duas tintas, é a borda de uma delas. O JPG desvia um pouco a cor da borda (a cor dele tem
 * metade da resolução), daí a folga.
 */
const DESVIO_MISTURA = 40;
/**
 * Cor no raio de outra tinta, mais clara que ela, pode ser tinta de verdade (um nome cinza grosso
 * ao lado de um símbolo preto) ou o borrão de traço fino da escura (o subtítulo preto de um print
 * sai cinza; o subtítulo vermelho, salmão — e com mais pixels planos que o fio vermelho puro).
 * Decide o platô largo: tinta de verdade tem miolo plano também no dobro do raio de planura
 * (pelo menos FRACAO_PLATO das amostras planas dela); bolha de borrão, não. Logo pequena demais
 * para platô (nenhuma cor dela tem) decide pela proporção de amostras planas: na dúvida a logo
 * sai de uma tinta só, que fica limpa.
 */
const FRACAO_PLATO = 0.1;
const PROPORCAO_TINTA_REAL = 0.5;
/**
 * Na separação, duas tintas só dividem o mesmo raio (preto e cinza) até esta distância dele;
 * aí a cor não decide entre elas e decide a vizinhança. Dois tons de uma cor (o verde da folha e
 * o verde-escuro do nome, a 36 do raio um do outro) ainda se separam pelo raio de cada um.
 */
const DESVIO_COLINEAR = 15;
/** Ponta do segmento perto demais da cor testada: aí ela é a própria tinta, não mistura. */
const PONTA_DO_SEGMENTO = 0.1;
/**
 * Traço fino de outra cor (o fio vermelho embaixo do nome, um subtítulo colorido) não tem pixel
 * plano. Se mais que esta fração da tinta não cabe em nenhuma cor achada, ela vira candidata.
 */
const FRACAO_TRACO_FINO = 0.05;
/**
 * Tinta que só aparece em traço fino sai clara (o traço não chega a cobrir o pixel). A cor dela é
 * puxada para o pico: a média do FRACAO_PICO mais longe do branco entre os pixels do raio dela,
 * quando o pico difere da média plana mais que PURIFICAR_ACIMA. Abaixo disso a diferença é só o
 * ruído do JPG, e fica a média plana.
 */
const FRACAO_PICO = 0.1;
const PURIFICAR_ACIMA = 80;
/**
 * Divisa entre tinta e película pelo limiar de Bernsen: entre a maior e a menor cobertura de tinta
 * num raio de RAIO_LOCAL_FONTE pixels do original, na fração FRACAO_LIMIAR do caminho. Traço fino
 * que só chega a 40% de cobertura aparece; furo pequeno que não chega a clarear de todo não
 * fecha. Abaixo de CONTRASTE_MIN a vizinhança é plana e vale o meio a meio; o ruído de JPG fica
 * abaixo disto e não vira pinta.
 */
const RAIO_LOCAL_FONTE = 2.5;
const FRACAO_LIMIAR = 0.5;
const CONTRASTE_MIN = 0.3;
/** Cobertura a partir da qual a vizinhança é toda de tinta e a partilha entre as tintas segue o limiar local (ver partilharPeloLimiarLocal). */
const COBERTURA_FIRME = 0.75;
/**
 * Matiz perdido: ilustração cheia de detalhe (azulejo, estampa) quase não tem pixel plano, e uma
 * cor inteira dela (o vermelho de um azulejo) não vira grupo nem traço fino. Entre as amostras
 * coloridas que nenhuma cor achada explica, o matiz (com LARGURA_DO_MATIZ graus para cada lado)
 * que junta pelo menos FRACAO_MATIZ_PERDIDO das amostras de tinta, fora o papel, vira cor; até
 * MATIZES_PERDIDOS_MAX deles.
 */
const FRACAO_MATIZ_PERDIDO = 0.02;
const LARGURA_DO_MATIZ = 20;
const MATIZES_PERDIDOS_MAX = 2;
/** Folga (RGB) no peso de cada tinta pela distância ao raio dela: sem isso, o pixel exato no raio levaria peso infinito. */
const FOLGA_DESVIO = 4;
/** A mesma folga, na distância de chapa (distanciaDeChapa2) da logo sem fundo branco. */
const FOLGA_LAB = 0.01;
/**
 * Logo opaca (sem transparência nem fundo branco): a borda suavizada é a mistura das duas cores
 * em sRGB, e a divisa certa fica no meio do caminho em sRGB. A claridade da partilha é então a
 * luma, que é linear em sRGB (a do OKLab engordava o texto branco no fundo navy), e pesa mais que
 * o matiz: há JPG, que guarda a cor em blocos de meia resolução e vaza o amarelo de um círculo no
 * navy em volta. O matiz ainda conta, e a faixa escura do cromado não vira o azul do X.
 */
const PESO_CLARIDADE_JPG = 1;
const PESO_CROMA_JPG = 2.5;
/** Luma (0 a 1) de um pixel sRGB: a claridade que a borda suavizada mistura em linha reta. */
const luma = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
/**
 * Arte com mais de 2 cores: elas se juntam em 2 chapas, do par mais barato para o mais caro. O
 * custo é a distância entre as duas, pesada pela área delas (Ward), com teto em FRACAO_AREA_PLENA
 * da arte: acima dele, a área não pesa mais, porque um matiz bem presente merece chapa mesmo com
 * pouca área (o único vermelho de um azulejo azul). Na distância, mudar de matiz custa muito e
 * mudar só a claridade custa pouco quando as duas cores são a mesma superfície em sombra e brilho
 * (o cromado: prata, cinza e preto, ligados por degradê): o X azul de uma logo cromada fica azul e
 * a sombra preta das letras fica com o prata. Duas cores sem degradê entre elas (letra branca num
 * selo preto) pagam a claridade cheia.
 */
const FRACAO_AREA_PLENA = 0.05;
const PESO_CLARIDADE_LIGADA = 0.5;
const PESO_CLARIDADE_SOLTA = 1.5;
const PESO_CROMA = 5;
/**
 * Cores ligadas por degradê: amostras planas no meio do caminho entre elas, pelo menos esta fração
 * das planas da menor das duas. Só a plana conta: o meio-tom de um degradê muda devagar, o da
 * borda borrada de uma letra (branca no fundo navy de um arquivo pequeno) muda de repente.
 */
const FRACAO_LIGACAO = 0.15;
/** Croma OKLab abaixo disto é cor neutra (branco, prata, cinza, preto). */
const CROMA_NEUTRA = 0.04;
/** Sobre fundo branco, cor neutra com claridade OKLab acima disto é o papel da arte, não tinta (a fita é película). */
const CLARIDADE_PAPEL = 0.85;
/**
 * Fundo preso no cromado: logo cromada feita sobre fundo preto. O recorte do iPhone tira o fundo
 * de fora e deixa opaco o preto dos vãos entre as letras e do miolo delas; o JPG traz o fundo
 * preto inteiro. Numa chapa de cinzas que vai do cromado (claridade acima de CLARIDADE_CROMADO)
 * ao preto (abaixo de CLARIDADE_PRETO), a mancha preta que encosta em cor (o cromado, a outra
 * chapa) em pelo menos FRACAO_CERCADA da borda é o fundo atrás das letras: sai película. A que
 * encosta mais na transparência (um nome preto ao lado de um emblema prateado) é tinta.
 */
const CLARIDADE_PRETO = 0.2;
const CLARIDADE_CROMADO = 0.5;
const FRACAO_CERCADA = 0.6;
/** Prata e cromado não imprimem: o designer da TapePro refaz em preto, este (amostra do layout da Maxmed, 14/10/2026). */
const PRETO_DO_LAYOUT: Tinta = { r: 30, g: 30, b: 30 };
/**
 * Cor só com degradê (o X azul de uma logo cromada, do marinho ao celeste): o grupo de cor tem
 * dispersão acima disto (soma dos 3 canais). Cor chapada de PNG ou de JPG razoável fica abaixo.
 */
const DISPERSAO_DEGRADE = 50;
/** Degradê de um matiz só (marinho ao celeste) e não entre dois (azul ao verde): desvio circular do matiz, em graus. */
const ESPALHAMENTO_MATIZ = 25;
/**
 * Chapa de várias cores em que uma tem mais que esta fração da área: é essa cor com detalhes de
 * outras (o nome marinho com o brilho ciano de uma letra), não um degradê, e ela é a tinta.
 */
const FRACAO_DOMINANTE = 0.75;
const BRANCO: Tinta = { r: 255, g: 255, b: 255 };

const distancia = (t: Tinta, r: number, g: number, b: number) => Math.abs(t.r - r) + Math.abs(t.g - g) + Math.abs(t.b - b);
const distanciaEntre = (a: Tinta, b: Tinta) => distancia(a, b.r, b.g, b.b);
const corEm = (rgba: Uint8ClampedArray, i: number): Tinta => ({ r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] });
const raioEmPixels = (raioFonte: number, escalaFonte: number) => Math.max(RAIO_MIN, Math.round(raioFonte * escalaFonte));

/** Onde `c` cai na reta de `a` (t = 0) a `b` (t = 1), e a que distância (euclidiana) dela. */
function naReta(c: Tinta, a: Tinta, b: Tinta): { t: number; desvio: number } {
  const ab = [b.r - a.r, b.g - a.g, b.b - a.b];
  const ac = [c.r - a.r, c.g - a.g, c.b - a.b];
  const comprimento2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  const t = comprimento2 ? (ab[0] * ac[0] + ab[1] * ac[1] + ab[2] * ac[2]) / comprimento2 : 0;
  return { t, desvio: Math.hypot(ac[0] - t * ab[0], ac[1] - t * ab[1], ac[2] - t * ab[2]) };
}

/** Quanto de `tinta` há no pixel, sobre fundo branco: a distância dele ao branco contra a da tinta (0 a 1). */
const coberturaNoRaio = (c: Tinta, tinta: Tinta) => Math.min(1, distanciaEntre(BRANCO, c) / Math.max(1, distanciaEntre(BRANCO, tinta)));
/** Distância do pixel ao raio que sai do branco e passa pela tinta. */
const desvioDoRaio = (c: Tinta, tinta: Tinta) => naReta(c, BRANCO, tinta).desvio;

/** `clara` fica no raio de `escura`, mais perto do branco: é `escura` clareada. */
const noRaioDe = (clara: Tinta, escura: Tinta) => {
  const { t, desvio } = naReta(clara, BRANCO, escura);
  return desvio <= DESVIO_MISTURA && t >= PONTA_DO_SEGMENTO && t <= 1 - PONTA_DO_SEGMENTO;
};

interface Grupo {
  cor: Tinta;
  /** Amostras planas do grupo. */
  n: number;
  /** Delas, as planas também no dobro do raio (ver FRACAO_PLATO). */
  largos: number;
  /** Distância média (soma dos 3 canais) das amostras à cor do grupo. */
  dispersao: number;
}

/** Uma chapa do clichê: a tinta que ela imprime e as cores da arte que saem nela. */
export interface Chapa {
  tinta: Tinta;
  /** A própria tinta, a sombra e o degradê dela, e as cores da arte que não couberam nas 2 chapas. */
  cores: Tinta[];
}

export interface ChapasDaLogo {
  /** Até 2, a de maior área primeiro. */
  chapas: Chapa[];
  /** 1 no pixel que tem cor mas sai película: o fundo preto preso entre as letras (ver CLARIDADE_PRETO). */
  pelicula: Uint8Array | null;
}

/** As até 2 tintas da logo, a de maior área primeiro (ver chapasDaLogo). */
export function tintasDaLogo(rgba: Uint8ClampedArray, largura: number, altura: number, fundoBranco: boolean, escalaFonte = 1): Tinta[] {
  return chapasDaLogo(rgba, largura, altura, fundoBranco, escalaFonte).chapas.map((c) => c.tinta);
}

/**
 * As até 2 chapas da logo. Cores parecidas viram uma só; com mais de 2 cores, elas se juntam em 2
 * chapas (ver PESO_CLARIDADE_LIGADA). Logo sem tinta nenhuma não tem chapa.
 */
export function chapasDaLogo(rgba: Uint8ClampedArray, largura: number, altura: number, fundoBranco: boolean, escalaFonte = 1): ChapasDaLogo {
  const { todas, planos, largos, transparente } = amostrar(rgba, largura, altura, fundoBranco, escalaFonte);
  if (todas.length === 0) return { chapas: [], pelicula: null };
  const base = planos.length > 0 ? planos : maisLongeDoBranco(todas, rgba);
  const grupos = juntarParecidos(kmeans(base, rgba, GRUPOS_DE_COR));
  contarPlatos(grupos, largos, rgba);
  let candidatas = semMisturas(grupos, fundoBranco).filter((g) => g.n >= base.length * (transparente ? FRACAO_DETALHE : AREA_MIN));

  // Traço fino ou detalhe de outra cor: não tem pixel plano bastante e ficou fora dos grupos.
  const corte = transparente ? FRACAO_DETALHE : FRACAO_TRACO_FINO;
  const coresAchadas = candidatas.map((g) => g.cor);
  const soltas = todas.filter((i) => !explicada(corEm(rgba, i), coresAchadas, fundoBranco));
  if (soltas.length >= todas.length * corte) {
    const finas = juntarParecidos(kmeans(fundoBranco ? maisLongeDoBranco(soltas, rgba) : soltas, rgba, 2)).filter(
      (g) => g.n >= todas.length * corte * (fundoBranco ? FRACAO_TINTA_PURA : 1) && (!transparente || g.dispersao <= DISPERSAO_DETALHE),
    );
    candidatas = semMisturas([...candidatas, ...finas], fundoBranco);
  }

  if (fundoBranco) {
    const cores = candidatas.map((g) => g.cor);
    candidatas = juntarParecidos(
      candidatas.map((g) =>
        // Cor real mais clara no raio de outra (cinza ao lado do preto) fica como é: o pico dela é a outra.
        cores.some((c) => c !== g.cor && noRaioDe(g.cor, c)) ? g : { ...g, cor: purificar(g.cor, cores, todas, rgba) },
      ),
    );
  }

  for (let vez = 0; vez < MATIZES_PERDIDOS_MAX; vez++) {
    // O papel vai sair película: a mistura dele com uma tinta não explica cor nenhuma.
    const cores = candidatas.map((g) => g.cor).filter((c) => !fundoBranco || !ehPapel(c));
    const perdido = matizPerdido(todas, rgba, cores, fundoBranco);
    if (!perdido) break;
    candidatas = [...candidatas, perdido];
  }

  const area = areaDeCada(candidatas.map((g) => g.cor), todas, rgba, fundoBranco);
  let cores = candidatas.map((g, k) => ({ cor: g.cor, area: area[k], dispersao: g.dispersao }));
  // O papel claro atrás do desenho (folha rasgada, textura) não é tinta: sai película.
  if (fundoBranco && cores.some((c) => !ehPapel(c.cor))) cores = cores.filter((c) => !ehPapel(c.cor));
  const gruposDeChapa = juntarEmChapas(cores, planos, rgba).sort((a, b) => b.area - a.area);
  const pelicula = fundoPresoNoCromado(rgba, largura, altura, gruposDeChapa, fundoBranco);
  return {
    chapas: gruposDeChapa.map((g) => ({ tinta: tintaDaChapa(g, gruposDeChapa, todas, rgba, pelicula), cores: g.membros.map((m) => m.cor) })),
    pelicula,
  };
}

interface Lab {
  L: number;
  a: number;
  b: number;
}

/** sRGB (0 a 255) para luz linear, por canal. */
const LINEAR = Float64Array.from({ length: 256 }, (_, c) => (c <= 10.31475 ? c / 3294.6 : ((c / 255 + 0.055) / 1.055) ** 2.4));

/** OKLab de um pixel, escrito em `saida` (L, a, b): sem objeto, para rodar em cada pixel. */
function oklabEm(r: number, g: number, b: number, saida: Float64Array) {
  const R = LINEAR[r];
  const G = LINEAR[g];
  const B = LINEAR[b];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  saida[0] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  saida[1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  saida[2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}

/** OKLab: L é a claridade (0 a 1); a e b, o matiz e a força dele (o croma é a distância a 0). */
function oklab({ r, g, b }: Tinta): Lab {
  const s = new Float64Array(3);
  oklabEm(r, g, b, s);
  return { L: s[0], a: s[1], b: s[2] };
}

/** Distância (ao quadrado) que separa as chapas: claridade e croma (a, b), cada um com seu peso. */
const distanciaDeChapa2 = (L1: number, a1: number, b1: number, L2: number, a2: number, b2: number, pesoClaridade: number, pesoCroma = PESO_CROMA) =>
  (pesoClaridade * (L1 - L2)) ** 2 + pesoCroma ** 2 * ((a1 - a2) ** 2 + (b1 - b2) ** 2);

const croma = (c: Lab) => Math.hypot(c.a, c.b);
const ehNeutra = (c: Lab) => croma(c) < CROMA_NEUTRA;
/** Matiz OKLab em graus (0 a 360), dados a e b. */
const matizDe = (a: number, b: number) => ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
const matiz = (c: Lab) => matizDe(c.a, c.b);
/** Diferença entre dois matizes, em graus (0 a 180). */
const entreMatizes = (h1: number, h2: number) => Math.abs(((h1 - h2 + 540) % 360) - 180);
/** Dois tons do mesmo matiz (ver ESPALHAMENTO_MATIZ), ou dois cinzas. */
const matizesIguais = (x: Lab, y: Lab) => (ehNeutra(x) && ehNeutra(y)) || (!ehNeutra(x) && !ehNeutra(y) && entreMatizes(matiz(x), matiz(y)) <= ESPALHAMENTO_MATIZ);
const ehPapel = (cor: Tinta) => {
  const c = oklab(cor);
  return ehNeutra(c) && c.L > CLARIDADE_PAPEL;
};

interface CorComArea {
  cor: Tinta;
  area: number;
  /** Ver Grupo.dispersao. */
  dispersao: number;
}

/** Ver FRACAO_LIGACAO: `a` e `b` são a mesma superfície, com degradê de uma para a outra. */
function ligadasPorDegrade(a: Tinta, b: Tinta, planos: number[], rgba: Uint8ClampedArray): boolean {
  let pertoDeA = 0;
  let pertoDeB = 0;
  let meio = 0;
  for (const i of planos) {
    const { t, desvio } = naReta(corEm(rgba, i), a, b);
    if (desvio > DESVIO_MISTURA || t < -PONTA_DO_SEGMENTO || t > 1 + PONTA_DO_SEGMENTO) continue;
    if (t < 0.25) pertoDeA++;
    else if (t > 0.75) pertoDeB++;
    else meio++;
  }
  return meio > 0 && meio >= FRACAO_LIGACAO * Math.min(pertoDeA, pertoDeB);
}

interface GrupoDeChapa {
  membros: CorComArea[];
  area: number;
  /** Os membros são uma superfície só, ligados por degradê (ver FRACAO_LIGACAO). */
  ligada: boolean;
}

/** Junta as cores em até 2 chapas (ver PESO_CLARIDADE_LIGADA). */
function juntarEmChapas(cores: CorComArea[], planos: number[], rgba: Uint8ClampedArray): GrupoDeChapa[] {
  const ligacao = cores.map((a, k) => cores.map((b, j) => j > k && cores.length > 2 && ligadasPorDegrade(a.cor, b.cor, planos, rgba)));
  const ligadas = (x: number, y: number) => ligacao[Math.min(x, y)][Math.max(x, y)];
  let grupos = cores.map((c, k) => ({ membros: [k], area: c.area, lab: oklab(c.cor), ligada: true }));
  const areaPlena = FRACAO_AREA_PLENA * cores.reduce((s, c) => s + c.area, 0);
  while (grupos.length > 2) {
    let par: [number, number] = [0, 1];
    let parLigado = false;
    let menor = Infinity;
    for (let a = 0; a < grupos.length; a++) {
      for (let b = a + 1; b < grupos.length; b++) {
        const ga = grupos[a];
        const gb = grupos[b];
        const ligados = ga.membros.some((x) => gb.membros.some((y) => ligadas(x, y)));
        const d2 = distanciaDeChapa2(ga.lab.L, ga.lab.a, ga.lab.b, gb.lab.L, gb.lab.a, gb.lab.b, ligados ? PESO_CLARIDADE_LIGADA : PESO_CLARIDADE_SOLTA);
        const custo = Math.min(areaPlena, (ga.area * gb.area) / Math.max(1e-9, ga.area + gb.area)) * d2;
        if (custo < menor) {
          menor = custo;
          par = [a, b];
          parLigado = ligados;
        }
      }
    }
    const [a, b] = par;
    const ga = grupos[a];
    const gb = grupos[b];
    const area = ga.area + gb.area;
    const media = (c: keyof Lab) => (area ? (ga.lab[c] * ga.area + gb.lab[c] * gb.area) / area : (ga.lab[c] + gb.lab[c]) / 2);
    grupos[a] = {
      membros: [...ga.membros, ...gb.membros],
      area,
      lab: { L: media("L"), a: media("a"), b: media("b") },
      ligada: ga.ligada && gb.ligada && parLigado,
    };
    grupos.splice(b, 1);
  }
  return grupos.map((g) => ({ membros: g.membros.map((k) => cores[k]), area: g.area, ligada: g.ligada }));
}

/** As cores de todas as chapas em OKLab, com a chapa de cada uma: a chapa de um pixel é a da cor mais próxima. */
function paletaDasChapas(grupos: GrupoDeChapa[]) {
  return grupos.flatMap((g, chapa) => g.membros.map((m) => ({ lab: oklab(m.cor), chapa })));
}

function maisProximaNaPaleta(lab: Float64Array, paleta: { lab: Lab }[]): number {
  let melhor = 0;
  let menor = Infinity;
  for (let k = 0; k < paleta.length; k++) {
    const c = paleta[k].lab;
    const d = distanciaDeChapa2(lab[0], lab[1], lab[2], c.L, c.a, c.b, PESO_CLARIDADE_LIGADA);
    if (d < menor) {
      menor = d;
      melhor = k;
    }
  }
  return melhor;
}

/**
 * A tinta que a chapa imprime, como o designer refaz a arte para a fita. Cor chapada: ela mesma.
 * Superfície de cinzas ligada por degradê: com prata (cromado, metal), PRETO_DO_LAYOUT; sem prata,
 * o tom mais escuro dela (média do FRACAO_PICO mais escuro). Degradê de uma cor: o tom mais
 * forte (o FRACAO_PICO de maior croma). Cores diferentes juntas por falta de chapa: cinzas saem
 * no mais escuro; cores, na de mais área × croma; cinza com cor, na de maior área.
 */
function tintaDaChapa(g: GrupoDeChapa, grupos: GrupoDeChapa[], todas: number[], rgba: Uint8ClampedArray, pelicula: Uint8Array | null): Tinta {
  const labs = g.membros.map((m) => oklab(m.cor));
  const neutra = labs.every(ehNeutra);
  const colorida = !labs.some(ehNeutra);
  const unica = g.membros.length === 1;
  if (neutra && !unica && g.ligada) {
    if (labs.some((c) => c.L > CLARIDADE_CROMADO)) return PRETO_DO_LAYOUT;
    return pico(amostrasDaChapa(grupos.indexOf(g), grupos, todas, rgba, pelicula), rgba, (a) => -a.L);
  }
  const dominante = Math.max(...g.membros.map((m) => m.area)) > FRACAO_DOMINANTE * g.area;
  if (colorida && (unica ? g.membros[0].dispersao > DISPERSAO_DEGRADE : g.ligada && !dominante)) {
    const amostras = amostrasDaChapa(grupos.indexOf(g), grupos, todas, rgba, pelicula);
    // O tom mais vivo (o maior croma em RGB, que prefere o celeste ao marinho) só vale para degradê de um matiz.
    if (deUmMatiz(amostras)) return pico(amostras, rgba, (a) => Math.max(rgba[a.i], rgba[a.i + 1], rgba[a.i + 2]) - Math.min(rgba[a.i], rgba[a.i + 1], rgba[a.i + 2]));
  }
  if (unica) return g.membros[0].cor;
  const melhor = (nota: (k: number) => number) => g.membros[labs.reduce((m, _, k) => (nota(k) > nota(m) ? k : m), 0)].cor;
  if (neutra) return melhor((k) => -labs[k].L);
  if (colorida) return melhor((k) => g.membros[k].area * croma(labs[k]));
  return melhor((k) => g.membros[k].area);
}

interface AmostraLab extends Lab {
  /** Índice (em bytes) do pixel. */
  i: number;
}

/** As amostras de tinta que saem na chapa (a da cor mais próxima delas), fora as de película. */
function amostrasDaChapa(chapa: number, grupos: GrupoDeChapa[], todas: number[], rgba: Uint8ClampedArray, pelicula: Uint8Array | null): AmostraLab[] {
  const paleta = paletaDasChapas(grupos);
  const lab = new Float64Array(3);
  const amostras: AmostraLab[] = [];
  for (const i of todas) {
    if (pelicula?.[i >> 2]) continue;
    oklabEm(rgba[i], rgba[i + 1], rgba[i + 2], lab);
    if (paleta[maisProximaNaPaleta(lab, paleta)].chapa === chapa) amostras.push({ i, L: lab[0], a: lab[1], b: lab[2] });
  }
  return amostras;
}

/** A média do FRACAO_PICO das amostras de maior `nota`. */
function pico(amostras: AmostraLab[], rgba: Uint8ClampedArray, nota: (a: AmostraLab) => number): Tinta {
  const notas = amostras.map((a) => ({ i: a.i, nota: nota(a) })).sort((x, y) => y.nota - x.nota);
  const topo = notas.slice(0, Math.max(1, Math.ceil(notas.length * FRACAO_PICO)));
  const media = (canal: number) => Math.round(topo.reduce((s, a) => s + rgba[a.i + canal], 0) / Math.max(1, topo.length));
  return { r: media(0), g: media(1), b: media(2) };
}

/** As amostras coloridas ficam num matiz só: o desvio circular do matiz delas, pesado pelo croma, até ESPALHAMENTO_MATIZ. */
function deUmMatiz(amostras: AmostraLab[]): boolean {
  let x = 0;
  let y = 0;
  let peso = 0;
  for (const a of amostras) {
    const c = Math.hypot(a.a, a.b);
    if (c < CROMA_NEUTRA) continue;
    x += a.a;
    y += a.b;
    peso += c;
  }
  if (peso === 0) return false;
  const concentracao = Math.hypot(x, y) / peso;
  return Math.sqrt(-2 * Math.log(Math.max(1e-9, concentracao))) <= (ESPALHAMENTO_MATIZ * Math.PI) / 180;
}

/**
 * Ver CLARIDADE_PRETO. Devolve os pixels do fundo preso (1 = película), ou null quando a logo não
 * tem chapa de cinzas do cromado ao preto.
 */
function fundoPresoNoCromado(rgba: Uint8ClampedArray, largura: number, altura: number, grupos: GrupoDeChapa[], fundoBranco: boolean): Uint8Array | null {
  const chapa = grupos.findIndex((g) => {
    const labs = g.membros.map((m) => oklab(m.cor));
    return labs.length > 1 && labs.every(ehNeutra) && labs.some((c) => c.L < CLARIDADE_PRETO) && labs.some((c) => c.L > CLARIDADE_CROMADO);
  });
  if (chapa < 0) return null;
  const paleta = paletaDasChapas(grupos);
  const total = largura * altura;
  // Cada pixel: FORA (transparente ou papel), PRETO e CROMADO (da chapa de cinzas) ou OUTRA (a outra chapa).
  const FORA = 0;
  const PRETO = 1;
  const CROMADO = 2;
  const OUTRA = 3;
  const classe = new Uint8Array(total);
  const lab = new Float64Array(3);
  for (let p = 0, i = 0; p < total; p++, i += 4) {
    if (rgba[i + 3] < 128 || (fundoBranco && distancia(BRANCO, rgba[i], rgba[i + 1], rgba[i + 2]) <= LONGE_DO_BRANCO)) continue;
    oklabEm(rgba[i], rgba[i + 1], rgba[i + 2], lab);
    const cor = paleta[maisProximaNaPaleta(lab, paleta)];
    classe[p] = cor.chapa !== chapa ? OUTRA : cor.lab.L < CLARIDADE_PRETO ? PRETO : CROMADO;
  }

  // Cada mancha preta (4-vizinhança): de quem é a borda dela.
  const pelicula = new Uint8Array(total);
  const visto = new Uint8Array(total);
  const fila = new Int32Array(total);
  let algum = false;
  for (let semente = 0; semente < total; semente++) {
    if (classe[semente] !== PRETO || visto[semente]) continue;
    let inicio = 0;
    let fim = 0;
    fila[fim++] = semente;
    visto[semente] = 1;
    let cercada = 0;
    let borda = 0;
    while (inicio < fim) {
      const p = fila[inicio++];
      const x = p % largura;
      const y = (p - x) / largura;
      for (const [vx, vy] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (vx < 0 || vy < 0 || vx >= largura || vy >= altura) {
          borda++;
          continue;
        }
        const q = vy * largura + vx;
        if (classe[q] === PRETO) {
          if (!visto[q]) {
            visto[q] = 1;
            fila[fim++] = q;
          }
          continue;
        }
        borda++;
        if (classe[q] !== FORA) cercada++;
      }
    }
    if (borda === 0 || cercada < FRACAO_CERCADA * borda) continue;
    for (let k = 0; k < fim; k++) pelicula[fila[k]] = 1;
    algum = true;
  }
  return algum ? pelicula : null;
}

/**
 * Ver FRACAO_MATIZ_PERDIDO. A cor do matiz é a média dele (sem fundo branco) ou o pico dele, o
 * FRACAO_PICO mais longe do branco: a borda do desenho sobre o papel é a tinta clareada.
 */
function matizPerdido(todas: number[], rgba: Uint8ClampedArray, cores: Tinta[], fundoBranco: boolean): Grupo | null {
  const lab = new Float64Array(3);
  const soltas: { i: number; matiz: number }[] = [];
  let tinta = 0;
  for (const i of todas) {
    oklabEm(rgba[i], rgba[i + 1], rgba[i + 2], lab);
    const c = Math.hypot(lab[1], lab[2]);
    if (fundoBranco && c < CROMA_NEUTRA && lab[0] > CLARIDADE_PAPEL) continue;
    tinta++;
    if (c < CROMA_NEUTRA || explicada(corEm(rgba, i), cores, fundoBranco)) continue;
    soltas.push({ i, matiz: matizDe(lab[1], lab[2]) });
  }
  const FAIXA = 10;
  const faixas = new Float64Array(360 / FAIXA);
  // Matiz de uma cor já achada não se perdeu: é a sombra ou a borda dela (o JPG escurece o vermelho em volta da letra branca).
  const achados = cores.map(oklab).filter((c) => !ehNeutra(c)).map(matiz);
  const longeDosAchados = (h: number) => achados.every((achado) => entreMatizes(h, achado) > LARGURA_DO_MATIZ);
  for (const s of soltas) if (longeDosAchados(s.matiz)) faixas[Math.floor(s.matiz / FAIXA) % faixas.length]++;
  const vizinhas = Math.round(LARGURA_DO_MATIZ / FAIXA);
  const naJanela = (k: number) => {
    let soma = 0;
    for (let j = -vizinhas; j <= vizinhas; j++) soma += faixas[(k + j + faixas.length) % faixas.length];
    return soma;
  };
  let centro = 0;
  for (let k = 1; k < faixas.length; k++) if (naJanela(k) > naJanela(centro)) centro = k;
  if (naJanela(centro) < FRACAO_MATIZ_PERDIDO * tinta) return null;
  const matizCentral = (centro + 0.5) * FAIXA;
  const doMatiz = soltas
    .filter((s) => longeDosAchados(s.matiz) && entreMatizes(s.matiz, matizCentral) <= LARGURA_DO_MATIZ + FAIXA / 2)
    .map((s) => s.i);
  const base = fundoBranco ? maisLongeDoBranco(doMatiz, rgba).slice(0, Math.max(1, Math.ceil(doMatiz.length * FRACAO_PICO))) : doMatiz;
  const media = (canal: number) => Math.round(base.reduce((s, i) => s + rgba[i + canal], 0) / base.length);
  const cor = { r: media(0), g: media(1), b: media(2) };
  const dispersao = doMatiz.reduce((s, i) => s + distancia(cor, rgba[i], rgba[i + 1], rgba[i + 2]), 0) / doMatiz.length;
  return { cor, n: doMatiz.length, largos: 0, dispersao };
}

/** Índices (em bytes) dos pixels de tinta, com passo para não passar de AMOSTRAS_MAX, e os planos entre eles. */
function amostrar(rgba: Uint8ClampedArray, largura: number, altura: number, fundoBranco: boolean, escalaFonte: number) {
  const total = largura * altura;
  const ehTinta = (i: number) => rgba[i + 3] >= ALFA_SOLIDO && (!fundoBranco || distancia(BRANCO, rgba[i], rgba[i + 1], rgba[i + 2]) > LONGE_DO_BRANCO);
  const raio = raioEmPixels(RAIO_PLANO_FONTE, escalaFonte);
  const ehPlano = (p: number, alcance: number) => {
    const x = p % largura;
    const y = (p - x) / largura;
    const i = p * 4;
    let vizinhos = 0;
    for (const [dx, dy] of [[alcance, 0], [-alcance, 0], [0, alcance], [0, -alcance]]) {
      const vx = x + dx;
      const vy = y + dy;
      if (vx < 0 || vy < 0 || vx >= largura || vy >= altura) continue;
      const j = (vy * largura + vx) * 4;
      if (rgba[j + 3] < ALFA_SOLIDO) return false;
      if (Math.abs(rgba[i] - rgba[j]) + Math.abs(rgba[i + 1] - rgba[j + 1]) + Math.abs(rgba[i + 2] - rgba[j + 2]) > VARIACAO_PLANA) return false;
      vizinhos++;
    }
    return vizinhos > 0;
  };
  // Duas passadas: a planura é rara em logo borrada (só o miolo dos traços grossos), e contá-la com
  // o mesmo passo da tinta deixava poucas dezenas de amostras. Cada lista tem o seu passo.
  const TINTA = 1;
  const PLANO = 2;
  const tipo = new Uint8Array(total); // 0 = fundo
  let nTinta = 0;
  let nPlanos = 0;
  let transparente = false;
  for (let p = 0; p < total; p++) {
    if (rgba[p * 4 + 3] < ALFA_TRANSPARENTE) transparente = true;
    if (!ehTinta(p * 4)) continue;
    nTinta++;
    tipo[p] = ehPlano(p, raio) ? PLANO : TINTA;
    if (tipo[p] === PLANO) nPlanos++;
  }
  const passoTodas = Math.max(1, Math.ceil(nTinta / AMOSTRAS_MAX));
  const passoPlanos = Math.max(1, Math.ceil(nPlanos / AMOSTRAS_MAX));
  const todas: number[] = [];
  const planos: number[] = [];
  const largos: number[] = [];
  let contaTinta = 0;
  let contaPlanos = 0;
  for (let p = 0; p < total; p++) {
    if (!tipo[p]) continue;
    if (contaTinta++ % passoTodas === 0) todas.push(p * 4);
    if (tipo[p] !== PLANO || contaPlanos++ % passoPlanos !== 0) continue;
    planos.push(p * 4);
    if (ehPlano(p, 2 * raio)) largos.push(p * 4);
  }
  return { todas, planos, largos, transparente };
}

/** Quantas amostras de platô largo (ver FRACAO_PLATO) cada grupo tem, pela cor mais próxima. */
function contarPlatos(grupos: Grupo[], largos: number[], rgba: Uint8ClampedArray) {
  const cores = grupos.map((g) => g.cor);
  for (const i of largos) grupos[maisProxima(cores, corEm(rgba, i))].largos++;
}

/** A fração FRACAO_TINTA_PURA das amostras mais longe do branco. */
function maisLongeDoBranco(indices: number[], rgba: Uint8ClampedArray): number[] {
  const longe = (i: number) => distancia(BRANCO, rgba[i], rgba[i + 1], rgba[i + 2]);
  const ordenados = [...indices].sort((a, b) => longe(b) - longe(a));
  return ordenados.slice(0, Math.max(1, Math.ceil(ordenados.length * FRACAO_TINTA_PURA)));
}

function maisProxima(cores: Tinta[], c: Tinta): number {
  let melhor = 0;
  let menor = Infinity;
  cores.forEach((t, k) => {
    const d = distanciaEntre(t, c);
    if (d < menor) {
      menor = d;
      melhor = k;
    }
  });
  return melhor;
}

/** A tinta que explica o pixel: sobre fundo branco, a do raio mais próximo; sem ele, a cor mais próxima. */
function donaDoPixel(cores: Tinta[], c: Tinta, fundoBranco: boolean): number {
  if (!fundoBranco) return maisProxima(cores, c);
  let melhor = 0;
  let menor = Infinity;
  cores.forEach((t, k) => {
    const d = desvioDoRaio(c, t);
    if (d < menor) {
      menor = d;
      melhor = k;
    }
  });
  return melhor;
}

/** O pixel é uma das cores, a mistura de uma com o fundo branco, ou a mistura de duas delas. */
function explicada(c: Tinta, cores: Tinta[], fundoBranco: boolean): boolean {
  if (cores.some((t) => (fundoBranco ? desvioDoRaio(c, t) : distanciaEntre(c, t)) <= (fundoBranco ? DESVIO_MISTURA : MESMA_TINTA))) return true;
  for (let a = 0; a < cores.length; a++) {
    for (let b = a + 1; b < cores.length; b++) {
      const { t, desvio } = naReta(c, cores[a], cores[b]);
      if (desvio <= DESVIO_MISTURA && t >= 0 && t <= 1) return true;
    }
  }
  return false;
}

/** k-means determinístico: parte da amostra mais escura e de cada vez da mais distante das já escolhidas. */
function kmeans(amostras: number[], rgba: Uint8ClampedArray, k: number): Grupo[] {
  if (amostras.length === 0) return [];
  const brilho = (i: number) => rgba[i] + rgba[i + 1] + rgba[i + 2];
  const centros = [corEm(rgba, amostras.reduce((a, b) => (brilho(b) < brilho(a) ? b : a)))];
  const maisPerto = amostras.map((i) => distancia(centros[0], rgba[i], rgba[i + 1], rgba[i + 2]));
  while (centros.length < k) {
    let longe = 0;
    for (let s = 1; s < amostras.length; s++) if (maisPerto[s] > maisPerto[longe]) longe = s;
    if (maisPerto[longe] === 0) break; // menos cores distintas que k
    const novo = corEm(rgba, amostras[longe]);
    centros.push(novo);
    amostras.forEach((i, s) => (maisPerto[s] = Math.min(maisPerto[s], distancia(novo, rgba[i], rgba[i + 1], rgba[i + 2]))));
  }

  let cores = centros;
  let contagem: number[] = [];
  for (let ciclo = 0; ciclo < CICLOS_KMEANS; ciclo++) {
    const soma = cores.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (const i of amostras) {
      const s = soma[maisProxima(cores, corEm(rgba, i))];
      s.r += rgba[i];
      s.g += rgba[i + 1];
      s.b += rgba[i + 2];
      s.n++;
    }
    cores = soma.map((s, j) => (s.n ? { r: Math.round(s.r / s.n), g: Math.round(s.g / s.n), b: Math.round(s.b / s.n) } : cores[j]));
    contagem = soma.map((s) => s.n);
  }
  const desvios = cores.map(() => 0);
  for (const i of amostras) {
    const c = corEm(rgba, i);
    const k = maisProxima(cores, c);
    desvios[k] += distanciaEntre(cores[k], c);
  }
  return cores
    .map((cor, k) => ({ cor, n: contagem[k], largos: 0, dispersao: contagem[k] ? desvios[k] / contagem[k] : 0 }))
    .filter((g) => g.n > 0);
}

/** Junta, do par mais próximo para o mais distante, as cores a menos de MESMA_TINTA (média pesada pelo uso). */
function juntarParecidos(grupos: Grupo[]): Grupo[] {
  const lista = grupos.map((g) => ({ ...g }));
  for (;;) {
    let par: [number, number] | null = null;
    let menor = MESMA_TINTA;
    for (let a = 0; a < lista.length; a++) {
      for (let b = a + 1; b < lista.length; b++) {
        const d = distanciaEntre(lista[a].cor, lista[b].cor);
        if (d < menor) {
          menor = d;
          par = [a, b];
        }
      }
    }
    if (!par) return lista;
    const [a, b] = par;
    const n = lista[a].n + lista[b].n;
    const media = (c: keyof Tinta) => Math.round((lista[a].cor[c] * lista[a].n + lista[b].cor[c] * lista[b].n) / n);
    // Cada lado se afasta da cor nova na proporção do outro: um degradê junto fica largo.
    const dispersao = (lista[a].dispersao * lista[a].n + lista[b].dispersao * lista[b].n) / n + (2 * menor * lista[a].n * lista[b].n) / (n * n);
    lista[a] = { cor: { r: media("r"), g: media("g"), b: media("b") }, n, largos: lista[a].largos + lista[b].largos, dispersao };
    lista.splice(b, 1);
  }
}

const temPlato = (g: Grupo) => g.largos > 0 && g.largos >= FRACAO_PLATO * g.n;

/**
 * Ver FRACAO_PLATO: `clara`, que fica entre `escura` e o fundo (ou outra tinta), é só o borrão
 * dela. `haPlatos`: alguma cor da logo tem platô, ou seja, a resolução basta para mostrá-lo.
 */
function ehBorrao(clara: Grupo, escura: Grupo, haPlatos: boolean): boolean {
  if (temPlato(clara)) return false;
  return haPlatos || clara.n < PROPORCAO_TINTA_REAL * escura.n;
}

/**
 * Tira as cores que são borrão de outras, da menos usada para a mais usada: no raio de outra
 * tinta (sobre fundo branco) ou no segmento entre duas tintas, sem platô de tinta de verdade
 * (ver FRACAO_PLATO). As amostras dela passam para a ponta mais próxima, que é a tinta de que
 * ela é borda.
 */
function semMisturas(grupos: Grupo[], fundoBranco: boolean): Grupo[] {
  const lista = [...grupos].map((g) => ({ ...g })).sort((a, b) => a.n - b.n);
  const haPlatos = lista.some(temPlato);
  for (let k = 0; k < lista.length; k++) {
    const testada = lista[k];
    const outras = lista.filter((g) => g !== testada);
    let dona: Grupo | undefined = fundoBranco ? outras.find((g) => noRaioDe(testada.cor, g.cor) && ehBorrao(testada, g, haPlatos)) : undefined;
    for (let a = 0; a < outras.length && !dona; a++) {
      for (let b = a + 1; b < outras.length && !dona; b++) {
        const { t, desvio } = naReta(testada.cor, outras[a].cor, outras[b].cor);
        if (desvio > DESVIO_MISTURA || t < PONTA_DO_SEGMENTO || t > 1 - PONTA_DO_SEGMENTO) continue;
        if (!ehBorrao(testada, outras[a].n >= outras[b].n ? outras[a] : outras[b], haPlatos)) continue;
        dona = t < 0.5 ? outras[a] : outras[b];
      }
    }
    if (!dona) continue;
    dona.n += testada.n;
    dona.largos += testada.largos;
    lista.splice(k--, 1);
  }
  return lista;
}

/** Ver FRACAO_PICO. `cor` é uma de `cores`; o pixel é do raio dela quando é o raio mais próximo. */
function purificar(cor: Tinta, cores: Tinta[], todas: number[], rgba: Uint8ClampedArray): Tinta {
  const k = cores.indexOf(cor);
  const doRaio = todas.filter((i) => {
    const c = corEm(rgba, i);
    return donaDoPixel(cores, c, true) === k && desvioDoRaio(c, cor) <= DESVIO_MISTURA;
  });
  if (doRaio.length === 0) return cor;
  const longe = (i: number) => distancia(BRANCO, rgba[i], rgba[i + 1], rgba[i + 2]);
  const pico = [...doRaio].sort((a, b) => longe(b) - longe(a)).slice(0, Math.max(1, Math.ceil(doRaio.length * FRACAO_PICO)));
  const media = (canal: number) => Math.round(pico.reduce((s, i) => s + rgba[i + canal], 0) / pico.length);
  const purificada = { r: media(0), g: media(1), b: media(2) };
  const maisForte = distanciaEntre(BRANCO, purificada) > distanciaEntre(BRANCO, cor);
  return maisForte && distanciaEntre(purificada, cor) > PURIFICAR_ACIMA ? purificada : cor;
}

/** Quanto da logo cada cor cobre: a cobertura de cada pixel de tinta vai para a cor que o explica. */
function areaDeCada(cores: Tinta[], todas: number[], rgba: Uint8ClampedArray, fundoBranco: boolean): number[] {
  const area = cores.map(() => 0);
  for (const i of todas) {
    const c = corEm(rgba, i);
    const k = donaDoPixel(cores, c, fundoBranco);
    area[k] += fundoBranco ? coberturaNoRaio(c, cores[k]) : rgba[i + 3] / 255;
  }
  return area;
}

/** Grade da logo separada: um índice por pixel, 0 = película, 1 e 2 = as tintas na ordem dada. */
export interface GradeDeTintas {
  indices: Uint8Array;
  largura: number;
  altura: number;
}

export interface OpcoesSeparacao {
  /** Ver o topo do arquivo. */
  escalaFonte: number;
  /** A grade sai `fator` vezes maior que a imagem: a divisa cai entre os pixels dela, sem degrau. */
  fator: number;
  /** As cores da arte que saem em cada tinta (Chapa.cores); sem isso, cada tinta é só a própria cor. */
  coresDeCada?: Tinta[][];
  /** Ver ChapasDaLogo.pelicula. */
  pelicula?: Uint8Array | null;
}

/**
 * A logo reimpressa só com as tintas dadas, numa grade `fator` vezes maior. Cada pixel tem uma
 * cobertura de tinta (0 a 1) e uma partilha entre as duas tintas; o limiar de Bernsen sobre a
 * cobertura decide tinta ou película. Cobertura, limiar e partilha são ampliados com
 * interpolação bicúbica antes de decidir, e o contorno sai liso mesmo de um print.
 */
export function separarTintas(
  rgba: Uint8ClampedArray,
  largura: number,
  altura: number,
  tintas: Tinta[],
  fundoBranco: boolean,
  { escalaFonte, fator, coresDeCada = tintas.map((t) => [t]), pelicula = null }: OpcoesSeparacao,
): GradeDeTintas {
  const total = largura * altura;
  const raio = raioEmPixels(RAIO_LOCAL_FONTE, escalaFonte);
  const cobertura = new Float32Array(total);
  // Quanto da tinta do pixel é da 1ª (0 a 1). Com uma tinta só, não é usada.
  const partilha = new Float32Array(total);
  let comTransparencia = false;
  for (let i = 3; i < rgba.length && !comTransparencia; i += 4) comTransparencia = rgba[i] < ALFA_TRANSPARENTE;
  medirMistura(rgba, coresDeCada, fundoBranco, comTransparencia, cobertura, partilha);
  const colineares = fundoBranco && tintas.length === 2 && naReta(tintas[1], BRANCO, tintas[0]).desvio <= DESVIO_COLINEAR;
  // Positivo = 1ª tinta, negativo = 2ª, pesado pela cobertura (na película a partilha não pesa).
  // A das tintas no mesmo raio redefine a cobertura: vem antes do limiar.
  let diferenca = tintas.length === 2 && colineares ? partilharPelaVizinhanca(rgba, largura, altura, tintas, raio, cobertura) : null;
  if (pelicula) for (let p = 0; p < total; p++) if (pelicula[p]) cobertura[p] = 0;
  const menorBruto = janelaExtrema(cobertura, largura, altura, raio, Math.min);
  if (tintas.length === 2 && !colineares) diferenca = partilharPeloLimiarLocal(cobertura, partilha, menorBruto, largura, altura, raio);

  const maior = borrarCaixa(janelaExtrema(cobertura, largura, altura, raio, Math.max), largura, altura, raio);
  const menor = borrarCaixa(menorBruto, largura, altura, raio);
  // Margem acima do limiar local (0,5 = em cima dele), para ampliar e cortar em 0,5.
  const margem = new Float32Array(total);
  for (let p = 0; p < total; p++) margem[p] = cobertura[p] - limiarDeBernsen(maior[p], menor[p]) + 0.5;

  const margemGrande = ampliarCampo(margem, largura, altura, fator);
  const diferencaGrande = diferenca ? ampliarCampo(diferenca, largura, altura, fator) : null;
  const indices = new Uint8Array(margemGrande.length);
  for (let p = 0; p < indices.length; p++) {
    if (margemGrande[p] < 0.5) continue;
    indices[p] = diferencaGrande && diferencaGrande[p] < 0 ? 2 : 1;
  }
  return { indices, largura: largura * fator, altura: altura * fator };
}

/**
 * Cobertura de tinta de cada pixel (0 a 1, com a opacidade) e quanto dela é da 1ª tinta (0 a 1).
 * Cada tinta vale pela cor dela mais próxima do pixel, entre as cores da arte que saem nela
 * (`coresDeCada`): a sombra preta de uma letra cromada é da chapa do prata, não da azul. Sobre
 * fundo branco, cada tinta pesa pelo quão perto o pixel está do raio dela (desvioDoRaio) e a
 * cobertura é a de coberturaNoRaio; sem fundo branco, pesa pelo quão perto está da cor dela, e a
 * cobertura é toda (a película é a transparência). Com transparência (PNG), a distância é a das
 * chapas, que olha o matiz antes da claridade (o marinho do X é do azul, não do preto); sem ela,
 * é a soma dos 3 canais: o JPG guarda a cor em blocos de meia resolução, e a distância que pesa o
 * matiz desenhava os blocos (pintas nos cantos de um círculo). As mesmas contas, escritas sem
 * objeto por pixel: são centenas de milhares de pixels, no celular.
 */
function medirMistura(
  rgba: Uint8ClampedArray,
  coresDeCada: Tinta[][],
  fundoBranco: boolean,
  comTransparencia: boolean,
  cobertura: Float32Array,
  partilha: Float32Array,
) {
  const n = coresDeCada.length;
  const cores = coresDeCada.flat();
  const dona = coresDeCada.flatMap((cs, k) => cs.map(() => k));
  // Raio de cada cor, do branco até ela.
  const raioR = cores.map((t) => t.r - BRANCO.r);
  const raioG = cores.map((t) => t.g - BRANCO.g);
  const raioB = cores.map((t) => t.b - BRANCO.b);
  const comprimento2 = cores.map((_, c) => Math.max(1, raioR[c] ** 2 + raioG[c] ** 2 + raioB[c] ** 2));
  const longeDaCor = cores.map((t) => Math.max(1, distanciaEntre(BRANCO, t)));
  const labs = cores.map(oklab);
  const lab = new Float64Array(3);
  const pesoClaridade = comTransparencia ? PESO_CLARIDADE_LIGADA : PESO_CLARIDADE_JPG;
  const pesoCroma = comTransparencia ? PESO_CROMA : PESO_CROMA_JPG;
  const claridades = cores.map((t, c) => (comTransparencia ? labs[c].L : luma(t.r, t.g, t.b)));
  // Por tinta, no pixel da vez: o menor desvio (ou distância) entre as cores dela e a cobertura que
  // ela dá. Perto do branco os raios de uma chapa de dois tons do mesmo matiz (ouro claro e bronze)
  // quase se encontram: o pixel do ouro claro cai às vezes no raio do bronze e sai bronze
  // clareado, pela metade. Vale a maior cobertura entre as cores do matiz da mais perto que
  // explicam o pixel (DESVIO_MISTURA). Matiz diferente na mesma chapa (o amarelo e o vermelho que
  // dividem uma por falta de outra) não empresta: o raio do amarelo engordava o texto vermelho.
  const mesmoMatiz = cores.map((_, x) => cores.map((_, y) => dona[x] === dona[y] && matizesIguais(labs[x], labs[y])));
  // O meio do degradê entre os dois tons não está em raio nenhum: é a mistura dos dois (e do
  // branco, na borda). O pixel é α·tom1 + β·tom2 + o resto de branco, no plano dos dois raios, e a
  // cobertura é α + β. Sem isso a cobertura caía de 1 a 0,77 de um pixel para o outro no meio do
  // degradê, e a ampliação rachava o traço ali.
  const planos = fundoBranco ? planosDosTons(cores, dona, mesmoMatiz, raioR, raioG, raioB) : [];
  const menor = new Float64Array(n);
  const maisPerto = new Int32Array(n);
  const cobre = new Float64Array(n);
  const desvios = new Float64Array(cores.length);
  const coberturas = new Float64Array(cores.length);
  for (let p = 0, i = 0; p < cobertura.length; p++, i += 4) {
    const alfa = rgba[i + 3] / 255;
    menor.fill(Infinity);
    let soma = 0;
    if (!fundoBranco) {
      oklabEm(rgba[i], rgba[i + 1], rgba[i + 2], lab);
      const claridade = comTransparencia ? lab[0] : luma(rgba[i], rgba[i + 1], rgba[i + 2]);
      for (let c = 0; c < cores.length; c++) {
        const d = Math.sqrt(distanciaDeChapa2(claridade, lab[1], lab[2], claridades[c], labs[c].a, labs[c].b, pesoClaridade, pesoCroma));
        if (d < menor[dona[c]]) menor[dona[c]] = d;
      }
      for (let k = 0; k < n; k++) soma += 1 / (menor[k] + FOLGA_LAB);
      cobertura[p] = alfa;
      partilha[p] = 1 / (menor[0] + FOLGA_LAB) / soma;
      continue;
    }
    const vr = rgba[i] - BRANCO.r;
    const vg = rgba[i + 1] - BRANCO.g;
    const vb = rgba[i + 2] - BRANCO.b;
    const v2 = vr * vr + vg * vg + vb * vb;
    const longe = -(vr + vg + vb);
    for (let c = 0; c < cores.length; c++) {
      const t = (vr * raioR[c] + vg * raioG[c] + vb * raioB[c]) / comprimento2[c];
      desvios[c] = Math.sqrt(Math.max(0, v2 - t * t * comprimento2[c]));
      coberturas[c] = Math.min(1, longe / longeDaCor[c]);
      if (desvios[c] < menor[dona[c]]) {
        menor[dona[c]] = desvios[c];
        maisPerto[dona[c]] = c;
      }
    }
    for (let k = 0; k < n; k++) cobre[k] = coberturas[maisPerto[k]];
    for (let c = 0; c < cores.length; c++) {
      const k = dona[c];
      if (mesmoMatiz[maisPerto[k]][c] && desvios[c] <= DESVIO_MISTURA && coberturas[c] > cobre[k]) cobre[k] = coberturas[c];
    }
    for (const plano of planos) {
      const va = vr * plano.a[0] + vg * plano.a[1] + vb * plano.a[2];
      const vb2 = vr * plano.b[0] + vg * plano.b[1] + vb * plano.b[2];
      const alfaA = plano.inversa[0] * va + plano.inversa[1] * vb2;
      const alfaB = plano.inversa[1] * va + plano.inversa[2] * vb2;
      if (alfaA < 0 || alfaB < 0) continue;
      const desvio = Math.sqrt(Math.max(0, v2 - (alfaA * va + alfaB * vb2)));
      if (desvio > DESVIO_MISTURA) continue;
      const k = plano.tinta;
      if (desvio < menor[k]) menor[k] = desvio;
      if (alfaA + alfaB > cobre[k]) cobre[k] = Math.min(1, alfaA + alfaB);
    }
    let coberta = 0;
    for (let k = 0; k < n; k++) {
      const peso = 1 / (menor[k] + FOLGA_DESVIO);
      soma += peso;
      coberta += peso * cobre[k];
    }
    cobertura[p] = (coberta / soma) * alfa;
    partilha[p] = 1 / (menor[0] + FOLGA_DESVIO) / soma;
  }
}

interface PlanoDeTons {
  tinta: number;
  /** Os raios dos dois tons, do branco até eles. */
  a: [number, number, number];
  b: [number, number, number];
  /** Inversa (simétrica: [0][0], [0][1], [1][1]) da matriz dos produtos dos dois raios, para achar α e β. */
  inversa: [number, number, number];
}

/** Ver medirMistura: um plano para cada par de tons da mesma tinta e do mesmo matiz com raios que não são o mesmo. */
function planosDosTons(cores: Tinta[], dona: number[], mesmoMatiz: boolean[][], raioR: number[], raioG: number[], raioB: number[]): PlanoDeTons[] {
  const planos: PlanoDeTons[] = [];
  for (let x = 0; x < cores.length; x++) {
    for (let y = x + 1; y < cores.length; y++) {
      if (!mesmoMatiz[x][y]) continue;
      const a: [number, number, number] = [raioR[x], raioG[x], raioB[x]];
      const b: [number, number, number] = [raioR[y], raioG[y], raioB[y]];
      const aa = a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
      const ab = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const bb = b[0] * b[0] + b[1] * b[1] + b[2] * b[2];
      const det = aa * bb - ab * ab;
      // Raios quase paralelos (dois cinzas): o raio de cada um já explica a mistura.
      if (det <= 1e-3 * aa * bb) continue;
      planos.push({ tinta: dona[x], a, b, inversa: [bb / det, -ab / det, aa / det] });
    }
  }
  return planos;
}

/** Limiar de Bernsen num pixel, dado o maior e o menor valor da vizinhança (ver RAIO_LOCAL_FONTE). */
function limiarDeBernsen(maior: number, menor: number): number {
  const contraste = maior - menor;
  const peso = Math.min(1, Math.max(0, (contraste - CONTRASTE_MIN / 2) / (CONTRASTE_MIN / 2)));
  return 0.5 + peso * (menor + FRACAO_LIMIAR * contraste - 0.5);
}

/**
 * Entre duas tintas, o mesmo limiar de Bernsen da película: traço fino de uma dentro da outra
 * (texto branco miúdo num retângulo navy) não chega a ser só dela e, no meio a meio, sumiria.
 * Só vale onde a vizinhança inteira tem tinta firme (COBERTURA_FIRME, pela menor cobertura local
 * `menorCobertura`): perto da película, o JPG deixa a cor da borda azulada em volta do laranja (a
 * cor dele tem metade da resolução), e o limiar local pintava pintas de navy na borda das letras.
 */
function partilharPeloLimiarLocal(
  cobertura: Float32Array,
  partilha: Float32Array,
  menorCobertura: Float32Array,
  largura: number,
  altura: number,
  raio: number,
): Float32Array {
  const total = largura * altura;
  const maior = janelaExtrema(partilha, largura, altura, raio, Math.max);
  const menor = janelaExtrema(partilha, largura, altura, raio, Math.min);
  const limiar = new Float32Array(total);
  for (let p = 0; p < total; p++) limiar[p] = menorCobertura[p] >= COBERTURA_FIRME ? limiarDeBernsen(maior[p], menor[p]) : 0.5;
  const suave = borrarCaixa(limiar, largura, altura, raio);
  const diferenca = new Float32Array(total);
  for (let p = 0; p < total; p++) diferenca[p] = cobertura[p] * (partilha[p] - suave[p]);
  return diferenca;
}

/**
 * Duas tintas no mesmo raio (preto e cinza): a cor não diz se o pixel cinza é a tinta cinza ou a
 * borda do preto. Decide a vizinhança: perto (RAIO_LOCAL_FONTE) de pixel tão escuro quanto o meio
 * do caminho entre as duas, é borda da escura; senão, é a clara. A cobertura passa a ser a da
 * tinta escolhida (altera `cobertura`).
 */
function partilharPelaVizinhanca(rgba: Uint8ClampedArray, largura: number, altura: number, tintas: Tinta[], raio: number, cobertura: Float32Array): Float32Array {
  const total = largura * altura;
  const escuraPrimeiro = distanciaEntre(BRANCO, tintas[0]) >= distanciaEntre(BRANCO, tintas[1]);
  const [escura, clara] = escuraPrimeiro ? tintas : [tintas[1], tintas[0]];
  const meio = (distanciaEntre(BRANCO, escura) + distanciaEntre(BRANCO, clara)) / 2;
  const longe = new Float32Array(total);
  for (let p = 0; p < total; p++) longe[p] = distancia(BRANCO, rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2]);
  const vizinhoMaisEscuro = janelaExtrema(longe, largura, altura, raio, Math.max);
  const diferenca = new Float32Array(total);
  const longeDaEscura = distanciaEntre(BRANCO, escura);
  const longeDaClara = Math.max(1, distanciaEntre(BRANCO, clara));
  for (let p = 0; p < total; p++) {
    const daEscura = vizinhoMaisEscuro[p] >= meio;
    // coberturaNoRaio, com a distância ao branco já medida
    cobertura[p] = Math.min(1, longe[p] / (daEscura ? longeDaEscura : longeDaClara)) * (rgba[p * 4 + 3] / 255);
    diferenca[p] = cobertura[p] * (daEscura === escuraPrimeiro ? 1 : -1);
  }
  return diferenca;
}

/**
 * Percorre um campo `largura`×`altura` linha a linha e depois coluna a coluna, aplicando `passar`
 * a cada fileira: `base` é o índice do 1º elemento e `passo` a distância entre vizinhos.
 */
function emDuasPassadas(
  campo: Float32Array,
  largura: number,
  altura: number,
  passar: (origem: Float32Array, destino: Float32Array, base: number, passo: number, comprimento: number) => void,
): Float32Array {
  const meio = new Float32Array(campo.length);
  const saida = new Float32Array(campo.length);
  for (let y = 0; y < altura; y++) passar(campo, meio, y * largura, 1, largura);
  for (let x = 0; x < largura; x++) passar(meio, saida, x, largura, altura);
  return saida;
}

/**
 * Máximo (ou mínimo) de cada pixel numa janela quadrada de raio `raio`. Algoritmo de van Herk e
 * Gil-Werman: 3 comparações por pixel, qualquer que seja o raio (que chega a dezenas de pixels
 * em logo pequena ampliada). Fora da imagem não conta.
 */
function janelaExtrema(campo: Float32Array, largura: number, altura: number, raio: number, extremo: typeof Math.max): Float32Array {
  // O mínimo é o máximo dos valores com o sinal trocado.
  const sinal = extremo === Math.max ? 1 : -1;
  const lado = 2 * raio + 1;
  const tamanho = Math.max(largura, altura) + 2 * raio;
  const fileira = new Float32Array(tamanho);
  const ateAqui = new Float32Array(tamanho); // máximo desde o começo do bloco de `lado`
  const daquiAoFim = new Float32Array(tamanho); // máximo até o fim do bloco
  return emDuasPassadas(campo, largura, altura, (origem, destino, base, passo, comprimento) => {
    const m = comprimento + 2 * raio;
    for (let k = 0; k < m; k++) {
      const x = k - raio;
      fileira[k] = x >= 0 && x < comprimento ? sinal * origem[base + x * passo] : -Infinity;
    }
    for (let k = 0; k < m; k++) ateAqui[k] = k % lado === 0 ? fileira[k] : Math.max(ateAqui[k - 1], fileira[k]);
    for (let k = m - 1; k >= 0; k--) daquiAoFim[k] = k === m - 1 || k % lado === lado - 1 ? fileira[k] : Math.max(daquiAoFim[k + 1], fileira[k]);
    // A janela do pixel x vai de x a x + 2·raio na fileira com margem.
    for (let x = 0; x < comprimento; x++) destino[base + x * passo] = sinal * Math.max(daquiAoFim[x], ateAqui[x + 2 * raio]);
  });
}

/** Média numa janela quadrada de raio `raio` (soma corrida, borda repetida): suaviza o limiar local. */
function borrarCaixa(campo: Float32Array, largura: number, altura: number, raio: number): Float32Array {
  const lado = 2 * raio + 1;
  return emDuasPassadas(campo, largura, altura, (origem, destino, base, passo, comprimento) => {
    const em = (k: number) => origem[base + Math.min(comprimento - 1, Math.max(0, k)) * passo];
    let soma = 0;
    for (let k = -raio; k <= raio; k++) soma += em(k);
    for (let x = 0; x < comprimento; x++) {
      destino[base + x * passo] = soma / lado;
      soma += em(x + raio + 1) - em(x - raio);
    }
  });
}

/**
 * Para cada pixel novo de uma fileira ampliada por `fator`: os 4 pixels de apoio na original (borda
 * repetida) e os pesos de Catmull-Rom (bicúbico sem borrar). O centro do pixel novo X cai em
 * (X + 0,5) / fator − 0,5 na original.
 */
function apoiosBicubicos(comprimento: number, fator: number): { indice: Int32Array; peso: Float32Array } {
  const N = comprimento * fator;
  const indice = new Int32Array(N * 4);
  const peso = new Float32Array(N * 4);
  for (let X = 0; X < N; X++) {
    const u = (X + 0.5) / fator - 0.5;
    const x = Math.floor(u);
    const t = u - x;
    const pesos = [0.5 * (-t * t * t + 2 * t * t - t), 0.5 * (3 * t * t * t - 5 * t * t + 2), 0.5 * (-3 * t * t * t + 4 * t * t + t), 0.5 * (t * t * t - t * t)];
    for (let j = 0; j < 4; j++) {
      indice[X * 4 + j] = Math.min(comprimento - 1, Math.max(0, x - 1 + j));
      peso[X * 4 + j] = pesos[j];
    }
  }
  return { indice, peso };
}

/** Amplia um campo por `fator` (inteiro), bicúbico de Catmull-Rom, com a borda repetida. */
function ampliarCampo(campo: Float32Array, largura: number, altura: number, fator: number): Float32Array {
  const L = largura * fator;
  const A = altura * fator;
  const h = apoiosBicubicos(largura, fator);
  const v = apoiosBicubicos(altura, fator);
  const meio = new Float32Array(L * altura);
  for (let y = 0; y < altura; y++) {
    const linha = y * largura;
    const saidaLinha = y * L;
    for (let X = 0, k = 0; X < L; X++, k += 4) {
      meio[saidaLinha + X] =
        campo[linha + h.indice[k]] * h.peso[k] +
        campo[linha + h.indice[k + 1]] * h.peso[k + 1] +
        campo[linha + h.indice[k + 2]] * h.peso[k + 2] +
        campo[linha + h.indice[k + 3]] * h.peso[k + 3];
    }
  }
  const saida = new Float32Array(L * A);
  for (let Y = 0, k = 0; Y < A; Y++, k += 4) {
    const [l0, l1, l2, l3] = [v.indice[k] * L, v.indice[k + 1] * L, v.indice[k + 2] * L, v.indice[k + 3] * L];
    const [p0, p1, p2, p3] = [v.peso[k], v.peso[k + 1], v.peso[k + 2], v.peso[k + 3]];
    const saidaLinha = Y * L;
    for (let X = 0; X < L; X++) saida[saidaLinha + X] = meio[l0 + X] * p0 + meio[l1 + X] * p1 + meio[l2 + X] * p2 + meio[l3 + X] * p3;
  }
  return saida;
}
