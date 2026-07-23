import postgres from "postgres";
import {
  PIPELINES,
  RECONTATO_CARTEIRA_DIAS,
  inicioPeriodo,
  isNicho,
  isStatus,
  rolesDaPipeline,
  taxasFunil,
} from "./adminUi.ts";
import type { Pipeline } from "./adminUi.ts";

/**
 * Camada de dados do CRM: conexão, schema, status e as consultas do /admin.
 *
 * ponytail: sem ORM e sem ferramenta de migration — 3 tabelas que quase não mudam.
 * O schema é aplicado uma vez por processo, na primeira consulta (CREATE TABLE IF NOT EXISTS).
 * Se o schema começar a evoluir de verdade, trocar por migrations numeradas.
 */

// Taxonomia de status vem de PIPELINES (adminUi) — reexportada para compat com os imports atuais.
export { isStatus, statusLabel } from "./adminUi.ts";
export type { Pipeline } from "./adminUi.ts";
export const STATUS_LEAD = PIPELINES.inbound.stages; // compat: consumidores antigos = inbound
export type StatusLead = string;

export interface Lead {
  id: number;
  nome: string | null;
  empresa: string;
  email: string;
  telefone: string;
  cnpj: string | null;
  tipo_fita: string | null;
  quantidade: string | null;
  mensagem: string | null;
  origem: string | null;
  status: string;
  proximo_contato: Date | null;
  nicho: string | null;
  pipeline: Pipeline;
  dados_import: Record<string, string> | null;
  criado_em: Date;
}

export interface Nota {
  id: number;
  lead_id: number;
  texto: string;
  criado_em: Date;
}

export interface Tentativa {
  id: number;
  lead_id: number;
  canal: string;
  resultado: string;
  observacao: string | null;
  criado_em: Date;
}

export interface Pedido {
  id: number;
  lead_id: number;
  data: Date;
  valor_centavos: number | null;
  volume_rolos: number | null;
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

// Chave arbitrária do lock consultivo que serializa o bootstrap do schema.
const SCHEMA_LOCK_KEY = 827413;

/**
 * Sentinela barata (sem lock em `leads`): se a última coluna adicionada existe, o schema já está
 * aplicado. Evita re-rodar o DDL a cada bootstrap — o DDL tranca `leads` em ACCESS EXCLUSIVE por
 * toda a transação de bootstrap e deadlockaria com escritas normais (FK em `leads`) de outro
 * processo que já subiu. Atualizar a coluna-sentinela quando uma nova migração for adicionada.
 */
async function schemaAtual(sql: postgres.ISql) {
  const [row] = await sql<{ ok: number }[]>`
    select 1 as ok from information_schema.columns
    where table_name = 'leads' and column_name = 'import_ref' limit 1`;
  return !!row;
}

async function aplicarSchema(sql: postgres.Sql) {
  // Steady state (todo processo depois do 1º): schema já existe → não toca em `leads`, sem lock.
  if (await schemaAtual(sql)) return;
  // Numa 1ª subida com o banco pristino, dois processos (ex.: testes em paralelo, ou réplicas
  // de servidor) podem aplicar o schema ao mesmo tempo — CREATE TABLE IF NOT EXISTS concorrente
  // conflita no catálogo do Postgres. O lock consultivo por transação serializa: quem chega
  // depois espera, e ao entrar já encontra tudo criado.
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${SCHEMA_LOCK_KEY})`;
    // Reconfere após pegar o lock: se outro processo aplicou enquanto esperávamos, não re-rodar o
    // DDL (que travaria `leads` e poderia deadlockar com escritas concorrentes).
    if (await schemaAtual(tx)) return;
    await tx`
      create table if not exists usuarios (
        id serial primary key,
        email text not null unique,
        senha_hash text not null,
        criado_em timestamptz not null default now()
      )`;
    await tx`
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
    await tx`
      create table if not exists notas (
        id serial primary key,
        lead_id integer not null references leads(id) on delete cascade,
        texto text not null,
        criado_em timestamptz not null default now()
      )`;
    // CRM de vendas (003): nicho no lead, cadência, carteira e log de transições do funil.
    await tx`alter table leads add column if not exists nicho text`;
    // Multi-pipeline (004): discriminador + linha crua da planilha + chave de idempotência.
    await tx`alter table leads add column if not exists pipeline text not null default 'inbound'`;
    await tx`alter table leads add column if not exists dados_import jsonb`;
    await tx`alter table leads add column if not exists import_ref text`;
    // Só o inbound preenche pessoa/produto — recuperação não tem. Afrouxa os NOT NULL.
    await tx`alter table leads alter column nome drop not null`;
    await tx`alter table leads alter column tipo_fita drop not null`;
    await tx`alter table leads alter column quantidade drop not null`;
    await tx`
      create table if not exists tentativas (
        id serial primary key,
        lead_id integer not null references leads(id) on delete cascade,
        canal text not null,
        resultado text not null,
        observacao text,
        criado_em timestamptz not null default now()
      )`;
    await tx`
      create table if not exists pedidos (
        id serial primary key,
        lead_id integer not null references leads(id) on delete cascade,
        data date not null,
        valor_centavos integer,
        volume_rolos integer,
        criado_em timestamptz not null default now()
      )`;
    await tx`
      create table if not exists transicoes (
        id serial primary key,
        lead_id integer not null references leads(id) on delete cascade,
        de_status text,
        para_status text not null,
        criado_em timestamptz not null default now()
      )`;
    await tx`create index if not exists leads_criado_em_idx on leads (criado_em desc)`;
    await tx`create index if not exists leads_pipeline_idx on leads (pipeline)`;
    await tx`create unique index if not exists leads_import_ref_uk on leads (import_ref) where import_ref is not null`;
    await tx`create index if not exists tentativas_lead_idx on tentativas (lead_id)`;
    await tx`create index if not exists pedidos_lead_idx on pedidos (lead_id)`;
    await tx`create index if not exists transicoes_lead_idx on transicoes (lead_id)`;
    await tx`create index if not exists transicoes_para_idx on transicoes (para_status)`;
    await backfillTransicoes(tx);
  });
}

