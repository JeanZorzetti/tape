/** Helpers de apresentação do /admin — datas em pt-BR e o cálculo de follow-up vencido. */

const FUSO = "America/Sao_Paulo";

/** `proximo_contato` é coluna `date` (UTC puro); `criado_em` é timestamptz (mostrar no fuso local). */
export const dataBR = (d: Date | null, timeZone: string = FUSO) =>
  d ? d.toLocaleDateString("pt-BR", { timeZone }) : "—";

export const isoDe = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export const hojeISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: FUSO });

/* ── Pipelines (004): funis lógicos com etapas próprias mas máquina única ────
   Vive aqui (módulo baixo-nível) e não em crm.ts para evitar o ciclo
   adminUi → crm → adminUi: estaAtrasado depende de TERMINAIS, que deriva daqui. */

export type Pipeline = "inbound" | "recuperacao";
export interface Stage {
  value: string;
  label: string;
}
/** Papéis semânticos 1:1 entre as pipelines — só muda o rótulo/valor da string. */
export interface Roles {
  inicial: string;
  primeiro_toque: string;
  meio: string;
  ganho: string;
  perdido: string;
}

export const PIPELINES: Record<Pipeline, { label: string; stages: readonly Stage[]; roles: Roles }> = {
  inbound: {
    label: "Inbound",
    stages: [
      { value: "novo", label: "Novo" },
      { value: "em_contato", label: "Em contato" },
      { value: "orcado", label: "Orçado" },
      { value: "fechado", label: "Fechado" },
      { value: "perdido", label: "Perdido" },
    ],
    roles: { inicial: "novo", primeiro_toque: "em_contato", meio: "orcado", ganho: "fechado", perdido: "perdido" },
  },
  recuperacao: {
    label: "Recuperação",
    stages: [
      { value: "a_contatar", label: "A contatar" },
      { value: "contatado", label: "Contatado" },
      { value: "interessado", label: "Interessado" },
      { value: "recuperado", label: "Recuperado" },
      { value: "descartado", label: "Descartado" },
    ],
    roles: { inicial: "a_contatar", primeiro_toque: "contatado", meio: "interessado", ganho: "recuperado", perdido: "descartado" },
  },
};

export const isPipeline = (v: string): v is Pipeline => v === "inbound" || v === "recuperacao";
export const statusesDaPipeline = (p: Pipeline) => PIPELINES[p].stages;
export const rolesDaPipeline = (p: Pipeline) => PIPELINES[p].roles;

/** Todos os status ganho+perdido das duas pipelines — quem está num deles não é "vivo". */
export const TERMINAIS: ReadonlySet<string> = new Set(
  Object.values(PIPELINES).flatMap((p) => [p.roles.ganho, p.roles.perdido]),
);

/** Valida um status; com `pipeline`, exige que pertença àquela pipeline. Sem ela, aceita de qualquer. */
export const isStatus = (v: string, pipeline?: Pipeline): boolean =>
  pipeline
    ? PIPELINES[pipeline].stages.some((s) => s.value === v)
    : Object.values(PIPELINES).some((p) => p.stages.some((s) => s.value === v));

/** Rótulo global — os valores não colidem entre pipelines, então um lookup único basta. */
export const statusLabel = (v: string): string => {
  for (const p of Object.values(PIPELINES)) {
    const s = p.stages.find((st) => st.value === v);
    if (s) return s.label;
  }
  return v;
};

/** Vencido = data marcada já passou e o lead ainda está vivo (fora dos terminais de qualquer pipeline). */
export const estaAtrasado = (proximoContato: Date | null, status: string, hoje: string) =>
  !!proximoContato && isoDe(proximoContato) <= hoje && !TERMINAIS.has(status);

export const CLS_STATUS: Record<string, string> = {
  novo: "bg-orange/15 text-orange-800",
  em_contato: "bg-navy/10 text-navy",
  orcado: "bg-kraft/30 text-ink",
  fechado: "bg-[#1b7f4b]/12 text-[#1b7f4b]",
  perdido: "bg-steel/15 text-steel",
  a_contatar: "bg-orange/15 text-orange-800",
  contatado: "bg-navy/10 text-navy",
  interessado: "bg-kraft/30 text-ink",
  recuperado: "bg-[#1b7f4b]/12 text-[#1b7f4b]",
  descartado: "bg-steel/15 text-steel",
};

