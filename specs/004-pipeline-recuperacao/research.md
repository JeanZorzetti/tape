# Phase 0 — Research: Multi-pipeline (recuperação)

As 5 decisões de escopo já foram travadas com o usuário antes da spec; este documento resolve as
**questões técnicas** que sobram para implementar "etapas próprias por pipeline" e a importação, sem
duplicar a máquina do CRM.

## D1 — Etapas próprias por pipeline sem duplicar cadência/carteira/funil

**Decisão**: introduzir um mapa `PIPELINES` em `adminUi.ts` que dá, por pipeline, as **etapas**
(value+label, na ordem do funil) e os **papéis** semânticos. Trocar os literais de status hoje
hardcoded por lookup de papel.

> **Por que `adminUi.ts` e não `crm.ts`:** `adminUi` é o módulo de baixo nível (`crm` já importa
> dele: `RECONTATO_CARTEIRA_DIAS`, `inicioPeriodo`, `isNicho`, `taxasFunil`). Como `estaAtrasado`/
> `vencidoCarteira` (em `adminUi`) precisam de `TERMINAIS`, e `TERMINAIS` deriva de `PIPELINES`,
> pôr `PIPELINES` em `crm.ts` criaria ciclo `adminUi → crm → adminUi`. `crm.ts` reexporta
> `STATUS_LEAD`/`isStatus`/`statusLabel` a partir de `PIPELINES` para não quebrar os imports atuais.

Os 5 papéis (idênticos nas duas pipelines, só muda o rótulo/valor):

| papel | inbound | recuperação | usado por |
|---|---|---|---|
| `inicial` | `novo` | `a_contatar` | estado de entrada; 1º toque promove a partir daqui |
| `primeiro_toque` | `em_contato` | `contatado` | `registrarTentativa`; funil (contatados) |
| `meio` | `orcado` | `interessado` | funil (taxa do meio) |
| `ganho` | `fechado` | `recuperado` | `inserirPedido`; carteira; funil (ganho); "vivo?" |
| `perdido` | `perdido` | `descartado` | "vivo?"; excluído de atrasados |

**Rationale**: a correspondência é 1:1, então a diferença entre as pipelines é puramente
cosmética (rótulo + valor da string). Um mapa de papéis é o mínimo que satisfaz "etapas próprias"
mantendo a lógica única. Como os **valores de status não colidem** entre pipelines
(`novo/em_contato/orcado/fechado/perdido` × `a_contatar/contatado/interessado/recuperado/descartado`),
dá para ter lookups **globais** onde ajuda:
- `statusLabel(v)` procura em todas as pipelines (rótulo é único por valor).
- `TERMINAIS` = conjunto de todos os `ganho`+`perdido` das duas pipelines. `estaAtrasado` /
  `vencidoCarteira` decidem "lead vivo?" por pertencer ou não a `TERMINAIS`, **sem** precisar
  receber a pipeline — muda pouquíssimo os helpers de `adminUi.ts`.
- `funilCoorte`, `registrarTentativa`, `inserirPedido`, `contarAtrasados` recebem/derivam a
  pipeline e usam os valores de papel dela (parâmetros na query, não literais).

**Alternativas rejeitadas**:
- *Manter status global e só relabelar por pipeline*: contraria a decisão do usuário (etapas
  próprias = valores próprios).
- *Duplicar as funções (uma por pipeline)*: é o "segundo CRM" que o handoff rejeita.
- *Generalizar tudo com N etapas arbitrárias*: YAGNI — são exatamente 2 pipelines com 5 papéis.

## D2 — Parser de CSV (aspas + BOM) sem dependência nova

**Decisão**: escrever um parser mínimo (~25 linhas) no próprio `scripts/importar-recuperacao.mjs`,
que respeita aspas duplas (incl. `""` escapado e vírgulas/quebras dentro de aspas) e descarta o BOM
inicial. Acompanha um `assert`-self-check no teste.

**Rationale**: não há lib de CSV instalada (rung "dependência já instalada" falha) e o `split(",")`
comprovadamente quebra em `"CORTINAS, PERSIANAS, TOLDOS, TAPETES"` (o handoff já mordeu isso).
Adicionar `csv-parse` seria uma dependência para o que 25 linhas resolvem. O formato do arquivo é
conhecido e estável (export próprio), então um parser RFC-4180-simples basta.

**Alternativas rejeitadas**: `csv-parse`/`papaparse` (dependência desnecessária); `split(",")`
(quebra — proibido pelo handoff).

## D3 — Idempotência da importação

**Decisão**: `import_ref = arquivo || '|' || empresa`, com índice único parcial
(`where import_ref is not null`), e `insert ... on conflict (import_ref) do nothing returning id`.
Só os ids efetivamente inseridos recebem `registrarTransicao(id, null, 'a_contatar')`.

**Rationale**: reexecutar não duplica. As **29 empresas duplicadas** da planilha ficam distintas
quando vêm de `arquivo` diferente (provável loja/registro diferente); duplicata verdadeira é
revisada na tela depois, sem bloquear o import. O índice parcial não afeta leads inbound
(`import_ref is null`).

