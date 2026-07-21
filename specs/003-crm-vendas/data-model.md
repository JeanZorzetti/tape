# Data Model — CRM de Vendas (003)

Estende o schema de `src/lib/crm.ts`. Segue o padrão existente: `create table if not exists`
/ `add column if not exists` em `aplicarSchema`, aplicado uma vez por processo. Datas de
evento em `timestamptz`; datas de agenda (próximo contato, data da compra) em `date`.

## Alteração em `leads` (tabela existente)

| Coluna | Tipo | Regra |
|---|---|---|
| `nicho` | `text` (nullable) | `alter table leads add column if not exists nicho text`. Valor ∈ `NICHOS` (`industria`, `distribuidor`, `ecommerce`, `lojas`, `outro`) ou `null` = "sem nicho". Validado na app contra a constante, como `isStatus`. |

Nenhuma outra coluna de `leads` muda. `status` e `proximo_contato` continuam como estão —
`proximo_contato` passa a significar "próximo toque" (em cadência) **ou** "próximo recontato"
(carteira), conforme o lead tenha ou não pedido (ver [research.md](research.md) D1).

## Nova tabela `tentativas` (toques de cadência da 1ª venda)

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `serial pk` | |
| `lead_id` | `int not null` | `references leads(id) on delete cascade` |
| `canal` | `text not null` | ∈ `CANAIS` (`whatsapp`, `telefone`, `email`) |
| `resultado` | `text not null` | ∈ `RESULTADOS` (`sem_resposta`, `respondeu`, `remarcar`) |
| `observacao` | `text` (nullable) | texto livre curto (≤ 500), opcional |
| `criado_em` | `timestamptz not null default now()` | |

- Índice: `tentativas_lead_idx on (lead_id)`.
- **Nº do toque atual** de um lead = `count(*)` em `tentativas`. Alimenta
  `proximaDataCadencia(nToques)` e `cadenciaEsgotada(nToques)`.

## Nova tabela `pedidos` (compras da carteira)

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `serial pk` | |
| `lead_id` | `int not null` | `references leads(id) on delete cascade` |
| `data` | `date not null` | data da compra (obrigatória) |
| `valor_centavos` | `int` (nullable) | valor em **centavos**; nunca float; opcional |
| `volume_rolos` | `int` (nullable) | quantidade de rolos; opcional |
| `criado_em` | `timestamptz not null default now()` | |

- Índice: `pedidos_lead_idx on (lead_id)`.
- **Cliente** = lead com `count(pedidos) ≥ 1`. **Última compra** = `max(data)`.
- Regra de negócio (transação em `inserirPedido`): se for o 1º pedido do lead →
  `status = 'fechado'` (+ `transicao`) e `proximo_contato = data + 30`. Demais pedidos →
  `proximo_contato = max(data) + 30`.

## Nova tabela `transicoes` (log de mudança de etapa — funil por coorte)

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `serial pk` | |
| `lead_id` | `int not null` | `references leads(id) on delete cascade` |
| `de_status` | `text` (nullable) | status anterior; `null` na transição inicial |
| `para_status` | `text not null` | novo status ∈ `STATUS_LEAD` |
| `criado_em` | `timestamptz not null default now()` | |

- Índice: `transicoes_lead_idx on (lead_id)`, `transicoes_para_idx on (para_status)`.
- Gravada em **toda** mudança de status: ao criar o lead (`null → novo`), em `atualizarLead`
  (só se o status mudou de fato), e em `inserirPedido` (`→ fechado`).
- **Backfill (FR-014a)**: `insert ... select` uma transição `null → status_atual` com
  `criado_em = lead.criado_em` para todo lead sem transição. Idempotente (`where not exists`).

## Constantes (fonte única, em `adminUi.ts`, formato de `STATUS_LEAD`)

```text
NICHOS      = [industria, distribuidor, ecommerce, lojas, outro]   # + null = "sem nicho"
CANAIS      = [whatsapp, telefone, email]
RESULTADOS  = [sem_resposta, respondeu, remarcar]
CADENCIA_DIAS           = [0, 1, 3, 7, 14, 21]   # dias corridos por toque
RECONTATO_CARTEIRA_DIAS = 30
```

## Ciclo de vida do lead (máquina de estado)

```text
              criar lead
                  │  (transicao null→novo)
                  ▼
   ┌── novo ──► em_contato ──► orcado ──┐        [cadência 1ª venda: proximo_contato = próximo toque]
   │     │           │            │     │
   │     └───────────┴────────────┴─► perdido    (manual; sugerido após 6º toque esgotado)
   │                                              (reabrir: perdido → novo/em_contato, cadência recomeça)
   │
   └────────► registrar 1º pedido ──► fechado ──► [carteira: proximo_contato = últ. compra + 30d]
                                          │
                                          ├─ novo pedido ──► reagenda carteira (últ. compra + 30d)
                                          └─ pausar carteira ──► proximo_contato = null (histórico preservado)
```

- Um lead está em **um** ciclo por vez: cadência de 1ª venda até o 1º pedido; carteira depois.
- `fechado` só é alcançado por pedido (caminho primário); status manual continua possível para
  correção, mas o fechamento "de verdade" que dispara carteira exige pedido.

## Rastreabilidade requisito → dado

| Requisito | Onde |
|---|---|
| FR-001 tentativas com canal/resultado | tabela `tentativas` |
| FR-002/003 próximo contato + cadência sugerida | `leads.proximo_contato` + `CADENCIA_DIAS` |
| FR-004 vencido | `estaAtrasado` (existente) |
| FR-005 esgotado após 6º | `cadenciaEsgotada(count(tentativas))` |
| FR-006/007 fechar = 1º pedido / cliente | `inserirPedido` (transação) + `count(pedidos)` |
| FR-008 pedido data+R$+volume, recontato 30d | tabela `pedidos` + `RECONTATO_CARTEIRA_DIAS` |
| FR-009 carteira vencida | `listarCarteira` / `contarCarteiraVencida` |
| FR-011 pausar carteira | `proximo_contato = null` |
| FR-013/014/014a funil coorte + backfill | tabela `transicoes` + `funilCoorte` |
| FR-015 período | `?periodo` sobre `leads.criado_em` |
| FR-017–020 nicho + filtro + distribuição + funil por nicho | `leads.nicho` + `NICHOS` + `group by` |
