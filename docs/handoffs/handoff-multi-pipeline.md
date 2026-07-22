# Handoff — Multi-pipeline (pipeline de **recuperação** outbound)

> Documento de contexto para a próxima sessão. Não é código; é o mapa da feature.
> Fonte da lista: [`docs/leads-bruto.csv`](docs/leads-bruto.csv). CRM atual descrito em
> [`handoff.md`](handoff.md) (seção "🗄️ CRM `/admin`").

## ✅ STATUS: IMPLEMENTADO (spec 004, 2026-07-22)

Feature entregue via `specs/004-pipeline-recuperacao/` (spec → plan → tasks → implement). Estado:

- **Foundational**: `PIPELINES`/papéis/`TERMINAIS` em `src/lib/adminUi.ts`; schema delta idempotente
  (`pipeline`/`dados_import`/`import_ref` + `not null` afrouxados) em `src/lib/crm.ts`.
- **US1 (funil separado)**: 7 leituras e 3 escritas escopadas/por-papel; seletor Inbound × Recuperação
  no header; `index.astro`/`funil.astro` threadam `?pipeline=` com etapas próprias.
- **US2 (enriquecimento)**: `salvarDadosImport()` + seção "Dados da prospecção" no `[id].astro`
  (12 colunas editáveis, `arquivo`/`confianca` read-only, ressincroniza empresa/telefone/email/cnpj).
- **US3 (import)**: `scripts/importar-recuperacao.mjs` (parser CSV próprio + upsert idempotente por
  `import_ref`). **Validado em banco de teste**: `inseridos: 502 · pulados: 0 · sem-empresa: 1`;
  2ª execução `inseridos: 0` (idempotente).
- **Testes**: `tests/pipeline-recuperacao.test.mjs` + `tests/importar-recuperacao.test.mjs`; `npm test`
  verde com e sem `DATABASE_URL` (integração pula sem banco). Test runner serializado
  (`--test-concurrency=1`) para os suites de integração não colidirem no mesmo Postgres.
- **Bootstrap hardening**: `aplicarSchema` ganhou fast-path `schemaAtual` — só a 1ª subida roda o DDL
  (evita re-trancar `leads` em ACCESS EXCLUSIVE a cada boot/deploy e deadlockar com escritas).

> ⚠️ **O import NÃO foi rodado contra produção.** O script está pronto e testado; rodar
> `DATABASE_URL=<prod> node scripts/importar-recuperacao.mjs docs/leads-bruto.csv` é uma decisão
> operacional deliberada, fora do escopo desta feature.

---

## TL;DR

Hoje o CRM tem **um** funil só (leads inbound do formulário `/orcamento`). Preciso de uma
**segunda pipeline, separada**, para trabalhar uma lista outbound de **recuperação/prospecção**
(503 empresas extraídas de fotos). O detalhe do lead dessa pipeline precisa mostrar **todas as
colunas da planilha como campo, já preenchidas** com o dado importado (e editáveis, para enriquecer).

**Recomendação central:** não criar um CRM novo nem tabela nova. O CRM atual é **agnóstico de
pipeline** — cadência, carteira, funil, notas e transições operam sobre `status`/`proximo_contato`,
não sobre a origem do lead. Basta um **discriminador `pipeline`** em `leads` + um campo `dados_import`
(JSONB) com a linha crua da planilha. Reusa 100% da máquina que já existe.

---

## A lista — perfil real de `docs/leads-bruto.csv`

- **503 linhas** de dados (UTF-8 **com BOM**; CSV real: há vírgulas dentro de aspas, ex.
  `"CORTINAS, PERSIANAS, TOLDOS, TAPETES"` — exige parser CSV de verdade, não `split(",")`).
- **Colunas (12):** `arquivo, empresa, ramo, telefone, whatsapp, cidade_uf, email, instagram,
  endereco, cnpj, confianca, observacao`.
- `arquivo` = imagem de origem da extração (proveniência; 474 imagens distintas). `confianca` =
  confiança da leitura (`alta` 460, `baixa` 40, `media` 3).

**Preenchimento (o que importa para a operação):**

| coluna | preenchida | | coluna | preenchida |
|---|---|---|---|---|
| arquivo | 100% | | instagram | 20% |
| empresa | 100% (473 únicas, **29 duplicadas**) | | telefone | 11% |
| confianca | 100% | | email | 2% |
| ramo | 74% | | endereco | 2% |
| observacao | 49% | | cnpj | 1% |
| whatsapp | 32% | | cidade_uf | 32% |

- **57% (289) não têm nenhum canal** (tel/whatsapp/email/insta). O subconjunto realmente
  cadenciável é ~43% — priorizar **whatsapp (160)** e **instagram (100)**. Importar todos para
  registro, mas ordenar/priorizar por "tem canal" + `confianca=alta`.