**Alternativas rejeitadas**: dedup só por `empresa` (fundiria lojas homônimas de arquivos
distintos); sem chave (reexecução duplicaria tudo).

## D4 — NOT NULL e colunas mapeadas

**Decisão**: afrouxar `not null` apenas de `nome`, `tipo_fita`, `quantidade` (colunas que só o
inbound preenche). Manter `empresa/email/telefone` `not null` e inserir **string vazia** quando o
dado não existe na planilha. Mapear no import: `empresa→empresa`,
`whatsapp || telefone → telefone`, `email→email`, `cnpj→cnpj`; o resto vive em `dados_import`.

**Rationale**: `empresa` está 100% preenchida (linhas sem empresa são puladas). `email`/`telefone`
frequentemente vazios, mas `''` satisfaz o `not null` e mantém a busca/lista simples; a integridade
do inbound continua garantida por `api/lead.ts` (FR-022), que valida os obrigatórios antes de
inserir — afrouxar o schema não afrouxa o formulário público. Os 4 campos mapeados são espelhados
para que busca, botão de WhatsApp e telas usem o dado; `salvarDadosImport` os ressincroniza ao
enriquecer.

**Alternativas rejeitadas**: promover ramo/cidade_uf/etc. a colunas reais agora (YAGNI até haver
demanda de filtro/segmentação — ficam consultáveis via `dados_import`).

## D5 — Ordenação da lista de recuperação

**Decisão**: um único `ORDER BY` serve às duas pipelines:

```sql
order by
  (case when coalesce(telefone,'') <> '' or coalesce(email,'') <> ''
        or coalesce(dados_import->>'instagram','') <> '' then 0 else 1 end),
  (dados_import->>'confianca' = 'alta') desc nulls last,
  criado_em desc
```

**Rationale**: prioriza "tem canal" e depois `confianca=alta`, como pede a FR-006. Para leads
**inbound** `telefone`/`email` estão sempre preenchidos (→ chave 0) e `dados_import` é nulo (→
segunda chave nula, `nulls last` empata), degradando exatamente para o `order by criado_em desc`
de hoje: nenhuma mudança observável no inbound (SC-002).

**Alternativas rejeitadas**: dois `ORDER BY` condicionais por pipeline (mais código para o mesmo
efeito, já que o inbound é invariante sob a ordenação nova).

## D6 — Reuso do backfill de transições

**Decisão**: manter `backfillTransicoes` (semeia `null → status` para leads sem transição). O import
já registra a transição inicial dos inseridos; o backfill é a rede de segurança idempotente para
qualquer lead que escape (incl. os importados, se rodados antes de um `db()`).

**Rationale**: `db()` roda `aplicarSchema` → `backfillTransicoes` no bootstrap, então o funil da
recuperação conta desde o primeiro carregamento mesmo sem alteração. `where not exists` garante zero
duplicação.

## D7 — Como o script importa a camada de dados

**Decisão**: `importar-recuperacao.mjs` faz `import { db, registrarTransicao } from
"../src/lib/crm.ts"` e usa a conexão `postgres` do próprio `db()`.

**Rationale**: Node 22.18 faz type-stripping por padrão (os testes já importam `.ts` de `.mjs`).
Reusa o bootstrap de schema idempotente e o `registrarTransicao` — sem reimplementar conexão nem
SQL de transição. O script roda com `DATABASE_URL` no ambiente, como os demais em `scripts/`.

## Resumo das mudanças por arquivo (entra em tasks)

- `adminUi.ts`: `PIPELINES`+papéis+helpers (`isPipeline`/`statusesDaPipeline`/`rolesDaPipeline`) e
  `TERMINAIS` (D1); `CLS_STATUS` +5 etapas; helpers "vivo?" (`estaAtrasado`/`vencidoCarteira`) via
  `TERMINAIS`.
- `crm.ts`: schema delta (D3/D4); reexporta `STATUS_LEAD`/`isStatus`/`statusLabel` a partir de
  `PIPELINES`; `Lead` ganha `pipeline` e `dados_import`; escopar `listarLeads/contarPorStatus/
  contarAtrasados/listarCarteira/contarCarteiraVencida/funilCoorte/distribuicaoPorNicho` por
  pipeline; papéis em `registrarTentativa/inserirPedido`; `salvarDadosImport` nova.
- `AdminLayout.astro`: seletor de pipeline; propagar `?pipeline=`.
- `admin/index.astro`, `admin/funil.astro`: thread `?pipeline=`; etapas/rótulos por pipeline;
  coluna ramo/cidade_uf na lista de recuperação.
- `admin/[id].astro`: status por pipeline; ficha/saudação pipeline-aware; seção "Dados da
  prospecção" + `acao=dados-import`.
- `scripts/importar-recuperacao.mjs` (novo, D2/D3/D7); `tests/importar-recuperacao.test.mjs` (novo).
