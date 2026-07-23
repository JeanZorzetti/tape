/**
 * Execução da prospecção (005) — o contador de toques do dia contra o Postgres real.
 * Integração; PULA sem DATABASE_URL (padrão do crm-vendas.test).
 *
 *   docker run -d --name tapepro-pg -e POSTGRES_PASSWORD=teste \
 *     -e POSTGRES_DB=tapepro -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgres://postgres:teste@localhost:55432/tapepro
 *
 * Assere por DELTA (mede antes/depois) — o count é global à pipeline, então dados pré-existentes
 * no banco não podem quebrar o teste.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

import { contarToquesHoje, db, fecharDb } from "../src/lib/crm.ts";

const DATABASE_URL = process.env.DATABASE_URL;

describe("Contador de toques do dia (005)", {
  skip: DATABASE_URL ? false : "DATABASE_URL não configurada",
}, () => {
  let sql;
  const criados = [];

  async function novoLead(pipeline) {
    const [row] = await sql`
      insert into leads (empresa, email, telefone, status, pipeline)
      values ('Toque Teste', '', '62999990000', ${pipeline === "recuperacao" ? "a_contatar" : "novo"}, ${pipeline})
      returning id`;
    criados.push(row.id);
    return row.id;
  }

  // Tentativa com criado_em explícito. `quando` = 'hoje' | 'ontem' no fuso America/Sao_Paulo, ao meio-dia
  // local (evita ambiguidade de virada do dia / DST).
  async function toque(leadId, quando) {
    const dia = quando === "ontem" ? "- 1" : "- 0";
    await sql`
      insert into tentativas (lead_id, canal, resultado, criado_em)
      values (${leadId}, 'whatsapp', 'sem_resposta',
        (((now() at time zone 'America/Sao_Paulo')::date ${sql.unsafe(dia)} + time '12:00')
          at time zone 'America/Sao_Paulo'))`;
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

  test("conta só os toques de hoje e só da pipeline pedida", async () => {
    const antesRec = await contarToquesHoje("recuperacao");
    const antesInb = await contarToquesHoje("inbound");

    const rec = await novoLead("recuperacao");
    const inb = await novoLead("inbound");

    await toque(rec, "hoje");
    await toque(rec, "hoje");
    await toque(rec, "ontem"); // ontem no fuso BR — não conta
    await toque(inb, "hoje"); // outra pipeline — não conta na recuperação

    const depoisRec = await contarToquesHoje("recuperacao");
    const depoisInb = await contarToquesHoje("inbound");

    assert.equal(depoisRec - antesRec, 2, "2 toques de hoje na recuperação (ontem e inbound fora)");
    assert.equal(depoisInb - antesInb, 1, "1 toque de hoje no inbound (escopo por pipeline)");
  });

  test("default de pipeline é inbound (coerente com as demais leituras)", async () => {
    const antesDefault = await contarToquesHoje();
    const antesInb = await contarToquesHoje("inbound");
    assert.equal(antesDefault, antesInb, "sem argumento = inbound");
  });
});