/**
 * Semeia uma transição inicial `null → status atual` para leads que ainda não têm nenhuma —
 * assim leads pré-existentes contam na coorte do funil (FR-014a). Idempotente: `where not
 * exists` garante que rodar a cada start (ou nos testes) nunca duplica. `sql` aceita o pool
 * ou uma transação (ISql é a base comum).
 */
export async function backfillTransicoes(sql: postgres.ISql) {
  await sql`
    insert into transicoes (lead_id, de_status, para_status, criado_em)
    select l.id, null, l.status, l.criado_em from leads l
    where not exists (select 1 from transicoes t where t.lead_id = l.id)`;
}

/** Grava uma mudança de etapa. `exec` (Sql do pool ou TransactionSql) permite rodar dentro de
 *  uma transação, na mesma conexão. ISql é a base comum aos dois. */
export async function registrarTransicao(
  leadId: number,
  de: string | null,
  para: string,
  exec?: postgres.ISql,
) {
  const sql = exec ?? (await db());
  await sql`insert into transicoes (lead_id, de_status, para_status) values (${leadId}, ${de}, ${para})`;
}

/** Conexão pronta para uso (schema garantido). Lazy: o build estático nunca toca no banco. */
export async function db() {
  cliente ??= conectar();
  schemaPronto ??= aplicarSchema(cliente);
  await schemaPronto;
  return cliente;
}

/** Fecha o pool — usado pelos testes de integração para o runner encerrar sem travar. */
export async function fecharDb() {
  await cliente?.end({ timeout: 5 });
  cliente = undefined;
  schemaPronto = undefined;
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
  await registrarTransicao(row.id, null, "novo");
  return row.id;
}

/** Lista com filtro opcional de status, nicho e busca livre por empresa/nome/e-mail, escopada por pipeline.
 *  Ordena por "tem canal" → confiança alta → mais recente. No inbound (telefone/email sempre
 *  preenchidos, dados_import nulo) degrada exatamente para `order by criado_em desc` de antes. */
export async function listarLeads(
  filtro: { status?: string; busca?: string; nicho?: string; pipeline?: Pipeline } = {},
) {
  const sql = await db();
  const pipeline = filtro.pipeline ?? "inbound";
  const status = filtro.status && isStatus(filtro.status, pipeline) ? filtro.status : null;
  const nicho = filtro.nicho && isNicho(filtro.nicho) ? filtro.nicho : null;
  const busca = filtro.busca?.trim() ? `%${filtro.busca.trim()}%` : null;
  return sql<Lead[]>`
    select * from leads
    where pipeline = ${pipeline}
      and (${status}::text is null or status = ${status})
      and (${nicho}::text is null or nicho = ${nicho})
      and (${busca}::text is null or empresa ilike ${busca} or nome ilike ${busca} or email ilike ${busca})
    order by
      (case when coalesce(telefone,'') <> '' or coalesce(email,'') <> ''
            or coalesce(dados_import->>'instagram','') <> '' then 0 else 1 end),
      (dados_import->>'confianca' = 'alta') desc nulls last,
      criado_em desc
    limit 300`;
}

