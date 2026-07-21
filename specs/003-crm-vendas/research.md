# Research & Design Decisions — CRM de Vendas (003)

Todas as clarificações do spec já estão resolvidas; não há `NEEDS CLARIFICATION` pendente.
Este documento registra as decisões de design que orientam a Phase 1.

## D1 — Reusar `leads.proximo_contato` para as duas cadências (1ª venda e carteira)

- **Decisão**: manter a única coluna `proximo_contato` como "próxima ação" do lead. Antes
  do 1º pedido ela é o próximo toque de cadência; depois do 1º pedido é o próximo recontato
  de carteira. Um lead está em exatamente um ciclo por vez (cadência até fechar, carteira
  depois), então uma coluna basta.
- **Rationale**: zero migração de dados, reusa `estaAtrasado`/`isoDe`/`dataBR`. O ciclo é
  determinado por "tem pedido?" — não precisa de flag extra.
- **Alternativas rejeitadas**: duas colunas (`proximo_toque` + `proximo_recontato`) — estado
  redundante, dois lugares para esquecer de limpar. `null` em `proximo_contato` de um cliente
  = carteira pausada (FR-011), sem coluna de status extra.

## D2 — `tentativas` como tabela própria (não estender `notas`)

- **Decisão**: nova tabela `tentativas` (lead_id, canal, resultado, observacao?, criado_em).
  O número do toque atual = `count(*)` de tentativas do lead; dispara o cálculo da próxima
  data e o "esgotado" após o 6º.
- **Rationale**: contagem de toques trivial e sem ambiguidade; `notas` continua sendo texto
  livre geral. Copia o padrão visual da timeline de notas no `[id].astro`.
- **Alternativas rejeitadas**: colunas `canal`/`resultado` em `notas` — misturaria toque
  estruturado com nota livre e faria a contagem depender de `where resultado is not null`.
  Ganho de "uma tabela a menos" não paga a ambiguidade.

## D3 — Cadência como função pura de intervalos (`proximaDataCadencia`)

- **Decisão**: `const CADENCIA_DIAS = [0, 1, 3, 7, 14, 21]`. `proximaDataCadencia(nToques, base)`
  devolve `base + CADENCIA_DIAS[nToques]` (dias corridos); `cadenciaEsgotada(nToques)` =
  `nToques >= CADENCIA_DIAS.length`. A data é **sugerida** e sempre editável no form (híbrido).
- **Rationale**: lógica testável isolada em `adminUi.ts`, sem I/O. O array é a fonte única da
  cadência — mudar a régua é mudar uma linha.
- **Alternativas rejeitadas**: tabela `cadencia_config` no banco — YAGNI para 1 representante;
  vira config quando houver mais de uma cadência.
- **ponytail**: `// ponytail: cadência fixa em array; se precisar de mais de uma régua, vira tabela`.

## D4 — Pedido: valor em **centavos (integer)**, volume em rolos (integer), data obrigatória

- **Decisão**: `pedidos(lead_id, data date not null, valor_centavos int null, volume_rolos int null)`.
  Dinheiro em centavos inteiros; nunca float. `formatarBRL(centavos)` no `adminUi.ts` para exibir.
- **Rationale**: evita erro de ponto flutuante em dinheiro (money path — não simplificar).
  Ambos os valores opcionais, como decidido; só a data é obrigatória.
- **Alternativas rejeitadas**: `numeric(10,2)` — funciona, mas centavos int é mais simples de
  somar/testar e já é o hábito do projeto de tratar número como dado.

## D5 — 1º pedido fecha o lead e agenda a carteira (transação única)

- **Decisão**: `inserirPedido` roda em transação: insere o pedido; se era o 1º pedido do lead,
  muda status para `fechado` (gravando a `transicao` correspondente) e define
  `proximo_contato = data_da_compra + 30 dias`. Pedidos seguintes só reagendam a carteira a
  partir da última compra.
- **Rationale**: atende FR-006/FR-007/FR-008 num só ato, sem estado intermediário inconsistente
  ("cliente sem pedido" ou "pedido sem fechar").
- **Alternativas rejeitadas**: fechar manualmente e registrar pedido em passos separados —
  duas chances de esquecer metade; contradiz a clarificação escolhida.
