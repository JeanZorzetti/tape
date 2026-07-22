/**
 * Importa a planilha bruta de prospecção como leads da pipeline `recuperacao`.
 *
 *   DATABASE_URL=postgres://... node scripts/importar-recuperacao.mjs [caminho-csv]
 *   (caminho-csv default: docs/leads-bruto.csv)
 *
 * Idempotente: `import_ref = arquivo|empresa` com índice único parcial → reexecutar não duplica.
 * Reusa a conexão e o log de transições de src/lib/crm.ts (Node 22.18 faz type-stripping).
 * NOTA: entregue pronto e testado; NÃO é executado contra produção nesta feature.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { db, fecharDb, registrarTransicao } from "../src/lib/crm.ts";

// As 12 colunas da planilha, na ordem canônica. Espelhadas em colunas reais: empresa, telefone
// (whatsapp||telefone), email, cnpj. O resto vive em dados_import.
const CABECALHO = [
  "arquivo", "empresa", "ramo", "telefone", "whatsapp", "cidade_uf",
  "email", "instagram", "endereco", "cnpj", "confianca", "observacao",
];

/**
 * Parser CSV mínimo (RFC-4180 simplificado): descarta BOM inicial e respeita aspas duplas,
 * incluindo `""` escapado e vírgula/quebra de linha dentro de aspas. Sem dependência.
 */
export function parseCsv(texto) {
  const t = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto; // descarta BOM
  const linhas = [];
  let linha = [];
  let campo = "";
  let dentroAspas = false;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dentroAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } // aspa dupla escapada
        else dentroAspas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      dentroAspas = true;
    } else if (c === ",") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else if (c !== "\r") {
      campo += c;
    }
  }
  // Fecha a última linha quando o arquivo não termina com \n.
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

/** Linha 0 = cabeçalho; devolve um objeto {coluna: valor} por linha não-vazia. */
export function linhasParaRegistros(linhas) {
  if (linhas.length === 0) return [];
  const header = linhas[0].map((h) => h.trim());
  return linhas
    .slice(1)
    .filter((l) => l.some((c) => c.trim() !== ""))
    .map((l) => Object.fromEntries(header.map((h, i) => [h, (l[i] ?? "").trim()])));
}

/** Faz o upsert idempotente de cada registro. Linha sem empresa é pulada e contabilizada. */
export async function importarRegistros(registros) {
  const sql = await db();
  let inseridos = 0;
  let pulados = 0;
  let semEmpresa = 0;

  for (const r of registros) {
    if (!r.empresa) {
      semEmpresa++;
      continue;
    }
    const dados = Object.fromEntries(CABECALHO.map((k) => [k, r[k] ?? ""]));
    const importRef = `${dados.arquivo}|${dados.empresa}`;
    const [row] = await sql`
      insert into leads (empresa, email, telefone, cnpj, status, pipeline, dados_import, import_ref)
      values (
        ${dados.empresa},
        ${dados.email || ""},
        ${dados.whatsapp || dados.telefone || ""},
        ${dados.cnpj || null},
        'a_contatar',
        'recuperacao',
        ${sql.json(dados)},
        ${importRef}
      )
      on conflict (import_ref) where import_ref is not null do nothing
      returning id`;
    if (row) {
      await registrarTransicao(row.id, null, "a_contatar", sql);
      inseridos++;
    } else {
      pulados++;
    }
  }
  return { inseridos, pulados, semEmpresa };
}

export async function importar(caminho) {
  const texto = await readFile(caminho, "utf8");
  return importarRegistros(linhasParaRegistros(parseCsv(texto)));
}

// Execução direta como CLI (não em import de teste).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const caminho = process.argv[2] ?? "docs/leads-bruto.csv";
  const { inseridos, pulados, semEmpresa } = await importar(caminho);
  console.log(`inseridos: ${inseridos} · pulados: ${pulados} · sem-empresa: ${semEmpresa}`);
  await fecharDb();
}