/** Base da pipeline para a projeção: total de leads e quantos têm ao menos um canal de contato
 *  (telefone/whatsapp espelhado em `telefone`, e-mail ou instagram) — mesma regra do order-by de
 *  listarLeads. Só quem tem canal é prospectável de imediato; o resto exige enriquecimento. */
export async function contarBase(pipeline: Pipeline = "inbound") {
  const sql = await db();
  const [r] = await sql<{ total: number; contataveis: number }[]>`
    select
      count(*)::int as total,
      count(*) filter (
        where coalesce(telefone, '') <> '' or coalesce(email, '') <> ''
           or coalesce(dados_import->>'instagram', '') <> ''
      )::int as contataveis
    from leads where pipeline = ${pipeline}`;
  return { total: r.total, contataveis: r.contataveis };
}

export async function contarPorStatus(pipeline: Pipeline = "inbound") {
  const sql = await db();
  const linhas = await sql<{ status: string; total: string }[]>`
    select status, count(*) as total from leads where pipeline = ${pipeline} group by status`;
  return Object.fromEntries(linhas.map((l) => [l.status, Number(l.total)])) as Record<string, number>;
}

/** Leads com follow-up marcado para hoje ou antes — o que não pode ser esquecido.
 *  Exclui os terminais (ganho/perdido) da pipeline, via papéis (não literais). */
export async function contarAtrasados(pipeline: Pipeline = "inbound") {
  const sql = await db();
  const { ganho, perdido } = rolesDaPipeline(pipeline);
  const [row] = await sql<{ total: string }[]>`
    select count(*) as total from leads
    where pipeline = ${pipeline}
      and proximo_contato is not null and proximo_contato <= current_date
      and status not in (${ganho}, ${perdido})`;
  return Number(row.total);
}

export async function buscarLead(id: number) {
  const sql = await db();
  const [lead] = await sql<Lead[]>`select * from leads where id = ${id}`;
  if (!lead) return null;
  const [notas, tentativas, pedidos] = await Promise.all([
    sql<Nota[]>`select * from notas where lead_id = ${id} order by criado_em desc`,
    sql<Tentativa[]>`select * from tentativas where lead_id = ${id} order by criado_em desc`,
    sql<Pedido[]>`select * from pedidos where lead_id = ${id} order by data desc, id desc`,
  ]);
  return { lead, notas, tentativas, pedidos };
}

export async function atualizarLead(id: number, status: StatusLead, proximoContato: string | null) {
  const sql = await db();
  const [atual] = await sql<{ status: string }[]>`select status from leads where id = ${id}`;
  await sql`
    update leads set status = ${status}, proximo_contato = ${proximoContato}
    where id = ${id}`;
  // Só registra transição quando o status muda de fato (edição de próximo contato não conta).
  if (atual && atual.status !== status) await registrarTransicao(id, atual.status, status);
}

/**
 * Grava dados_import (linha crua editada no detalhe da recuperação) e ressincroniza as colunas
 * espelhadas que a busca/lista/WhatsApp usam. Faz merge sobre o dados_import atual — as chaves de
 * proveniência (`arquivo`/`confianca`), que não vêm do form, são preservadas.
 */
export async function salvarDadosImport(id: number, dados: Record<string, string>) {
  const sql = await db();
  await sql.begin(async (tx) => {
    const [atual] = await tx<{ dados_import: Record<string, string> | null }[]>`
      select dados_import from leads where id = ${id}`;
    const merged = { ...(atual?.dados_import ?? {}), ...dados };
    await tx`
      update leads set
        dados_import = ${tx.json(merged)},
        empresa = ${merged.empresa ?? ""},
        telefone = ${merged.whatsapp || merged.telefone || ""},
        email = ${merged.email ?? ""},
        cnpj = ${merged.cnpj || null}
      where id = ${id}`;
  });
}