---

## Decisão central: como modelar "pipeline"

**Recomendado — discriminador em `leads` (reusa tudo).** Uma coluna `pipeline text` (`'inbound'` |
`'recuperacao'`) separa os dois funis logicamente. Todas as telas passam a receber `?pipeline=`.
Cadência de 6 toques, carteira, funil por coorte, notas e transições **já funcionam** para outbound
sem mudança de lógica — só precisam ser **escopadas por pipeline** nas 7 funções de leitura de
[`crm.ts`](src/lib/crm.ts): `listarLeads`, `contarPorStatus`, `contarAtrasados`, `listarCarteira`,
`contarCarteiraVencida`, `funilCoorte`, `distribuicaoPorNicho`.

- **Prós:** menor diff possível; um `/admin` só; a disciplina de cadência que já existe é
  exatamente o que uma lista de prospecção precisa. As etapas atuais (`novo → em_contato → orcado →
  fechado → perdido`) descrevem outbound tão bem quanto inbound.
- **Contras:** a tabela `leads` ganha colunas nullable que só o outbound usa. Mitigado guardando o
  grosso em `dados_import` (JSONB) em vez de 8 colunas novas.

**Rejeitado — tabela `prospects` separada.** "Pipeline separada" é uma separação *lógica*, não
física. Uma tabela nova duplicaria detalhe, lista, cadência, notas, transições e funil (ou exigiria
generalizar tudo com um parâmetro — mais trabalho que o discriminador). `// ponytail: um discriminador
resolve; tabela nova é um segundo CRM para manter.`

---

## Modelo de dados (delta de schema)

Segue o padrão de [`crm.ts`](src/lib/crm.ts) `aplicarSchema` (idempotente, `if not exists`, sob o
`pg_advisory_xact_lock` que já existe):

```sql
-- discriminador de pipeline
alter table leads add column if not exists pipeline text not null default 'inbound';
create index if not exists leads_pipeline_idx on leads (pipeline);

-- linha crua da planilha: o modal renderiza todas as colunas a partir daqui
alter table leads add column if not exists dados_import jsonb;

-- chave de idempotência da importação (arquivo + empresa)
alter table leads add column if not exists import_ref text;
create unique index if not exists leads_import_ref_uk on leads (import_ref) where import_ref is not null;

-- afrouxa NOT NULL das colunas que só o inbound preenche
-- (a integridade do inbound continua garantida na validação de api/lead.ts)
alter table leads alter column nome drop not null;
alter table leads alter column tipo_fita drop not null;
alter table leads alter column quantidade drop not null;
```

- Leads existentes viram `pipeline='inbound'` pelo `default` — zero migração de dados.
- **Backfill de transições** já existente semeia `null → status` para todos os leads, inclusive os
  importados, então o funil do outbound funciona de imediato.
- **Mapeamento no import** (para reusar features que leem colunas reais): `empresa→empresa`,
  `whatsapp || telefone → telefone` (o botão de WhatsApp e a busca usam `telefone`), `email→email`,
  `cnpj→cnpj`. O resto vive em `dados_import`. `confianca` é consultável por `dados_import->>'confianca'`
  (ordenar `alta` primeiro) — sem coluna dedicada.
- Se um dia precisar **filtrar/segmentar** a recuperação por `ramo`/`cidade_uf`, aí sim promover essas
  chaves do JSONB para colunas reais. YAGNI até haver a demanda.

---

## Importação da planilha

Script único e re-executável: `scripts/importar-recuperacao.mjs` (padrão dos scripts em
[`scripts/`](scripts/); roda com `DATABASE_URL`). **Não** fazer upload por tela — sem infra de upload,
sem JS no client; um script rodado uma vez é mais preguiçoso e auditável.

Passos:
1. Ler o CSV com **parser que respeita aspas + descarta o BOM** (o `split(",")` quebra em
   `"CORTINAS, PERSIANAS…"` — já mordeu neste handoff).
2. Para cada linha **com `empresa`** (pular a 1 linha sem empresa): `insert into leads (...) values (...)
   on conflict (import_ref) do nothing`, com `pipeline='recuperacao'`, `status='novo'`,
   `dados_import` = objeto com as 12 colunas, `import_ref = arquivo || '|' || empresa`.
3. Reusar `registrarTransicao(id, null, 'novo')` (como `inserirLead` faz) para o funil contar.
4. Idempotente: rodar de novo não duplica (chave única `import_ref`). Relatar
   inseridos/pulados/sem-empresa ao final.

> **29 empresas duplicadas** na planilha: `import_ref = arquivo|empresa` as trata como distintas
> (arquivos diferentes → provavelmente lojas/registros diferentes). Se forem duplicatas verdadeiras,
> revisar depois na tela — não bloquear o import.

