/*
 * A fita costurando a home (CosturaDeFita + FitaFinal): cada pedaço é colado conforme a
 * emenda dele sobe pela tela, com a ponta erguida correndo à frente. O progresso é função
 * da rolagem, não do tempo: parou de rolar, a fita para; rolou para cima, ela descola.
 *
 * Sem este script (ou com movimento reduzido) as tiras ficam como o CSS as deixa: coladas.
 */

/** Janela de cada emenda, em frações da altura da tela: começa a colar aqui... */
const COMECO_DA_COSTURA = 0.92;
/** ...e termina aqui. Meia tela de rolagem, dentro dos 30–60vh de um gesto de scroll. */
const FIM_DA_COSTURA = 0.42;
/** O botão final termina de assentar até esta fração, ou antes do fim da página. */
const FIM_DA_FITA_FINAL = 0.58;
const CURSO_MINIMO_DA_FITA_FINAL = 0.32;
/** No último trecho, a ponta já chegou e só deita sobre o botão. */
const ASSENTAR_A_PARTIR_DE = 0.86;
/** Amortecimento do progresso: a fita acompanha a rolagem com um pouco de peso. */
const AMORTECIMENTO_S = 0.14;
/** A ponta curva em dois gomos: o primeiro dobra pouco, o segundo dobra o resto. */
const GIRO_MAXIMO_DA_PONTA_GRAUS = 64;
const PARTE_DO_GIRO_NO_PRIMEIRO_GOMO = 0.36;
const PERSPECTIVA_EM_ESPESSURAS = 6;
const LUZ_MAXIMA_NA_PONTA = 0.85;
const SOMBRA_MAXIMA = 0.6;
/** Quanto da janela a ponta leva para erguer no começo e para deitar no fim das emendas. */
const RAMPA_DA_PONTA = 0.06;
const SOBREPOSICAO_NA_DOBRADICA_PX = 2;
/** Abaixo disso a fita já chegou: para o laço de quadros em vez de amortecer para sempre. */
const PRECISAO_DO_PROGRESSO = 0.001;

interface Pedaco {
  raiz: HTMLElement;
  revela: HTMLElement;
  ponta: HTMLElement;
  pontaFim: HTMLElement;
  conteudo: HTMLElement;
  conteudoFim: HTMLElement;
  luz: HTMLElement;
  sombra: HTMLElement;
  /** 1: puxada para a direita; -1: para a esquerda. */
  sentido: 1 | -1;
  final: boolean;
  /** Altura da emenda (ou do centro do botão) no documento. */
  y: number;
  comprimento: number;
  /** Comprimento de um gomo da ponta; a ponta inteira tem dois. */
  gomo: number;
  espessura: number;
  /** Comprimento de uma repetição da arte; 0 quando a tira não é periódica (a final). */
  periodo: number;
  comeco: number;
  fim: number;
  progresso: number;
  alvo: number;
  focado: boolean;
}

const entre = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const suave = (t: number) => t * t * (3 - 2 * t);

function montar(raiz: HTMLElement): Pedaco {
  const final = raiz.hasAttribute("data-fita-final");
  return {
    raiz,
    revela: raiz.querySelector<HTMLElement>("[data-revela]")!,
    ponta: raiz.querySelector<HTMLElement>("[data-ponta]")!,
    pontaFim: raiz.querySelector<HTMLElement>("[data-ponta-fim]")!,
    conteudo: raiz.querySelector<HTMLElement>("[data-conteudo]")!,
    conteudoFim: raiz.querySelector<HTMLElement>("[data-conteudo-fim]")!,
    luz: raiz.querySelector<HTMLElement>("[data-luz]")!,
    sombra: raiz.querySelector<HTMLElement>("[data-sombra]")!,
    sentido: final || raiz.dataset.sentido === "esquerda" ? -1 : 1,
    final,
    y: 0,
    comprimento: 1,
    gomo: 1,
    espessura: 1,
    periodo: 0,
    comeco: COMECO_DA_COSTURA,
    fim: FIM_DA_COSTURA,
    progresso: -1,
    alvo: 0,
    focado: false,
  };
}

function medir(pedacos: Pedaco[]) {
  const altura = innerHeight;
  const limiteDaRolagem = Math.max(0, document.documentElement.scrollHeight - altura);
  for (const p of pedacos) {
    p.comprimento = p.revela.offsetWidth;
    p.gomo = p.ponta.offsetWidth;
    p.espessura = p.ponta.offsetHeight;
    p.periodo = p.final ? 0 : (p.revela.querySelector<HTMLElement>(".impressao__unidade")?.offsetWidth ?? 0);
    const caixa = p.raiz.getBoundingClientRect();
    p.y = caixa.top + scrollY + (p.final ? caixa.height / 2 : 0);
    if (p.final) {
      // O botão precisa estar inteiro antes da rolagem acabar, mesmo com rodapé curto.
      const naTelaNoFim = (p.y - limiteDaRolagem) / altura;
      p.fim = Math.max(FIM_DA_FITA_FINAL, naTelaNoFim + 0.01);
      p.comeco = Math.max(p.fim + CURSO_MINIMO_DA_FITA_FINAL, COMECO_DA_COSTURA);
    }
  }
}

function alvoDe(p: Pedaco, rolagem: number, altura: number): number {
  if (p.focado) return 1;
  const naTela = (p.y - rolagem) / altura;
  return suave(entre((p.comeco - naTela) / (p.comeco - p.fim), 0, 1));
}

// Onde a arte da tira está na posição s: a cópia dentro da ponta é curta e periódica,
// então basta o resto da divisão pelo período; a final não repete e anda inteira.
function deslocamentoDaArte(p: Pedaco, s: number): number {
  return p.periodo > 0 ? s % p.periodo : s;
}

