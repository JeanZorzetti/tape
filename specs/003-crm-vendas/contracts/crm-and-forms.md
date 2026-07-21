# Contracts — CRM de Vendas (003)

Projeto interno (site + `/admin` sob sessão). Os "contratos" aqui são as **fronteiras
estáveis** que as tasks devem respeitar: assinaturas do data-layer (`crm.ts`/`adminUi.ts`),
as **ações de formulário** (o campo `acao` do POST, padrão já usado no `[id].astro`) e as
**rotas/query params**. Sem API pública nova.

## 1. Data-layer — novas funções em `src/lib/crm.ts`

```ts
// Cadência
registrarTentativa(leadId: number, canal: Canal, resultado: Resultado, observacao?: string,
                   proximoContato?: string | null): Promise<void>
  // insere em `tentativas`; se proximoContato vier, atualiza leads.proximo_contato
contarTentativas(leadId: number): Promise<number>          // nº de toques já dados

// Carteira / pedidos
inserirPedido(leadId: number, data: string, valorCentavos: number | null,
              volumeRolos: number | null): Promise<void>
  // TRANSAÇÃO: insere pedido; se 1º → status 'fechado' (+registrarTransicao) e
  //            proximo_contato = data + 30d; senão → proximo_contato = max(data) + 30d
listarPedidos(leadId: number): Promise<Pedido[]>           // desc por data
listarCarteira(filtro?: { nicho?: string }): Promise<Lead[]>
  // clientes (tem pedido) ordenados por proximo_contato asc (vencidos primeiro)
contarCarteiraVencida(): Promise<number>                   // clientes com proximo_contato <= hoje
pausarCarteira(leadId: number): Promise<void>              // proximo_contato = null

// Funil por coorte
registrarTransicao(leadId: number, de: string | null, para: string): Promise<void>
funilCoorte(periodo: Periodo, nicho?: string): Promise<FunilResultado>
  // FunilResultado = {
  //   porEtapa: Record<StatusLead, number>,      // contagem atual por status na coorte
  //   totalLeads: number,
  //   chegaramEmContato, chegaramOrcado, chegaramFechado: number,  // via transicoes
  //   taxaLeadFechado, taxaEmContatoFechado, taxaOrcadoFechado: number | null  // null = sem base
  // }
distribuicaoPorNicho(periodo?: Periodo): Promise<{ nicho: string | null; total: number }[]>

// Nicho no lead
definirNicho(leadId: number, nicho: string | null): Promise<void>
```

**Alterações em funções existentes:**
- `inserirLead(...)` → passa a chamar `registrarTransicao(id, null, 'novo')` no mesmo fluxo.
- `atualizarLead(id, status, proximo)` → se `status` mudou, chama
  `registrarTransicao(id, statusAntigo, status)`.
- `listarLeads(filtro)` → aceita `nicho?: string` além de `status`/`busca`.
- `aplicarSchema(sql)` → cria `tentativas`, `pedidos`, `transicoes`, adiciona `leads.nicho`,
  roda o backfill idempotente de transições.

**Validação/erros**: `canal`/`resultado`/`nicho`/`status`/`periodo` validados contra as
constantes (padrão de `isStatus`); valor inválido é ignorado (não grava), como o
`[id].astro` já faz. `valor_centavos`/`volume_rolos` ausentes → `null`. Money sempre inteiro
em centavos.

## 2. Helpers puros — `src/lib/adminUi.ts`

```ts
NICHOS: readonly { value: string; label: string }[]
CANAIS, RESULTADOS: readonly { value: string; label: string }[]
CADENCIA_DIAS: readonly number[]          // [0,1,3,7,14,21]
RECONTATO_CARTEIRA_DIAS: number           // 30
nichoLabel(v: string | null): string
proximaDataCadencia(nToques: number, baseISO: string): string | null  // null se esgotada
cadenciaEsgotada(nToques: number): boolean          // nToques >= CADENCIA_DIAS.length
vencidoCarteira(proximoContato: Date | null, temPedido: boolean, hoje: string): boolean
formatarBRL(centavos: number | null): string        // "R$ 1.234,50" | "—"
```

*(São funções sem I/O — alvo direto dos testes unit.)*

## 3. Ações de formulário (POST, `acao=…`)

Todas seguem o padrão atual: POST → efeito → `Astro.redirect` (PRG). Zero JS no client.

### `POST /admin/[id]`
| `acao` | Campos | Efeito |
|---|---|---|
| `salvar` *(existente)* | `status`, `proximoContato` | `atualizarLead` (+ transição se status mudou) |
| `nicho` **novo** | `nicho` | `definirNicho` |
| `tentativa` **novo** | `canal`, `resultado`, `observacao?`, `proximoContato?` | `registrarTentativa` — grava toque; `proximoContato` já vem pré-preenchido com a data sugerida (editável) |
| `pedido` **novo** | `data`, `valor?`, `volume?` | `inserirPedido` — 1º pedido fecha o lead e agenda carteira |
| `nota` *(existente)* | `texto` | `adicionarNota` |
| `pausar-carteira` **novo** | — | `pausarCarteira` |

`valor` é digitado em reais no form e convertido para centavos no servidor (parse tolerante:
`"1.234,50"` → `123450`). `data` do pedido é `type=date` (default = hoje).

### `POST /admin/[id]` — reabrir lead perdido
Coberto por `acao=salvar` mudando o status de `perdido` para `novo`/`em_contato` (a transição
é registrada; a cadência recomeça a partir da contagem de tentativas).

## 4. Rotas e query params

| Rota | Método | Params | Saída |
|---|---|---|---|
| `/admin` *(existente)* | GET | `status?`, `q?`, **`nicho?`**, **`visao=leads\|carteira`** | lista filtrada; `visao=carteira` mostra clientes por `proximo_contato`; contadores incluem carteira vencida |
| `/admin/[id]` *(existente)* | GET/POST | — | ficha + painéis de cadência, pedidos, nicho |
| `/admin/funil` **novo** | GET | `periodo=mes\|ano\|tudo` (default `mes`), `nicho?` | contagem por etapa, 3 taxas, distribuição por nicho |

`/admin/funil` é `noindex` (AdminLayout) e exige sessão, como todo o `/admin`. Link para ele
no header do `AdminLayout`.

## 5. Invariantes de contrato (o que os testes provam)

- Registrar o **1º** pedido ⇒ `status='fechado'`, existe `transicao …→fechado`,
  `proximo_contato = data + 30`. Registrar o **2º** ⇒ status intacto, carteira reagendada.
- `contarTentativas` reflete 1:1 as tentativas gravadas; `cadenciaEsgotada` vira `true` no 6º.
- Backfill: rodar `aplicarSchema` duas vezes **não** duplica transições.
- Funil: divisor zero ⇒ taxa `null` (UI mostra "—"), nunca erro/`NaN`.
- Nada em `pedidos`/valores aparece em rota pública (só sob sessão `/admin`).