/* ── CRM de vendas (003): taxonomias, cadência, carteira, funil ─────────────
   Fonte única das listas do CRM, no mesmo formato de STATUS_LEAD. */

export const NICHOS = [
  { value: "industria", label: "Indústria" },
  { value: "distribuidor", label: "Distribuidor" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "lojas", label: "Lojas" },
  { value: "outro", label: "Outro" },
] as const;

export const CANAIS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telefone", label: "Telefone" },
  { value: "email", label: "E-mail" },
] as const;

export const RESULTADOS = [
  { value: "sem_resposta", label: "Sem resposta" },
  { value: "respondeu", label: "Respondeu" },
  { value: "remarcar", label: "Remarcar" },
] as const;

/** Dias corridos, contados da entrada do lead, de cada um dos 6 toques.
 *  ponytail: cadência fixa em array; se precisar de mais de uma régua, vira tabela. */
export const CADENCIA_DIAS = [0, 1, 3, 7, 14, 21] as const;

/** ponytail: intervalo fixo; vira campo por cliente se a carteira exigir cadências diferentes. */
export const RECONTATO_CARTEIRA_DIAS = 30;

export const isCanal = (v: string) => CANAIS.some((c) => c.value === v);
export const isResultado = (v: string) => RESULTADOS.some((r) => r.value === v);
export const isNicho = (v: string) => NICHOS.some((n) => n.value === v);

export const nichoLabel = (v: string | null) =>
  v ? NICHOS.find((n) => n.value === v)?.label ?? v : "Sem nicho";

