/** Helpers de apresentação do /admin — datas em pt-BR e o cálculo de follow-up vencido. */

const FUSO = "America/Sao_Paulo";

/** `proximo_contato` é coluna `date` (UTC puro); `criado_em` é timestamptz (mostrar no fuso local). */
export const dataBR = (d: Date | null, timeZone: string = FUSO) =>
  d ? d.toLocaleDateString("pt-BR", { timeZone }) : "—";

export const isoDe = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export const hojeISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: FUSO });

/** Vencido = data marcada já passou e o lead ainda está vivo. */
export const estaAtrasado = (proximoContato: Date | null, status: string, hoje: string) =>
  !!proximoContato && isoDe(proximoContato) <= hoje && status !== "fechado" && status !== "perdido";

export const CLS_STATUS: Record<string, string> = {
  novo: "bg-orange/15 text-orange-800",
  em_contato: "bg-navy/10 text-navy",
  orcado: "bg-kraft/30 text-ink",
  fechado: "bg-[#1b7f4b]/12 text-[#1b7f4b]",
  perdido: "bg-steel/15 text-steel",
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
