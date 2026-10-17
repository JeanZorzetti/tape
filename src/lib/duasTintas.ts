/**
 * Separação da logo anexada em até 2 tintas, como o clichê faz na fita real: cada cor da arte
 * vira uma chapa, e a fita imprime no máximo 2. Degradê vira a cor média dele; o fundo (branco
 * ou transparente) vira película sem tinta. A saída alimenta a vetorização (imagetracerjs).
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
/** Folga (RGB) no peso de cada tinta pela distância ao raio dela: sem isso, o pixel exato no raio levaria peso infinito. */
const FOLGA_DESVIO = 4;
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

/**
 * As até 2 tintas da logo, a de maior área primeiro. Cores parecidas viram uma só; com mais de
 * 2 cores, ficam as 2 que mais cobrem a logo (as outras saem na tinta mais próxima, na
 * separação). Logo sem tinta nenhuma devolve lista vazia.
 */
export function tintasDaLogo(rgba: Uint8ClampedArray, largura: number, altura: number, fundoBranco: boolean, escalaFonte = 1): Tinta[] {
  const { todas, planos, largos, transparente } = amostrar(rgba, largura, altura, fundoBranco, escalaFonte);
  if (todas.length === 0) return [];
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

  const area = areaDeCada(candidatas.map((g) => g.cor), todas, rgba, fundoBranco);
  return candidatas
    .map((g, k) => ({ cor: g.cor, area: area[k] }))
    .sort((a, b) => b.area - a.area)
    .slice(0, 2)
    .map((g) => g.cor);
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
  { escalaFonte, fator }: OpcoesSeparacao,
): GradeDeTintas {
  const total = largura * altura;
  const raio = raioEmPixels(RAIO_LOCAL_FONTE, escalaFonte);
  const cobertura = new Float32Array(total);
  // Quanto da tinta do pixel é da 1ª (0 a 1). Com uma tinta só, não é usada.
  const partilha = new Float32Array(total);
  medirMistura(rgba, tintas, fundoBranco, cobertura, partilha);
  const colineares = fundoBranco && tintas.length === 2 && naReta(tintas[1], BRANCO, tintas[0]).desvio <= DESVIO_COLINEAR;
  // Positivo = 1ª tinta, negativo = 2ª, pesado pela cobertura (na película a partilha não pesa).
  // A das tintas no mesmo raio redefine a cobertura: vem antes do limiar.
  let diferenca = tintas.length === 2 && colineares ? partilharPelaVizinhanca(rgba, largura, altura, tintas, raio, cobertura) : null;
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
 * Sobre fundo branco, cada tinta pesa pelo quão perto o pixel está do raio dela (desvioDoRaio) e
 * a cobertura é a de coberturaNoRaio; sem fundo branco, pesa pelo quão perto está da cor dela, e
 * a cobertura é toda (a película é a transparência). As mesmas contas, escritas sem objeto por
 * pixel: são centenas de milhares de pixels, no celular.
 */
function medirMistura(rgba: Uint8ClampedArray, tintas: Tinta[], fundoBranco: boolean, cobertura: Float32Array, partilha: Float32Array) {
  const n = tintas.length;
  // Raio de cada tinta, do branco até ela.
  const raioR = tintas.map((t) => t.r - BRANCO.r);
  const raioG = tintas.map((t) => t.g - BRANCO.g);
  const raioB = tintas.map((t) => t.b - BRANCO.b);
  const comprimento2 = tintas.map((_, k) => Math.max(1, raioR[k] ** 2 + raioG[k] ** 2 + raioB[k] ** 2));
  const longeDaTinta = tintas.map((t) => Math.max(1, distanciaEntre(BRANCO, t)));
  for (let p = 0, i = 0; p < cobertura.length; p++, i += 4) {
    const alfa = rgba[i + 3] / 255;
    let soma = 0;
    let cobre = 0;
    let primeira = 0;
    if (!fundoBranco) {
      for (let k = 0; k < n; k++) {
        const peso = 1 / (Math.abs(rgba[i] - tintas[k].r) + Math.abs(rgba[i + 1] - tintas[k].g) + Math.abs(rgba[i + 2] - tintas[k].b) + 1);
        soma += peso;
        if (k === 0) primeira = peso;
      }
      cobertura[p] = alfa;
      partilha[p] = primeira / soma;
      continue;
    }
    const vr = rgba[i] - BRANCO.r;
    const vg = rgba[i + 1] - BRANCO.g;
    const vb = rgba[i + 2] - BRANCO.b;
    const v2 = vr * vr + vg * vg + vb * vb;
    const longe = -(vr + vg + vb);
    for (let k = 0; k < n; k++) {
      const t = (vr * raioR[k] + vg * raioG[k] + vb * raioB[k]) / comprimento2[k];
      const desvio = Math.sqrt(Math.max(0, v2 - t * t * comprimento2[k]));
      const peso = 1 / (desvio + FOLGA_DESVIO);
      soma += peso;
      cobre += peso * Math.min(1, longe / longeDaTinta[k]);
      if (k === 0) primeira = peso;
    }
    cobertura[p] = (cobre / soma) * alfa;
    partilha[p] = primeira / soma;
  }
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