export async function adicionarNota(leadId: number, texto: string) {
  const sql = await db();
  await sql`insert into notas (lead_id, texto) values (${leadId}, ${texto})`;
}

/* ── Cadência de 1ª venda (US1) ──────────────────────────────────────────── */

/**
 * Registra um toque da cadência. Se `proximoContato` vier, atualiza a data do lead.
 * O 1º toque num lead no estado inicial da sua pipeline o promove ao primeiro-toque
 * (com transição), tudo numa transação para não deixar estado intermediário.
 */
export async function registrarTentativa(
  leadId: number,
  canal: string,
  resultado: string,
  observacao: string | null = null,
  proximoContato?: string | null,
) {
  const sql = await db();
  await sql.begin(async (tx) => {
    await tx`
      insert into tentativas (lead_id, canal, resultado, observacao)
      values (${leadId}, ${canal}, ${resultado}, ${observacao})`;
    if (proximoContato !== undefined) {
      await tx`update leads set proximo_contato = ${proximoContato} where id = ${leadId}`;
    }
    const [l] = await tx<{ status: string; pipeline: Pipeline }[]>`
      select status, pipeline from leads where id = ${leadId}`;
    if (l) {
      // 1º toque promove do estado inicial ao primeiro-toque da pipeline do lead (papel, não literal).
      const { inicial, primeiro_toque } = rolesDaPipeline(l.pipeline);
      if (l.status === inicial) {
        await tx`update leads set status = ${primeiro_toque} where id = ${leadId}`;
        await registrarTransicao(leadId, inicial, primeiro_toque, tx);
      }
    }
  });
}

export async function contarTentativas(leadId: number) {
  const sql = await db();
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from tentativas where lead_id = ${leadId}`;
  return r.n;
}

/* ── Carteira pós-venda / pedidos (US2) ──────────────────────────────────── */

/**
 * Registra um pedido em transação. 1º pedido do lead → estado de ganho da pipeline (fechado |
 * recuperado, +transição) e `proximo_contato = data + 30`. Pedidos seguintes só reagendam pela última compra.
 */
export async function inserirPedido(
  leadId: number,
  data: string,
  valorCentavos: number | null,
  volumeRolos: number | null,
) {
  const sql = await db();
  await sql.begin(async (tx) => {
    await tx`
      insert into pedidos (lead_id, data, valor_centavos, volume_rolos)
      values (${leadId}, ${data}, ${valorCentavos}, ${volumeRolos})`;
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from pedidos where lead_id = ${leadId}`;
    // Recontato sempre a partir da compra mais recente (inclui a que acabou de entrar).
    if (n === 1) {
      const [l] = await tx<{ status: string; pipeline: Pipeline }[]>`
        select status, pipeline from leads where id = ${leadId}`;
      // 1º pedido leva ao estado de ganho da pipeline do lead (fechado | recuperado).
      const ganho = l ? rolesDaPipeline(l.pipeline).ganho : "fechado";
      await tx`
        update leads set status = ${ganho},
          proximo_contato = (select max(data) + ${RECONTATO_CARTEIRA_DIAS}::int from pedidos where lead_id = ${leadId})
        where id = ${leadId}`;
      if (l && l.status !== ganho) await registrarTransicao(leadId, l.status, ganho, tx);
    } else {
      await tx`
        update leads set
          proximo_contato = (select max(data) + ${RECONTATO_CARTEIRA_DIAS}::int from pedidos where lead_id = ${leadId})
        where id = ${leadId}`;
    }
  });
}

export async function listarPedidos(leadId: number) {
  const sql = await db();
  return sql<Pedido[]>`select * from pedidos where lead_id = ${leadId} order by data desc, id desc`;
}

/** Clientes (têm pedido) da pipeline, ordenados por próximo recontato — vencidos primeiro; pausados no fim. */
export async function listarCarteira(filtro: { nicho?: string; pipeline?: Pipeline } = {}) {
  const sql = await db();
  const pipeline = filtro.pipeline ?? "inbound";
  const nicho = filtro.nicho && isNicho(filtro.nicho) ? filtro.nicho : null;
  return sql<Lead[]>`
    select l.* from leads l
    where l.pipeline = ${pipeline}
      and exists (select 1 from pedidos p where p.lead_id = l.id)
      and (${nicho}::text is null or l.nicho = ${nicho})
    order by l.proximo_contato asc nulls last`;
}

