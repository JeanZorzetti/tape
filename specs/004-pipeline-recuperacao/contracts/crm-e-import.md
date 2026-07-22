# Contracts — Multi-pipeline (recuperação)

Contratos internos da feature: assinaturas de `src/lib/crm.ts` (mudam ou nascem), a ação de
formulário nova no `/admin/[id]`, e o contrato de CLI do script de importação. Não há API HTTP
pública nova — o `/admin` é SSR com form POST + PRG.

## 1. `src/lib/crm.ts` — funções de leitura (escopadas por pipeline)

Todas ganham um parâmetro `pipeline` com **default `'inbound'`** (não quebra chamadas atuais). O
filtro segue o padrão já usado para `nicho`: `(${pipeline}::text is null or pipeline = ${pipeline})`
— aqui sempre com valor, então efetivamente `pipeline = ${pipeline}`.

| função | assinatura nova | comportamento |
|---|---|---|
| `listarLeads` | `listarLeads({ status?, busca?, nicho?, pipeline? })` | filtra por pipeline; ordena por "tem canal" → `confianca=alta` → `criado_em desc` (ver research D5); `status` validado contra a pipeline |
| `contarPorStatus` | `contarPorStatus(pipeline?)` | `group by status` escopado por pipeline |
| `contarAtrasados` | `contarAtrasados(pipeline?)` | exclui `ganho`/`perdido` **da pipeline** (via papéis), não literais |
| `listarCarteira` | `listarCarteira({ nicho?, pipeline? })` | clientes (com pedido) da pipeline |
| `contarCarteiraVencida` | `contarCarteiraVencida(pipeline?)` | vencidos da pipeline |
| `funilCoorte` | `funilCoorte(periodo, pipeline?, nicho?)` | `bool_or` usa os valores de papel da pipeline (`primeiro_toque/meio/ganho`) como parâmetros |
| `distribuicaoPorNicho` | `distribuicaoPorNicho(periodo?, pipeline?)` | distribuição escopada por pipeline |

## 2. `src/lib/crm.ts` — funções de escrita (papel em vez de literal)

| função | mudança |
|---|---|
| `registrarTentativa(leadId, canal, resultado, obs?, prox?)` | ao promover no 1º toque, lê `pipeline` do lead e usa `roles.inicial → roles.primeiro_toque` (hoje `'novo' → 'em_contato'`) |
| `inserirPedido(leadId, data, valor, volume)` | 1º pedido seta `roles.ganho` do lead (hoje `'fechado'`) + transição para esse valor |
| `atualizarLead(id, status, prox)` | inalterada na assinatura; `status` já vem validado pela pipeline na página |

## 3. `src/lib/crm.ts` — função nova

```ts
/** Grava dados_import (linha crua editada) e ressincroniza colunas espelhadas. */
salvarDadosImport(id: number, dados: Record<string, string>): Promise<void>
```

- Persiste `dados` em `leads.dados_import` (merge sobre o existente — `arquivo`/`confianca` não
  vêm do form, então são preservados).
- Ressincroniza: `empresa = dados.empresa`, `telefone = dados.whatsapp || dados.telefone`,
  `email = dados.email`, `cnpj = dados.cnpj || null`.
- Não sobrescreve coluna espelhada com vazio quando a chave correspondente veio vazia **e** a
  coluna já tinha valor? Regra: a UI mostra o valor atual, então salvar reflete o que o operador vê;
  vazio explícito → grava vazio (empresa mantém `not null` via `''`). Simples e previsível.

## 4. `src/lib/adminUi.ts` — configuração e helpers (novos/alterados)

`PIPELINES` e derivados vivem em `adminUi.ts` (módulo de baixo nível) para evitar o ciclo
`adminUi → crm → adminUi` (ver [research.md](../research.md) D1):

```ts
export const PIPELINES: Record<Pipeline, { label: string; stages: readonly Stage[]; roles: Roles }>
export type Pipeline = "inbound" | "recuperacao"
export const isPipeline: (v: string) => v is Pipeline
export const statusesDaPipeline: (p: Pipeline) => readonly Stage[]
export const rolesDaPipeline: (p: Pipeline) => Roles
export const TERMINAIS: ReadonlySet<string>                         // todos ganho+perdido
```

`adminUi.ts` também: `CLS_STATUS` ganha entradas para
`a_contatar/contatado/interessado/recuperado/descartado`; `estaAtrasado`/`vencidoCarteira` trocam
`status !== 'fechado' && status !== 'perdido'` por `!TERMINAIS.has(status)`.

`crm.ts` **reexporta** a taxonomia a partir de `PIPELINES` (compat com os imports atuais):

```ts
export const STATUS_LEAD = PIPELINES.inbound.stages          // compat
export const isStatus: (v: string, pipeline?: Pipeline) => boolean   // hoje sem 2º arg
export const statusLabel: (v: string) => string                     // lookup global (inalterado no uso)
```

## 5. Ação de formulário — `/admin/[id]` (POST, PRG)

Nova ação além de `salvar/tentativa/pedido/recontato-carteira/pausar-carteira/nota`:

```
acao=dados-import
campos: um input por chave editável de dados_import
        (empresa, ramo, telefone, whatsapp, cidade_uf, email, instagram, endereco, cnpj, observacao)
        arquivo e confianca NÃO são enviados (read-only)
efeito: salvarDadosImport(id, { ...dadosAtuais, ...camposDoForm }) e redirect /admin/{id}
guarda: só renderizada/aceita quando lead.pipeline === 'recuperacao'
```

Seletor de pipeline (`AdminLayout`): links de nav e ações preservam `?pipeline=` via querystring;
default ausente = `inbound`.

## 6. Script CLI — `scripts/importar-recuperacao.mjs`

```
uso:  DATABASE_URL=postgres://... node scripts/importar-recuperacao.mjs [caminho-csv]
      caminho-csv default: docs/leads-bruto.csv
entrada: CSV UTF-8 com BOM, 12 colunas, aspas com vírgulas internas
saída (stdout): relatório "inseridos: N · pulados: M · sem-empresa: K"
efeitos:
  - para cada linha COM empresa: insert em leads (pipeline='recuperacao', status='a_contatar',
    dados_import={12 colunas}, import_ref=arquivo|empresa, colunas espelhadas mapeadas)
    on conflict (import_ref) do nothing
  - registrarTransicao(id, null, 'a_contatar') para cada id inserido
idempotência: reexecutar não duplica (import_ref único)
NOTA: nesta feature o script é entregue pronto e testado; NÃO é executado contra produção.
```

Parser CSV (contrato mínimo): função pura `parseCsv(texto) -> string[][]` que (a) descarta BOM
inicial, (b) respeita aspas duplas incl. `""` e vírgula/quebra dentro de aspas. Coberta por
self-check `assert` no teste.

## 7. Invariantes de teste (contrato de verificação)

- `parseCsv` devolve a linha `ALKAN,"CORTINAS, PERSIANAS, TOLDOS, TAPETES",...` com o ramo como
  **um** campo.
- Import de uma amostra: linhas com empresa viram leads `recuperacao/a_contatar` com
  `dados_import` completo; linha sem empresa é pulada; reexecução insere 0.
- Escopo: com 1 lead inbound + 1 recuperação, cada leitura escopada retorna só a sua pipeline.
- Papéis: 1º toque num lead de recuperação leva `a_contatar → contatado`; 1º pedido leva a
  `recuperado` e agenda carteira +30d.
