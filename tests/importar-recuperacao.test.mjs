/**
 * Importação da pipeline de recuperação (004).
 *
 * - parseCsv: unit puro, SEMPRE roda (self-check das aspas/BOM/quebra interna).
 * - importar: integração contra Postgres real, PULA sem DATABASE_URL (padrão do crm-vendas.test).
 *
 *   docker run -d --name tapepro-pg -e POSTGRES_PASSWORD=teste \
 *     -e POSTGRES_DB=tapepro -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgres://postgres:teste@localhost:55432/tapepro
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

import { db, fecharDb } from "../src/lib/crm.ts";
import {
  importarRegistros,
  linhasParaRegistros,
  parseCsv,
} from "../scripts/importar-recuperacao.mjs";

const DATABASE_URL = process.env.DATABASE_URL;
const ARQUIVO_TESTE = "TESTE_REC_004.jpg";

const AMOSTRA = [
  "arquivo,empresa,ramo,telefone,whatsapp,cidade_uf,email,instagram,endereco,cnpj,confianca,observacao",
  `${ARQUIVO_TESTE},ALKAN,"CORTINAS, PERSIANAS, TOLDOS, TAPETES",,62999990000,GO,alkan@teste.com,,,,alta,`,
  `${ARQUIVO_TESTE},,ferragens,,62988887777,GO,,,,,,`, // sem empresa → pulada
  `${ARQUIVO_TESTE},ALKAN,"CORTINAS, PERSIANAS, TOLDOS, TAPETES",,62999990000,GO,alkan@teste.com,,,,alta,`, // duplicata
].join("\n");

describe("parseCsv (unit — sempre roda)", () => {
  test("campo com vírgulas dentro de aspas vira UM campo", () => {
    const linhas = parseCsv('arquivo,empresa,ramo\nX.jpg,ALKAN,"CORTINAS, PERSIANAS, TOLDOS, TAPETES"\n');
    assert.equal(linhas[1][2], "CORTINAS, PERSIANAS, TOLDOS, TAPETES");
    assert.equal(linhas[1].length, 3, "aspas não podem estourar o número de colunas");
  });

  test("descarta BOM inicial", () => {
    const linhas = parseCsv("﻿arquivo,empresa\nX.jpg,ALKAN\n");
    assert.equal(linhas[0][0], "arquivo");
  });

  test('aspa dupla escapada ("") vira uma aspa literal', () => {
    const linhas = parseCsv('obs\n"disse ""oi"""\n');
    assert.equal(linhas[1][0], 'disse "oi"');
  });

  test("quebra de linha dentro de aspas fica no mesmo campo", () => {
    const linhas = parseCsv('a,b\n"linha1\nlinha2",x\n');
    assert.equal(linhas[1][0], "linha1\nlinha2");
    assert.equal(linhas[1][1], "x");
  });

  test("linhasParaRegistros mapeia pelo cabeçalho e ignora linhas vazias", () => {
    const registros = linhasParaRegistros(parseCsv(AMOSTRA));
    assert.equal(registros.length, 3, "3 linhas de dados (a vazia é filtrada; a sem-empresa não)");
    assert.equal(registros[0].empresa, "ALKAN");
    assert.equal(registros[0].ramo, "CORTINAS, PERSIANAS, TOLDOS, TAPETES");
    assert.equal(registros[1].empresa, "", "linha sem empresa mantém empresa vazia");
  });
});

describe("importar recuperação — idempotência e espelhamento", {
  skip: DATABASE_URL ? false : "DATABASE_URL não configurada",
}, () => {
  let sql;

  before(async () => {
    sql = postgres(DATABASE_URL, { max: 2 });
    await db();
    await sql`delete from leads where dados_import->>'arquivo' = ${ARQUIVO_TESTE}`;
  });

  after(async () => {
    await sql`delete from leads where dados_import->>'arquivo' = ${ARQUIVO_TESTE}`;
    await sql?.end({ timeout: 5 });
    await fecharDb();
  });

  test("1ª execução insere as com empresa, pula duplicata e conta sem-empresa", async () => {
    const registros = linhasParaRegistros(parseCsv(AMOSTRA));
    const r = await importarRegistros(registros);
    assert.equal(r.inseridos, 1, "ALKAN inserida uma vez");
    assert.equal(r.pulados, 1, "a 2ª ALKAN colide no import_ref");
    assert.equal(r.semEmpresa, 1, "linha sem empresa contabilizada");

    const [lead] = await sql`
      select status, pipeline, telefone, email, dados_import->>'ramo' as ramo
      from leads where import_ref = ${`${ARQUIVO_TESTE}|ALKAN`}`;
    assert.equal(lead.pipeline, "recuperacao");
    assert.equal(lead.status, "a_contatar");
    assert.equal(lead.telefone, "62999990000", "whatsapp espelhado em telefone");
    assert.equal(lead.email, "alkan@teste.com");
    assert.equal(lead.ramo, "CORTINAS, PERSIANAS, TOLDOS, TAPETES");

    const trans = await sql`
      select * from transicoes t join leads l on l.id = t.lead_id
      where l.import_ref = ${`${ARQUIVO_TESTE}|ALKAN`} and t.para_status = 'a_contatar'`;
    assert.equal(trans.length, 1, "transição inicial null → a_contatar registrada");
  });

  test("2ª execução é idempotente — insere 0", async () => {
    const registros = linhasParaRegistros(parseCsv(AMOSTRA));
    const r = await importarRegistros(registros);
    assert.equal(r.inseridos, 0, "reexecutar não duplica");
  });
});
