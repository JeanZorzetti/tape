# Data Model — Execução da prospecção (Phase 1)

**Sem alteração de esquema.** A feature não cria nem altera tabelas. Reusa `tentativas`, `leads`
(`dados_import`, `nicho`, `pipeline`, `telefone`, `empresa`) das specs 003/004. As "entidades" novas são
**conteúdo do aplicativo** e **valores derivados**, não linhas de banco.

## Entidades

### Script de abordagem (conteúdo no app — `src/lib/scripts.ts`)

Fonte de verdade da tela e das mensagens. Chaveado por **nicho** e **passo da cadência**.

| Campo | Tipo | Regra |
|---|---|---|
| `porNicho[nicho][passo]` | string (template) | 6 passos (0–5) por nicho de `NICHOS`; usa `[empresa]`/`[nome]`. |
| `generico[passo]` | string (template) | Fallback para lead sem nicho / nicho "outro" — 6 passos. |
| `objecoes[]` | `{ pergunta, resposta }[]` | Respostas de referência (preço, fornecedor atual, custo do clichê). |

- **passo** = `passoDoLead(nToques)` = `min(nToques, 5)`; `nToques = tentativas.length`.
- **Cobertura**: todo `NICHOS.value` (industria, distribuidor, e-commerce, lojas, outro) tem entrada;
  ausência de nicho ou nicho sem mapa → `generico`. Invariante testada (SC-003).
- **Origem editorial**: [`docs/estrategia-prospeccao.md`](../../docs/estrategia-prospeccao.md) §4 (paralelo,
  não lido em runtime).

### Meta diária de toques (constante — `src/lib/adminUi.ts`)

| Campo | Tipo | Regra |
|---|---|---|
| `META_TOQUES_DIA` | number | Default **20**; override por env `META_TOQUES_DIA`. Nunca 0 (evita divisão por zero, FR-010). |

### Toques do dia (valor derivado — `src/lib/crm.ts`)

Não é entidade persistida; é uma **contagem** lida a cada carregamento da lista.

| Campo | Tipo | Regra |
|---|---|---|
| `contarToquesHoje(pipeline)` | `Promise<number>` | `count(tentativas)` de hoje (America/Sao_Paulo) com `join leads` na `pipeline` dada. |

## Entidades reusadas (sem mudança)

- **Tentativa** (`tentativas`, spec 003): `criado_em timestamptz`, `lead_id`. Dupla função: `count` por lead →
  passo do script; `count` por dia/pipeline → contador de ritmo.
- **Lead** (`leads`, specs 003/004): `empresa`, `nome`, `telefone`, `nicho`, `pipeline`, `dados_import`
  (JSONB — de onde sai `instagram`). Nenhuma coluna nova.
- **Nicho** (`NICHOS`, spec 003): chave de seleção do script.
- **Cadência** (`CADENCIA_DIAS`, spec 003): define os 6 passos que os scripts espelham.

## Helpers puros novos (testáveis sem banco)

| Função | Assinatura | Responsabilidade |
|---|---|---|
| `passoDoLead` | `(nToques: number) => 0..5` | Mapeia contagem de toques ao índice de script. |
| `montarScript` | `(template: string, ctx: { empresa: string; nome?: string }) => string` | Substitui placeholders; **nenhum `[...]` sobra** (SC-004). |
| `scriptDoLead` | `(nicho, nToques) => string (template)` | Escolhe nicho→passo, com fallback genérico. |
| `instagramUrl` | `(bruto: string \| null) => string \| null` | Normaliza handle → URL de perfil; `null` se implausível. |

## Transições / estados relevantes

- **Passo do script** acompanha o estado da cadência já existente: 0 tentativas → 1º toque; cada tentativa
  registrada avança um passo; ≥6 → despedida + aviso de cadência esgotada (já renderizado na ficha).
- **Contador do dia** reinicia sozinho na virada do dia no fuso de operação (é sempre uma leitura de "hoje").