/** Data sugerida do próximo toque: base + CADENCIA_DIAS[nToques]. null quando a cadência esgota. */
export function proximaDataCadencia(nToques: number, baseISO: string): string | null {
  if (nToques < 0 || nToques >= CADENCIA_DIAS.length) return null;
  const d = new Date(`${baseISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + CADENCIA_DIAS[nToques]);
  return d.toISOString().slice(0, 10);
}

/** True quando os 6 toques já foram dados — a UI sugere marcar "Perdido" (sem marcar sozinho). */
export const cadenciaEsgotada = (nToques: number) => nToques >= CADENCIA_DIAS.length;

/** Recontato de carteira vencido = é cliente (tem pedido) e a data marcada já passou. */
export const vencidoCarteira = (proximoContato: Date | null, temPedido: boolean, hoje: string) =>
  temPedido && !!proximoContato && isoDe(proximoContato) <= hoje;

/** "R$ 1.234,50" para centavos inteiros; "—" quando ausente. Money path: nunca float acumulado. */
export function formatarBRL(centavos: number | null): string {
  if (centavos == null) return "—";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Reais digitados (formato BR "1.234,50") → centavos inteiros. Tolerante; vazio/ilegível → null. */
export function reaisParaCentavos(entrada: string): number | null {
  // BR: ponto é milhar, vírgula é decimal. Descarta R$, espaços e o que não for dígito/decimal.
  const limpo = entrada.trim().replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
  if (!limpo) return null; // sem nenhum dígito ("abc", "", "R$") → não grava valor
  const num = Number(limpo);
  return Number.isFinite(num) ? Math.round(num * 100) : null;
}

export type Periodo = "mes" | "ano" | "tudo";

/** Início da coorte do funil. null = "tudo" (sem corte).
 *  ponytail: fronteira em UTC; off-by-3h no vira-mês é irrelevante para coorte operacional. */
export function inicioPeriodo(periodo: string): Date | null {
  const agora = new Date();
  if (periodo === "tudo") return null;
  if (periodo === "ano") return new Date(Date.UTC(agora.getUTCFullYear(), 0, 1));
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)); // default 'mes'
}

export interface FunilCounts {
  totalLeads: number;
  chegaramEmContato: number;
  chegaramOrcado: number;
  chegaramFechado: number;
  fechadoDesdeEmContato: number; // chegaram a 'fechado' E a 'em_contato'
  fechadoDesdeOrcado: number; // chegaram a 'fechado' E a 'orcado'
}

/** As três taxas de conversão por coorte. Divisor zero → null (a UI mostra "—", nunca NaN). */
export function taxasFunil(c: FunilCounts) {
  const taxa = (num: number, den: number) => (den > 0 ? num / den : null);
  return {
    taxaLeadFechado: taxa(c.chegaramFechado, c.totalLeads),
    taxaEmContatoFechado: taxa(c.fechadoDesdeEmContato, c.chegaramEmContato),
    taxaOrcadoFechado: taxa(c.fechadoDesdeOrcado, c.chegaramOrcado),
  };
}

/* ── Projeção de vendas da prospecção ativa (outbound) ───────────────────────
   Modela o funil e a receita de uma lista de leads a partir de três taxas por
   cenário. Taxas ancoradas em benchmark de outbound B2B 2025–26 (WhatsApp no
   Brasil é canal quente, mas lista fria + cadência de 6 toques seguram o realista
   em 25% de resposta). Ticket = preços reais de goiania.roilabs.com.br (mínimo de
   20 rolos / R$404 na personalizada), blended por mix de produto.
   ponytail: modelo linear de 3 taxas com constantes; quando a operação medir as
   taxas reais (o funil por coorte já registra), trocar estas premissas por elas. */

export interface CenarioProjecao {
  id: string;
  label: string;
  resposta: number; // contato → resposta
  respOrcamento: number; // resposta → orçamento
  orcFechado: number; // orçamento → fechado (win rate)
  ticketCentavos: number; // ticket médio do 1º pedido, blended
}

export const CENARIOS_PROJECAO: readonly CenarioProjecao[] = [
  { id: "conservador", label: "Conservador", resposta: 0.15, respOrcamento: 0.3, orcFechado: 0.2, ticketCentavos: 70_000 },
  { id: "realista", label: "Realista", resposta: 0.25, respOrcamento: 0.4, orcFechado: 0.3, ticketCentavos: 110_000 },
  { id: "otimista", label: "Otimista", resposta: 0.4, respOrcamento: 0.5, orcFechado: 0.4, ticketCentavos: 190_000 },
] as const;

/** Vendas extras ao enriquecer os leads sem canal (fase 2), como fração das vendas da base contatável. */
export const UPLIFT_ENRIQUECIMENTO = 0.3;
/** Fita é consumível de alto giro: 1º pedido + N recompras no ano 1 (recompra ~ ticket; clichê já pago). */
export const RECOMPRAS_ANO1 = 3;

export interface ProjecaoCenario {
  respostas: number;
  orcamentos: number;
  vendasBase: number; // só a base contatável
  vendas: number; // base + enriquecimento
  receitaPrimeiroPedido: number; // centavos, 1º pedido no ciclo
  receitaAno1: number; // centavos, com recompra da carteira
}

/** Projeta funil e receita para uma base contatável num cenário. Puro — sem I/O. */
export function projetarCenario(contataveis: number, c: CenarioProjecao): ProjecaoCenario {
  const respostas = contataveis * c.resposta;
  const orcamentos = respostas * c.respOrcamento;
  const vendasBase = orcamentos * c.orcFechado;
  const vendas = vendasBase * (1 + UPLIFT_ENRIQUECIMENTO);
  const receitaPrimeiroPedido = Math.round(vendas * c.ticketCentavos);
  const receitaAno1 = receitaPrimeiroPedido * (1 + RECOMPRAS_ANO1);
  return { respostas, orcamentos, vendasBase, vendas, receitaPrimeiroPedido, receitaAno1 };
}

/** As MESMAS três taxas que o funil real (`taxasFunil`) expõe — todas rumo ao ganho — mas derivadas
 *  das premissas do cenário. Faz a projeção falar a língua do funil: a meta encaixa ao lado do medido.
 *  Lead→ganho é a composição das três etapas; primeiro_toque→ganho tira a 1ª; meio→ganho é a última. */
export function taxasMetaFunil(c: CenarioProjecao) {
  return {
    taxaLeadFechado: c.resposta * c.respOrcamento * c.orcFechado,
    taxaEmContatoFechado: c.respOrcamento * c.orcFechado,
    taxaOrcadoFechado: c.orcFechado,
  };
}
