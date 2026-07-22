/**
 * CRM de vendas (003) — invariantes de negócio contra o Postgres real.
 * Chama o data-layer (`crm.ts`) direto, não por HTTP: é lógica de banco, não de rota.
 *
 * Precisa de um Postgres descartável e da DATABASE_URL (mesmo do handoff):
 *   docker run -d --name tapepro-pg -e POSTGRES_PASSWORD=teste \
 *     -e POSTGRES_DB=tapepro -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgres://postgres:teste@localhost:55432/tapepro
 *
 * Sem DATABASE_URL a suíte é pulada, para `npm test` seguir verde só com os helpers.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

import { backfillTransicoes, db, fecharDb, inserirLead, inserirPedido } from "../src/lib/crm.ts";

const DATABASE_URL = process.env.DATABASE_URL;
const iso = (d) => d.toISOString().slice(0, 10);

const leadBase = {
  nome: "Cliente Teste",
  empresa: "Carteira Ltda",
  email: "carteira@teste.com.br",
  telefone: "62983443919",
  tipo_fita: "gomada",
  quantidade: "200 rolos",
};

describe("CRM de vendas — carteira e funil", { skip: DATABASE_URL ? false : "DATABASE_URL não configurada" }, () => {
  let sql;
  const criados = [];

  before(async () => {
    sql = postgres(DATABASE_URL, { max: 2 });
    await db(); // garante schema + backfill inicial
  });

  after(async () => {
    if (criados.length) await sql`delete from leads where id in ${sql(criados)}`;
    await sql?.end({ timeout: 5 });
    await fecharDb();
  });

  test("1º pedido fecha o lead, agenda carteira +30d e loga a transição", async () => {
    const id = await inserirLead(leadBase);
    criados.push(id);

    await inserirPedido(id, "2026-03-10", 123450, 200);

    const [lead] = await sql`select status, proximo_contato from leads where id = ${id}`;
    assert.equal(lead.status, "fechado", "1º pedido fecha o lead");
    assert.equal(iso(lead.proximo_contato), "2026-04-09", "recontato = data + 30 dias");

    const trans = await sql`select * from transicoes where lead_id = ${id} and para_status = 'fechado'`;
    assert.equal(trans.length, 1, "existe exatamente uma transição …→fechado");
  });

  test("2º pedido só reagenda a carteira pela última compra; status intacto, sem re-logar fechado", async () => {
    const id = await inserirLead(leadBase);
    criados.push(id);

    await inserirPedido(id, "2026-03-10", 100000, 100);
    await inserirPedido(id, "2026-03-20", 50000, 50); // compra mais recente

    const [lead] = await sql`select status, proximo_contato from leads where id = ${id}`;
    assert.equal(lead.status, "fechado", "status permanece fechado");
    assert.equal(iso(lead.proximo_contato), "2026-04-19", "reagenda por max(data) + 30");

    const trans = await sql`select * from transicoes where lead_id = ${id} and para_status = 'fechado'`;
    assert.equal(trans.length, 1, "2º pedido não registra nova transição de fechamento");
  });

  test("backfill de transições é idempotente — rodar de novo não duplica", async () => {
    // Lead inserido cru, sem passar por inserirLead → não tem transição inicial.
    const [{ id }] = await sql`
      insert into leads (nome, empresa, email, telefone, tipo_fita, quantidade, status)
      values ('Legado', 'Antigo', 'legado@teste.com', '62999999999', 'gomada', '10', 'orcado')
      returning id`;
    criados.push(id);

    const client = await db();
    await backfillTransicoes(client);
    await backfillTransicoes(client); // 2ª passada não pode duplicar

    const trans = await sql`select de_status, para_status from transicoes where lead_id = ${id}`;
    assert.equal(trans.length, 1, "uma única transição semeada");
    assert.equal(trans[0].de_status, null);
    assert.equal(trans[0].para_status, "orcado", "backfill semeia null → status atual");
  });
});