function erguidaEm(p: Pedaco): number {
  const subindo = suave(entre(p.progresso / RAMPA_DA_PONTA, 0, 1));
  const inicioDaDescida = p.final ? ASSENTAR_A_PARTIR_DE : 1 - RAMPA_DA_PONTA;
  const descendo = suave(entre((p.progresso - inicioDaDescida) / (1 - inicioDaDescida), 0, 1));
  return subindo * (1 - descendo);
}

// Coordenadas ao longo da tira, a partir da ponta por onde a fita entra. A borda de
// ataque (a serrilha) percorre a tira; o que ficou para trás da dobradiça está colado.
function aplicar(p: Pedaco) {
  const { comprimento, gomo, espessura, sentido, progresso } = p;
  const ponta = gomo * 2;
  const viagem = p.final ? entre(progresso / ASSENTAR_A_PARTIR_DE, 0, 1) : progresso;
  const percurso = p.final ? comprimento : comprimento + ponta;
  const colado = Math.max(0, viagem * percurso - ponta);
  const terminou = progresso >= 1 && p.final;
  const erguida = erguidaEm(p);

  // A tira colada entra um pouco por baixo da dobradiça: sem isso sobra um fio de fundo
  // entre ela e a ponta, no arredondamento dos subpixels.
  const descoberto = `${Math.max(0, comprimento - colado - SOBREPOSICAO_NA_DOBRADICA_PX)}px`;
  p.revela.style.clipPath = terminou
    ? ""
    : sentido > 0
      ? `inset(-2rem ${descoberto} -2rem 0)`
      : `inset(-2rem 0 -2rem ${descoberto})`;

  // O primeiro gomo nasce na dobradiça; o segundo, com a serrilha, continua depois dele.
  const inicioDoGomo = sentido > 0 ? colado : comprimento - colado - gomo;
  const inicioDoFim = sentido > 0 ? colado + gomo : comprimento - colado - ponta;
  const giro = -sentido * erguida * GIRO_MAXIMO_DA_PONTA_GRAUS;
  p.ponta.style.visibility = progresso <= 0 || terminou ? "hidden" : "visible";
  p.ponta.style.transform =
    `translate3d(${inicioDoGomo}px, 0, 0) perspective(${espessura * PERSPECTIVA_EM_ESPESSURAS}px) rotateY(${giro * PARTE_DO_GIRO_NO_PRIMEIRO_GOMO}deg)`;
  p.pontaFim.style.transform = `rotateY(${giro * (1 - PARTE_DO_GIRO_NO_PRIMEIRO_GOMO)}deg)`;
  p.conteudo.style.transform = `translate3d(${-deslocamentoDaArte(p, inicioDoGomo)}px, 0, 0)`;
  p.conteudoFim.style.transform = `translate3d(${-deslocamentoDaArte(p, inicioDoFim)}px, 0, 0)`;
  p.luz.style.opacity = String(erguida * LUZ_MAXIMA_NA_PONTA);

  // A sombra cai à frente e abaixo da ponta, maior quanto mais ela se ergue.
  const avanco = sentido * erguida * gomo * 0.6;
  const inicioDaSombra = sentido > 0 ? colado : comprimento - colado - ponta;
  p.sombra.style.transform =
    `translate3d(${inicioDaSombra + avanco}px, ${erguida * espessura * 0.34}px, 0) scale(${0.75 + 0.45 * erguida})`;
  p.sombra.style.opacity = String(progresso <= 0 || terminou ? 0 : erguida * SOMBRA_MAXIMA);
}

function iniciar() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const pedacos = [...document.querySelectorAll<HTMLElement>("[data-costura], [data-fita-final]")].map(montar);
  if (!pedacos.length) return;

  let quadro = 0;
  let ultimo = 0;
  let primeiro = true;

  const passo = (agora: number) => {
    quadro = 0;
    const dt = ultimo ? Math.min((agora - ultimo) / 1000, 0.1) : 1 / 60;
    ultimo = agora;
    const altura = innerHeight;
    const rolagem = scrollY;
    const fator = 1 - Math.exp(-dt / AMORTECIMENTO_S);
    let mexendo = false;
    for (const p of pedacos) {
      p.alvo = alvoDe(p, rolagem, altura);
      // Na carga (ou num salto de âncora) a fita já está onde a rolagem manda, sem animar.
      const proximo = primeiro ? p.alvo : p.progresso + (p.alvo - p.progresso) * fator;
      const assentou = Math.abs(p.alvo - proximo) < PRECISAO_DO_PROGRESSO;
      const novo = assentou ? p.alvo : proximo;
      if (!assentou) mexendo = true;
      if (novo !== p.progresso) {
        p.progresso = novo;
        aplicar(p);
      }
    }
    primeiro = false;
    if (mexendo) quadro = requestAnimationFrame(passo);
    else ultimo = 0;
  };
  const pedir = () => {
    quadro ||= requestAnimationFrame(passo);
  };
  const remedir = () => {
    medir(pedacos);
    for (const p of pedacos) aplicar(p);
    pedir();
  };

  medir(pedacos);
  passo(performance.now());
  addEventListener("scroll", pedir, { passive: true });
  new ResizeObserver(remedir).observe(document.body);

  // Quem chega ao botão pelo teclado encontra a fita inteira, mesmo antes de rolar até ela.
  for (const p of pedacos.filter((pedaco) => pedaco.final)) {
    const botao = p.raiz.querySelector<HTMLElement>("[data-botao]");
    botao?.addEventListener("focus", () => {
      p.focado = true;
      p.progresso = 1;
      aplicar(p);
    });
    botao?.addEventListener("blur", () => {
      p.focado = false;
      pedir();
    });
  }
}

iniciar();
