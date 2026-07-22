# Phase 1 — Data Model: Multi-pipeline (recuperação)

Nenhuma tabela nova. A entidade `leads` é **estendida**; `transicoes`, `tentativas`, `pedidos`,
`notas` ficam **inalteradas** (já referenciam `leads` por id e são agnósticas de pipeline).

## Entidade `leads` (delta)

Colunas novas / alteradas (o resto permanece como em `crm.ts` `aplicarSchema`):

| coluna | tipo | regra | origem |
|---|---|---|---|
| `pipeline` | `text not null default 'inbound'` | `'inbound'` \| `'recuperacao'`; leads existentes viram `inbound` pelo default (zero migração) | novo |
| `dados_import` | `jsonb` (nullable) | linha crua da planilha (12 chaves) para leads de recuperação; `null` no inbound | novo |
| `import_ref` | `text` (nullable) | `arquivo\|empresa`; único parcial `where import_ref is not null` (idempotência) | novo |
| `nome` | `text` **nullable** | deixa de ser `not null` (recuperação não tem pessoa) | afrouxado |
| `tipo_fita` | `text` **nullable** | idem (só inbound preenche) | afrouxado |
| `quantidade` | `text` **nullable** | idem | afrouxado |
| `empresa`, `email`, `telefone` | `text not null` | **mantidos**; import insere `''` quando ausente | inalterado |

Índices novos: `leads_pipeline_idx (pipeline)`; `leads_import_ref_uk (import_ref) unique where import_ref is not null`.

### DDL (idempotente, dentro do `pg_advisory_xact_lock` de `aplicarSchema`)

```sql
alter table leads add column if not exists pipeline text not null default 'inbound';
create index if not exists leads_pipeline_idx on leads (pipeline);
alter table leads add column if not exists dados_import jsonb;
alter table leads add column if not exists import_ref text;
create unique index if not exists leads_import_ref_uk on leads (import_ref) where import_ref is not null;
alter table leads alter column nome drop not null;
alter table leads alter column tipo_fita drop not null;
alter table leads alter column quantidade drop not null;
```

### Interface `Lead` (TypeScript) — campos adicionados

```
pipeline: "inbound" | "recuperacao"
dados_import: Record<string, string> | null
```

(`nome`/`tipo_fita`/`quantidade` passam a poder ser `null`; consumidores no `[id].astro` já
tratam via renderização pipeline-aware.)

## Configuração de pipeline (não é tabela — constante em `adminUi.ts`)

> Fica em `adminUi.ts` (módulo de baixo nível) para evitar ciclo de import: `crm.ts` já importa de
> `adminUi.ts`, e `estaAtrasado`/`vencidoCarteira` (em `adminUi`) dependem de `TERMINAIS`, que deriva
> de `PIPELINES`. `crm.ts` reexporta `STATUS_LEAD`/`isStatus`/`statusLabel` a partir daqui.

```
PIPELINES = {
  inbound:     { label: "Inbound",     stages: [novo, em_contato, orcado, fechado, perdido],
                 roles: { inicial: novo, primeiro_toque: em_contato, meio: orcado,
                          ganho: fechado, perdido: perdido } },
  recuperacao: { label: "Recuperação", stages: [a_contatar, contatado, interessado, recuperado, descartado],
                 roles: { inicial: a_contatar, primeiro_toque: contatado, meio: interessado,
                          ganho: recuperado, perdido: descartado } },
}
```

Cada `stage` é `{ value, label }` (mesmo formato de `STATUS_LEAD`). Derivados:
- `statusesDaPipeline(p)` → `PIPELINES[p].stages` (as páginas iteram isto no lugar de `STATUS_LEAD`).
- `rolesDaPipeline(p)` → mapa de papéis (usado nas escritas/funil).
- `isPipeline(v)`, `isStatus(v, pipeline?)`, `statusLabel(v)` (lookup global), `TERMINAIS` (Set com
  todos os `ganho`+`perdido`).

### Transições de etapa (recuperação)

```
a_contatar ──(1º toque)──> contatado ──> interessado ──(1º pedido)──> recuperado
     │                          │              │
     └──────────────┴──────────┴──────> descartado   (perda, manual)
```

- `a_contatar → contatado`: automático no 1º toque de cadência (`registrarTentativa`, via papel).
- `→ recuperado`: automático no 1º pedido (`inserirPedido`, via papel `ganho`); entra na carteira.
- `→ descartado`: manual (ação "salvar" no detalhe).
- Transições intermediárias (`contatado → interessado`): manuais, como no inbound.

## `dados_import` — 12 chaves da planilha

`arquivo, empresa, ramo, telefone, whatsapp, cidade_uf, email, instagram, endereco, cnpj,
confianca, observacao`.

- **Somente leitura** na UI: `arquivo`, `confianca` (proveniência).
- **Editáveis**: as outras 10.
- **Espelhadas em colunas reais** ao salvar (`salvarDadosImport`): `empresa`, `telefone`
  (de `whatsapp||telefone`), `email`, `cnpj`.
- `confianca` consultável por `dados_import->>'confianca'` (ordenação da lista); sem coluna dedicada.

## Regras de validação

- **Pipeline**: valor fora de `{inbound, recuperacao}` → tratado como `inbound` (default seguro; o
  seletor só emite os dois válidos).
- **Status**: transição só aceita valores da pipeline do lead (`isStatus(v, lead.pipeline)`); valor
  inválido é ignorado (mesma postura do `atualizarLead` atual).
- **Inbound intacto**: `api/lead.ts` continua exigindo `nome, empresa, email, telefone, tipo_fita,
  quantidade` antes de inserir — o afrouxamento do schema não afeta a validação do formulário público.
- **Import**: linha sem `empresa` é pulada e contabilizada; `import_ref` duplicado → `do nothing`.

## Segurança / privacidade

- `pipeline`, `dados_import` e a lista de recuperação vivem **só** sob `/admin` (sessão + `noindex`
  do `AdminLayout`). Nenhuma rota pública, sitemap ou build estático os expõe.
- `docs/leads-bruto.csv` permanece fora de `public/`; conferir que não é servido no build.