export async function contarCarteiraVencida(pipeline: Pipeline = "inbound") {
  const sql = await db();
  const [r] = await sql<{ n: number }[]>`
    select count(*)::int as n from leads l
    where l.pipeline = ${pipeline}
      and exists (select 1 from pedidos p where p.lead_id = l.id)
      and l.proximo_contato is not null and l.proximo_contato <= current_date`;
  return r.n;
}

export async function pausarCarteira(leadId: number) {
  const sql = await db();
  await sql`update leads set proximo_contato = null where id = ${leadId}`;
}

export async function reagendarCarteira(leadId: number) {
  const sql = await db();
  await sql`update leads set proximo_contato = current_date + ${RECONTATO_CARTEIRA_DIAS}::int where id = ${leadId}`;
}

/* ── Funil por coorte (US3) ──────────────────────────────────────────────── */

/**
 * Contagem por etapa + as três taxas de conversão, para a coorte de leads cujo `criado_em`
 * cai no período. "Chegou à etapa X" = existe transição para X (via `transicoes`), então o
 * funil enxerga histórico mesmo em leads que já mudaram de status. `nicho` opcional recorta.
 */
export async function funilCoorte(periodo: string, pipeline: Pipeline = "inbound", nicho?: string) {
  const sql = await db();
  const desde = inicioPeriodo(periodo);
  const n = nicho && isNicho(nicho) ? nicho : null;
  // "Chegou à etapa" é por papel: primeiro_toque / meio / ganho da pipeline (não literais).
  const { primeiro_toque, meio, ganho } = rolesDaPipeline(pipeline);

  const porEtapaRows = await sql<{ status: string; total: number }[]>`
    select status, count(*)::int as total from leads
    where pipeline = ${pipeline}
      and (${desde}::timestamptz is null or criado_em >= ${desde})
      and (${n}::text is null or nicho = ${n})
    group by status`;

  const [c] = await sql<
    {
      total_leads: number;
      chegaram_em_contato: number;
      chegaram_orcado: number;
      chegaram_fechado: number;
      fechado_desde_em_contato: number;
      fechado_desde_orcado: number;
    }[]
  >`
    select
      count(*)::int as total_leads,
      count(*) filter (where has_primeiro_toque)::int as chegaram_em_contato,
      count(*) filter (where has_meio)::int as chegaram_orcado,
      count(*) filter (where has_ganho)::int as chegaram_fechado,
      count(*) filter (where has_ganho and has_primeiro_toque)::int as fechado_desde_em_contato,
      count(*) filter (where has_ganho and has_meio)::int as fechado_desde_orcado
    from (
      select l.id,
        bool_or(t.para_status = ${primeiro_toque}) as has_primeiro_toque,
        bool_or(t.para_status = ${meio}) as has_meio,
        bool_or(t.para_status = ${ganho}) as has_ganho
      from leads l
      left join transicoes t on t.lead_id = l.id
      where l.pipeline = ${pipeline}
        and (${desde}::timestamptz is null or l.criado_em >= ${desde})
        and (${n}::text is null or l.nicho = ${n})
      group by l.id
    ) s`;

  const counts = {
    totalLeads: c.total_leads,
    chegaramEmContato: c.chegaram_em_contato,
    chegaramOrcado: c.chegaram_orcado,
    chegaramFechado: c.chegaram_fechado,
    fechadoDesdeEmContato: c.fechado_desde_em_contato,
    fechadoDesdeOrcado: c.fechado_desde_orcado,
  };
  const porEtapa = Object.fromEntries(porEtapaRows.map((r) => [r.status, r.total])) as Record<string, number>;
  return { porEtapa, ...counts, ...taxasFunil(counts) };
}

/* ── Nicho (US4) ─────────────────────────────────────────────────────────── */

export async function definirNicho(leadId: number, nicho: string | null) {
  const sql = await db();
  const v = nicho && isNicho(nicho) ? nicho : null;
  await sql`update leads set nicho = ${v} where id = ${leadId}`;
}

export async function distribuicaoPorNicho(periodo?: string, pipeline: Pipeline = "inbound") {
  const sql = await db();
  const desde = periodo ? inicioPeriodo(periodo) : null;
  return sql<{ nicho: string | null; total: number }[]>`
    select nicho, count(*)::int as total from leads
    where pipeline = ${pipeline}
      and (${desde}::timestamptz is null or criado_em >= ${desde})
    group by nicho order by total desc`;
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
