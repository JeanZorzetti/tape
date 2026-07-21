import postgres from "postgres";

/**
 * Camada de dados do CRM: conexão, schema, status e as consultas do /admin.
 *
 * ponytail: sem ORM e sem ferramenta de migration — 3 tabelas que quase não mudam.
 * O schema é aplicado uma vez por processo, na primeira consulta (CREATE TABLE IF NOT EXISTS).
 * Se o schema começar a evoluir de verdade, trocar por migrations numeradas.
 */

export const STATUS_LEAD = [
  { value: "novo", label: "Novo" },
  { value: "em_contato", label: "Em contato" },
  { value: "orcado", label: "Orçado" },
  { value: "fechado", label: "Fechado" },
  { value: "perdido", label: "Perdido" },
] as const;

export type StatusLead = (typeof STATUS_LEAD)[number]["value"];

export const isStatus = (v: string): v is StatusLead => STATUS_LEAD.some((s) => s.value === v);

export const statusLabel = (v: string) => STATUS_LEAD.find((s) => s.value === v)?.label ?? v;

export interface Lead {
  id: number;
  nome: string;
  empresa: string;
  email: string;
  telefone: string;
  cnpj: string | null;
  tipo_fita: string;
  quantidade: string;
  mensagem: string | null;
  origem: string | null;
  status: StatusLead;
  proximo_contato: Date | null;
  criado_em: Date;
}

export interface Nota {
  id: number;
  lead_id: number;
  texto: string;
  criado_em: Date;
}

export interface Usuario {
  id: number;
  email: string;
  senha_hash: string;
}

let cliente: postgres.Sql | undefined;
let schemaPronto: Promise<void> | undefined;

function conectar() {
  const url = process.env.DATABASE_URL ?? import.meta.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada — o /admin precisa do Postgres.");
  return postgres(url, { max: 5 });
}

async function aplicarSchema(sql: postgres.Sql) {
  await sql`
    create table if not exists usuarios (
      id serial primary key,
      email text not null unique,
      senha_hash text not null,
      criado_em timestamptz not null default now()
    )`;
  await sql`
    create table if not exists leads (
      id serial primary key,
      nome text not null,
      empresa text not null,
      email text not null,
      telefone text not null,
      cnpj text,
      tipo_fita text not null,
      quantidade text not null,
      mensagem text,
      origem text,
      status text not null default 'novo',
      proximo_contato date,
      criado_em timestamptz not null default now()
    )`;
  await sql`
    create table if not exists notas (
      id serial primary key,
      lead_id integer not null references leads(id) on delete cascade,
      texto text not null,
      criado_em timestamptz not null default now()
    )`;
  await sql`create index if not exists leads_criado_em_idx on leads (criado_em desc)`;
}

/** Conexão pronta para uso (schema garantido). Lazy: o build estático nunca toca no banco. */
export async function db() {
  cliente ??= conectar();
  schemaPronto ??= aplicarSchema(cliente);
  await schemaPronto;
  return cliente;
}

export interface NovoLead {
  nome: string;
  empresa: string;
  email: string;
  telefone: string;
  cnpj?: string | null;
  tipo_fita: string;
  quantidade: string;
  mensagem?: string | null;
  origem?: string | null;
}

export async function inserirLead(lead: NovoLead) {
  const sql = await db();
  const [row] = await sql<{ id: number }[]>`
    insert into leads ${sql(lead as Record<string, unknown>)} returning id`;
  return row.id;
}

/** Lista com filtro opcional de status e busca livre por nome/empresa/e-mail. */
export async function listarLeads(filtro: { status?: string; busca?: string } = {}) {
  const sql = await db();
  const status = filtro.status && isStatus(filtro.status) ? filtro.status : null;
  const busca = filtro.busca?.trim() ? `%${filtro.busca.trim()}%` : null;
  return sql<Lead[]>`
    select * from leads
    where (${status}::text is null or status = ${status})
      and (${busca}::text is null or nome ilike ${busca} or empresa ilike ${busca} or email ilike ${busca})
    order by criado_em desc
    limit 300`;
}

export async function contarPorStatus() {
  const sql = await db();
  const linhas = await sql<{ status: string; total: string }[]>`
    select status, count(*) as total from leads group by status`;
  return Object.fromEntries(linhas.map((l) => [l.status, Number(l.total)])) as Record<string, number>;
}

/** Leads com follow-up marcado para hoje ou antes — o que não pode ser esquecido. */
export async function contarAtrasados() {
  const sql = await db();
  const [row] = await sql<{ total: string }[]>`
    select count(*) as total from leads
    where proximo_contato is not null and proximo_contato <= current_date
      and status not in ('fechado', 'perdido')`;
  return Number(row.total);
}

export async function buscarLead(id: number) {
  const sql = await db();
  const [lead] = await sql<Lead[]>`select * from leads where id = ${id}`;
  if (!lead) return null;
  const notas = await sql<Nota[]>`select * from notas where lead_id = ${id} order by criado_em desc`;
  return { lead, notas };
}

export async function atualizarLead(id: number, status: StatusLead, proximoContato: string | null) {
  const sql = await db();
  await sql`
    update leads set status = ${status}, proximo_contato = ${proximoContato}
    where id = ${id}`;
}

export async function adicionarNota(leadId: number, texto: string) {
  const sql = await db();
  await sql`insert into notas (lead_id, texto) values (${leadId}, ${texto})`;
}

export async function buscarUsuario(email: string) {
  const sql = await db();
  const [u] = await sql<Usuario[]>`select * from usuarios where email = ${email.toLowerCase()}`;
  return u ?? null;
}

export async function contarUsuarios() {
  const sql = await db();
  const [row] = await sql<{ total: string }[]>`select count(*) as total from usuarios`;
  return Number(row.total);
}

export async function criarUsuario(email: string, senhaHash: string) {
  const sql = await db();
  const [u] = await sql<Usuario[]>`
    insert into usuarios (email, senha_hash) values (${email.toLowerCase()}, ${senhaHash})
    returning *`;
  return u;
}
