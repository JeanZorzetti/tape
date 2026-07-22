/**
 * Multi-pipeline recuperação (004) — invariantes de escopo, papéis e enriquecimento.
 * Integração contra Postgres real; PULA sem DATABASE_URL (padrão do crm-vendas.test).
 *
 *   docker run -d --name tapepro-pg -e POSTGRES_PASSWORD=teste \
 *     -e POSTGRES_DB=tapepro -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgres://postgres:teste@localhost:55432/tapepro
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

import {
  contarPorStatus,
  db,
  fecharDb,
  inserirLead,
  inserirPedido,
  listarLeads,
  registrarTentativa,
  salvarDadosImport,
} from "../src/lib/crm.ts";

const DATABASE_URL = process.env.DATABASE_URL;
const iso = (d) => d.toISOString().slice(0, 10);

const leadInbound = {
  nome: "Cliente Inbound",
  empresa: "Inbound Ltda",
  email: "inbound@teste.com.br",
  telefone: "62983443919",
  tipo_fita: "gomada",
  quantidade: "200 rolos",
};

describe("Pipeline de recuperação (004)", {
  skip: DATABASE_URL ? false : "DATABASE_URL não configurada",
}, () => {
  let sql;
  const criados = [];

  async function novoRecuperacao(over = {}) {
    const [row] = await sql`
      insert into leads (empresa, email, telefone, status, pipeline, dados_import, import_ref)
      values (
        ${over.empresa ?? "Rec Ltda"}, ${over.email ?? ""}, ${over.telefone ?? ""},
        'a_contatar', 'recuperacao', ${sql.json(over.dados_import ?? {})}, ${over.import_ref ?? null})
      returning id`;
    criados.push(row.id);
    return row.id;
  }

  before(async () => {
    sql = postgres(DATABASE_URL, { max: 2 });
    await db();
  });

  after(async () => {
    if (criados.length) await sql`delete from leads where id in ${sql(criados)}`;
    await sql?.end({ timeout: 5 });
    await fecharDb();
  });

  test("escopo não vaza entre inbound × recuperação", async () => {
    const inboundId = await inserirLead(leadInbound);
    criados.push(inboundId);
    const recId = await novoRecuperacao({ empresa: "Rec Scope" });

    const inbound = await listarLeads({ pipeline: "inbound" });
    const rec = await listarLeads({ pipeline: "recuperacao" });

    assert.ok(inbound.some((l) => l.id === inboundId), "inbound aparece no inbound");
    assert.ok(!inbound.some((l) => l.id === recId), "recuperação não vaza no inbound");
    assert.ok(rec.some((l) => l.id === recId), "recuperação aparece na recuperação");
    assert.ok(!rec.some((l) => l.id === inboundId), "inbound não vaza na recuperação");

    const porStatusRec = await contarPorStatus("recuperacao");
    const porStatusIn = await contarPorStatus("inbound");
    assert.ok((porStatusRec["a_contatar"] ?? 0) >= 1, "a_contatar conta na recuperação");
    assert.equal(porStatusIn["a_contatar"] ?? 0, 0, "a_contatar não existe no inbound");
  });

  test("1º toque num lead de recuperação leva a_contatar → contatado", async () => {
    const id = await novoRecuperacao();
    await registrarTentativa(id, "whatsapp", "respondeu");
    const [l] = await sql`select status from leads where id = ${id}`;
    assert.equal(l.status, "contatado", "papel primeiro_toque da recuperação");

    const trans = await sql`select * from transicoes where lead_id = ${id} and para_status = 'contatado'`;
    assert.equal(trans.length, 1, "transição a_contatar → contatado registrada");
  });

  test("1º pedido leva a recuperado e agenda carteira +30d", async () => {
    const id = await novoRecuperacao();
    await inserirPedido(id, "2026-03-10", 100000, 100);
    const [l] = await sql`select status, proximo_contato from leads where id = ${id}`;
    assert.equal(l.status, "recuperado", "papel ganho da recuperação");
    assert.equal(iso(l.proximo_contato), "2026-04-09", "recontato = data + 30 dias");
  });

  test("salvarDadosImport persiste dados_import e ressincroniza colunas espelhadas (US2)", async () => {
    const id = await novoRecuperacao({
      dados_import: { arquivo: "A.jpg", empresa: "Antiga", confianca: "alta" },
    });
    await salvarDadosImport(id, {
      empresa: "Nova SA",
      whatsapp: "62991112222",
      email: "nova@x.com",
      cnpj: "12345678000199",
    });
    const [l] = await sql`select empresa, telefone, email, cnpj, dados_import from leads where id = ${id}`;
    assert.equal(l.empresa, "Nova SA");
    assert.equal(l.telefone, "62991112222", "telefone = whatsapp||telefone");
    assert.equal(l.email, "nova@x.com");
    assert.equal(l.cnpj, "12345678000199");
    assert.equal(l.dados_import.empresa, "Nova SA", "dados_import atualizado");
    assert.equal(l.dados_import.arquivo, "A.jpg", "arquivo (proveniência) preservado no merge");
    assert.equal(l.dados_import.confianca, "alta", "confianca preservada");
  });
});
