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