- **Recorrência**: `RECONTATO_CARTEIRA_DIAS = 30`. `// ponytail: intervalo fixo; vira campo por
  cliente se a carteira exigir cadências diferentes`.

## D6 — Funil por coorte via tabela `transicoes` + backfill idempotente

- **Decisão**: `transicoes(lead_id, de_status text null, para_status text not null, criado_em)`.
  Toda mudança de status grava uma linha (inclusive a inicial `null → novo` ao criar o lead).
  "Chegou à etapa X" = existe transição com `para_status = X`. Taxas:
  - **lead→fechado** = leads da coorte que chegaram a `fechado` ÷ total de leads da coorte.
  - **em contato→fechado** = chegaram a `fechado` **e** a `em_contato` ÷ chegaram a `em_contato`.
  - **orçado→fechado** = chegaram a `fechado` **e** a `orcado` ÷ chegaram a `orcado`.
  Coorte = leads com `criado_em` no período. Divisor zero → exibe "—" (FR-016).
- **Backfill (FR-014a)**: ao aplicar o schema, `insert into transicoes (lead_id, null, status, criado_em)
  select id, ... from leads l where not exists (select 1 from transicoes t where t.lead_id = l.id)`.
  Idempotente: leads já semeados não recebem duplicata; pode rodar a cada start.
- **Rationale**: coorte real precisa saber por quais etapas o lead passou — o status atual não
  guarda isso. `transicoes` é o log mínimo que responde as três taxas.
- **Alternativas rejeitadas**: snapshot dos status atuais (rejeitado na clarificação — não sabe
  o histórico). Guardar máquina de estado completa com timestamps por etapa em colunas do lead —
  mais rígido e não cobre revisita de etapa.

## D7 — Período do funil: default "este mês", alternância mês/ano/tudo

- **Decisão**: parâmetro `?periodo=mes|ano|tudo`, default `mes`. Filtra a coorte por
  `leads.criado_em`. (Resolve o item de baixo impacto deferido no `/speckit-clarify`.)
- **Rationale**: "este mês" é a leitura operacional mais comum; alternância cobre visão anual e
  histórica sem inventar seletor de datas custom.
- **Alternativas rejeitadas**: date range custom — mais UI, sem demanda; YAGNI.

## D8 — Nicho como coluna + constante espelhando `STATUS_LEAD`

- **Decisão**: `alter table leads add column if not exists nicho text`. Lista canônica
  `NICHOS = [{industria}, {distribuidor}, {ecommerce}, {lojas}, {outro}]` em `adminUi.ts`,
  mesmo formato de `STATUS_LEAD`. `null` = "sem nicho". Reusa os 4 segmentos do site.
- **Rationale**: DRY com a taxonomia que o site já usa; `add column if not exists` segue o
  padrão de schema auto-aplicado. Filtro e distribuição saem de `group by nicho`.
- **Alternativas rejeitadas**: tabela `nichos` + FK — YAGNI para 5 valores fixos; texto validado
  contra a constante (mesmo padrão de `isStatus`) já garante integridade.

## D9 — Carteira e categorias reusam a lista; só o funil ganha rota

- **Decisão**: `index.astro` ganha `?visao=carteira` (clientes ordenados por `proximo_contato`,
  vencidos destacados) e `?nicho=`. Distribuição por nicho e taxas por nicho moram na página
  `/admin/funil`. Nenhuma outra rota nova.
- **Rationale**: menos páginas, reusa a UI de lista/filtro já aprovada. O funil é a única visão
  com layout próprio (taxas + período).
- **Alternativas rejeitadas**: `/admin/carteira` e `/admin/categorias` dedicadas — três páginas
  novas para o que dois filtros e uma página de funil cobrem.

## Riscos & mitigações

- **`proximo_contato` compartilhado**: se a interpretação por ciclo confundir, o vencido de
  cadência e o de carteira usam queries distintas (status/tem-pedido) — não a mesma. Mitigado
  por helpers separados (`vencidoCarteira` vs `estaAtrasado`).
- **Backfill em produção**: roda no 1º start pós-deploy; como é idempotente e filtra por
  `not exists`, não duplica nem re-semeia. Verificação no quickstart §Funil.