---

## O "modal" do lead — todas as colunas como campo

O `/admin` é **zero-JS no client** (form POST + PRG). Recomendação: realizar o "modal" como uma
**seção no detalhe já existente** [`src/pages/admin/[id].astro`](src/pages/admin/[id].astro), não um
overlay com JS. Quando `lead.pipeline === 'recuperacao'`, renderizar um bloco **"Dados da prospecção"**
que percorre `dados_import` e emite **um campo por coluna, pré-preenchido e editável**:

- Rótulos humanos por um pequeno mapa (`arquivo→"Imagem-fonte"`, `cidade_uf→"Cidade/UF"`,
  `whatsapp→"WhatsApp"`, …); chaves desconhecidas caem em Title-case.
- Salvar via nova ação `acao=dados-import` (PRG): grava o objeto de volta em `dados_import` e
  ressincroniza os campos mapeados (`empresa/telefone/email/cnpj`).
- `arquivo`/`confianca` como somente-leitura (proveniência, não se edita).
- Reutilizar `inputCls`, `carimbo`, o botão de WhatsApp e a régua de cadência que já estão na página.

> **Se um overlay de verdade for requisito**, dá para fazer sem JS com `<dialog>` + `:target` (CSS
> puro) — mas é mais UI para o mesmo ganho. Decisão aberta (ver abaixo).

Painéis de cadência/pedidos/notas continuam iguais — a pipeline de recuperação usa a **mesma
cadência de 6 toques**; "fechado" pela 1ª venda cai na carteira do jeito que já existe.

---

## Listas, funil e carteira por pipeline

- **Seletor de pipeline** no header do [`AdminLayout.astro`](src/layouts/AdminLayout.astro): "Inbound"
  × "Recuperação" (troca `?pipeline=`). Default = `inbound` (não muda o que existe hoje).
- Threading de `pipeline` (default `'inbound'`) nas 7 funções de leitura de [`crm.ts`](src/lib/crm.ts)
  e nas páginas [`index.astro`](src/pages/admin/index.astro) e [`funil.astro`](src/pages/admin/funil.astro).
  Padrão idêntico ao filtro `nicho` já implementado (`(${pipeline}::text is null or pipeline = ${pipeline})`).
- Lista de recuperação: ordenar por `confianca` (alta→baixa) e "tem canal" antes de `criado_em`;
  mostrar `ramo`/`cidade_uf` na linha. Contadores por etapa e follow-up vencido já vêm de graça.
- Funil e carteira: as mesmas 3 taxas e a mesma fila de recontato, escopadas por `pipeline`.

---

## Segurança / privacidade

- Lista outbound é dado sensível de prospecção: vive **só sob `/admin`** (sessão + `noindex`,
  já garantido pelo `AdminLayout`). **Nada** vai para rota pública nem sitemap.
- Sem preço no público continua valendo. `docs/leads-bruto.csv` **não** deve ir para `dist/` público
  (está em `docs/`, fora de `public/` — ok; conferir que não é servido).

---

## Decisões a confirmar (antes de implementar)

1. **Modelo:** discriminador `pipeline` em `leads` (recomendado) **ou** tabela `prospects` separada?
2. **"Modal":** seção no detalhe `/admin/[id]` (recomendado, zero-JS) **ou** overlay `<dialog>`
   CSS-only?
3. **Etapas:** reusar `novo/em_contato/orcado/fechado/perdido` (recomendado) **ou** a recuperação
   quer etapas próprias (ex. `a_contatar → contatado → interessado → recuperado → descartado`)?
   — se quiser etapas próprias, `STATUS_LEAD` vira por-pipeline (mais trabalho).
4. **Import agora?** Rodar o import das 503 assim que o schema subir, ou só deixar o script pronto?
5. **Campos editáveis:** todas as 12 colunas editáveis, ou `arquivo`/`confianca` read-only
   (recomendado)?

---

## Próximos passos (fluxo Spec Kit)

Este projeto usa Spec Kit (`.specify/`) — a implementação deve seguir o fluxo, não editar direto:

1. `/speckit-specify` — feature "Multi-pipeline: pipeline de recuperação outbound", usando este
   handoff como base e travando as 5 decisões acima em `/speckit-clarify`.
2. `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`, validando com `/speckit-analyze`.
3. Esboço de tasks já visível: (a) schema delta + backfill, (b) parser CSV + `scripts/importar-recuperacao.mjs`,
   (c) `pipeline` nas 7 leituras + seletor no header, (d) bloco "Dados da prospecção" no detalhe +
   `acao=dados-import`, (e) teste de integração do import idempotente, (f) atualizar `handoff.md`.
