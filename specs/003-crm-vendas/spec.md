# Feature Specification: CRM de Vendas — cadência, follow-up, funil e categorias

**Feature Branch**: `003-crm-vendas`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "CRM de vendas em /admin com quatro frentes: (1) Fluxo de cadência — tentativas de fechar a primeira venda com o lead; (2) Follow-up pós-venda — contato após a primeira compra para cuidar da carteira/recorrência; (3) Funil de vendas — métricas de taxa de conversão por etapa (lead×fechado, em contato×fechado, orçado×fechado); (4) Categorias — leads por nicho."

## Contexto

O `/admin` já é um CRM enxuto: cada lead tem um **status** no pipeline
**Novo → Em contato → Orçado → Fechado / Perdido**, uma **data de próximo contato**
(com aviso de follow-up vencido) e um **histórico de anotações**. Esta feature
**estende** esse CRM — não o substitui — para dar disciplina de cadência à primeira
venda, cuidado recorrente da carteira depois da compra, visão de conversão por etapa
e classificação de leads por nicho. O ator é sempre o **representante comercial**
(usuário único do `/admin`), operando um funil B2B por orçamento (sem carrinho).

## Clarifications

### Session 2026-07-21

- Q: A cadência de tentativas é automática, manual ou híbrida? → A: Híbrida — o sistema sugere a próxima data pela cadência-padrão e o representante confirma/ajusta.
- Q: Como o pós-venda mede a recorrência da carteira? → A: Registrando pedidos completos (data + valor/volume).
- Q: O funil usa snapshot dos status atuais ou coorte histórica? → A: Coorte histórica, com registro de cada transição de etapa.
- Q: Qual evento marca um lead como cliente (1ª compra) e dispara o cuidado de carteira? → A: Registrar o 1º pedido — esse ato fecha o lead (status "Fechado") e inicia a cadência de carteira.
- Q: O que cada pedido/compra registra? → A: Data (obrigatória) + valor em R$ + volume (nº de rolos), estes dois opcionais.
- Q: Quais os intervalos padrão da cadência de 1ª venda e quantas tentativas até esgotar? → A: D+0, +1, +3, +7, +14, +21 — 6 toques; após o 6º, sinaliza esgotado.
- Q: Intervalo padrão de recontato da carteira após a última compra? → A: 30 dias.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fluxo de cadência até a primeira venda (Priority: P1)

O representante precisa de uma sequência disciplinada de tentativas de contato para
converter um lead novo na **primeira compra**, sem depender da memória. Ao trabalhar um
lead, ele registra cada tentativa (o que fez, por qual canal, o que aconteceu) e o
sistema sempre aponta **qual é o próximo passo e quando** — de forma que nenhum lead
ativo fique sem um próximo contato agendado, e leads que esgotaram as tentativas sejam
sinalizados para decisão (seguir ou marcar Perdido).

**Why this priority**: É a razão de o CRM existir — transformar lead em cliente. Sem
cadência estruturada, leads esfriam e a receita nunca começa. Entrega valor sozinha,
mesmo sem as outras três frentes.

**Independent Test**: Cadastrar um lead novo, registrar tentativas de contato em
sequência e verificar que (a) cada tentativa fica no histórico, (b) o próximo contato é
sempre proposto/atualizado, e (c) o lead aparece na lista de "vencidos" quando a data
passa. Fechá-lo remove-o da fila de cadência.

**Acceptance Scenarios**:

1. **Given** um lead com status "Novo" e sem próximo contato, **When** o representante
   inicia a cadência, **Then** o sistema agenda a primeira tentativa e passa o lead para
   "Em contato".
2. **Given** um lead em cadência com uma tentativa registrada, **When** o representante
   registra o resultado da tentativa (ex.: "sem resposta"), **Then** o sistema grava a
   tentativa no histórico e propõe a data da próxima tentativa segundo a cadência.
3. **Given** um lead cujo próximo contato é hoje ou antes e que ainda não foi fechado nem
   perdido, **When** o representante abre o `/admin`, **Then** o lead aparece destacado
   como follow-up vencido.
4. **Given** um lead que esgotou o número previsto de tentativas sem resposta, **When** o
   representante o revisa, **Then** o sistema sinaliza que a cadência terminou e sugere
   marcar "Perdido" (sem marcar automaticamente).
5. **Given** um lead em cadência, **When** ele é marcado "Fechado", **Then** ele sai da
   fila de tentativas de primeira venda.

---

### User Story 2 - Follow-up pós-venda para cuidar da carteira (Priority: P2)

Depois que o lead vira **cliente** (primeira compra), o representante precisa mantê-lo
aquecido para gerar **recompra/recorrência** — o maior valor no B2B de fitas. O sistema
deve manter uma agenda de recontato recorrente para clientes que já compraram, separada
da cadência de primeira venda, para que nenhum cliente da carteira fique esquecido por
tempo demais.

**Why this priority**: Recorrência é onde a margem B2B se acumula. Depende de existir
clientes fechados, por isso vem depois da cadência de primeira venda, mas é uma frente
independente com valor próprio.

**Independent Test**: Marcar um lead como cliente/compra registrada, avançar o tempo além
do intervalo de recorrência e verificar que ele aparece na fila de "carteira a recontatar";
registrar um recontato/nova compra e verificar que a próxima data de recontato é
reagendada.

**Acceptance Scenarios**:

1. **Given** um lead recém "Fechado" (primeira compra), **When** a venda é registrada,
   **Then** o sistema agenda o próximo recontato de carteira segundo o intervalo de
   recorrência.
2. **Given** um cliente cujo recontato de carteira está vencido, **When** o representante
   abre a visão de carteira, **Then** o cliente aparece na fila de recontato com há quanto
   tempo está sem contato/compra.
3. **Given** um cliente que respondeu ou fez nova compra, **When** o representante registra
   o recontato/pedido, **Then** o próximo recontato é reagendado a partir dessa data.
4. **Given** a lista de leads, **When** o representante filtra por "clientes" (já
   compraram), **Then** vê apenas a carteira, distinta dos leads em primeira venda.

---

### User Story 3 - Funil de vendas com taxas de conversão por etapa (Priority: P3)

O representante precisa enxergar **onde o funil vaza**: quantos leads viram clientes e a
taxa de conversão de cada etapa — **lead×fechado**, **em contato×fechado** e
**orçado×fechado** — para saber onde focar (prospecção, atendimento ou fechamento).

**Why this priority**: Dá visibilidade de gestão sobre a operação e orienta esforço. É
majoritariamente uma camada de leitura sobre dados que a cadência já produz.

**Independent Test**: Com um conjunto de leads em diferentes status, abrir o painel de
funil e conferir que cada etapa mostra sua contagem e a taxa de conversão até "Fechado",
e que os números batem com os leads existentes no período selecionado.

**Acceptance Scenarios**:

1. **Given** leads distribuídos pelos status, **When** o representante abre o painel de
   funil, **Then** vê a contagem por etapa e as três taxas: lead→fechado,
   em contato→fechado e orçado→fechado.
2. **Given** o painel de funil, **When** o representante seleciona um período (ex.: este
   mês), **Then** as contagens e taxas refletem apenas os leads desse período.
3. **Given** uma etapa com taxa de conversão baixa, **When** o representante lê o painel,
   **Then** consegue identificar em qual etapa está a maior perda.

---

### User Story 4 - Categorização de leads por nicho (Priority: P4)

O representante precisa **classificar cada lead por nicho** (indústria, distribuidor,
e-commerce, lojas — os segmentos que o site já trabalha) para segmentar a carteira,
filtrar a lista e entender o funil por nicho.

**Why this priority**: Segmentação simples que enriquece a lista e o funil; baixo esforço,
habilita corte por nicho nas outras frentes.

**Independent Test**: Atribuir um nicho a um lead, filtrar a lista por esse nicho e ver
apenas os leads correspondentes; ver a distribuição de leads por nicho.

**Acceptance Scenarios**:

1. **Given** um lead sem nicho, **When** o representante atribui um nicho, **Then** o nicho
   fica salvo e visível na ficha e na lista.
2. **Given** a lista de leads, **When** o representante filtra por um nicho, **Then** vê
   apenas os leads daquele nicho.
3. **Given** a visão de categorias, **When** o representante a abre, **Then** vê quantos
   leads há por nicho.

---

### Edge Cases

- **Lead sem telefone/e-mail válido**: a cadência ainda agenda o passo, mas o canal
  indisponível deve ser sinalizado ao registrar a tentativa.
- **Reabertura de lead perdido**: se um "Perdido" volta a responder, o representante pode
  reativá-lo e a cadência recomeça.
- **Cliente que pede para não ser contatado**: precisa haver como pausar/encerrar a
  cadência de carteira sem apagar o histórico.
- **Divisão por zero no funil**: etapa sem nenhum lead no período mostra "—", não erro.
- **Período sem dados**: o painel de funil mostra estado vazio claro, não números
  enganosos.
- **Lead antigo (anterior a esta feature) sem nicho**: aparece como "sem nicho" e pode ser
  classificado; não bloqueia nenhuma tela.
- **Fuso horário**: "vencido" e "hoje" seguem o fuso de operação (America/Sao_Paulo), como
  o CRM atual já faz.

## Requirements *(mandatory)*

### Functional Requirements

**Cadência de primeira venda (US1)**

- **FR-001**: O sistema MUST permitir registrar **tentativas de contato** por lead, cada
  uma com data, canal (ex.: WhatsApp, telefone, e-mail) e resultado (ex.: sem resposta,
  respondeu, remarcar), preservadas no histórico do lead.
- **FR-002**: O sistema MUST manter, para todo lead ativo (não Fechado nem Perdido), um
  **próximo contato agendado**, atualizado a cada tentativa registrada.
- **FR-003**: O sistema MUST **sugerir** a data da próxima tentativa segundo a **cadência
  padrão de 6 toques** — **D+0, D+1, D+3, D+7, D+14, D+21** (dias corridos a partir da
  entrada em cadência) — e permitir que o representante **confirme ou ajuste** essa data
  (modelo híbrido — a data sugerida é sempre editável).
- **FR-004**: O sistema MUST sinalizar leads com próximo contato **vencido** (hoje ou
  antes) e ainda ativos, como o CRM atual já faz.
- **FR-005**: O sistema MUST sinalizar quando um lead **esgotou** a cadência (após o **6º
  toque** sem resposta) e sugerir marcar "Perdido", sem alterar o status automaticamente.
- **FR-006**: O representante MUST conseguir marcar o lead como "Fechado". O caminho
  primário de fechamento é **registrar o 1º pedido** (FR-008), que fecha o lead
  automaticamente; em ambos os casos o lead sai da fila de cadência de primeira venda.

**Follow-up pós-venda / carteira (US2)**

- **FR-007**: O sistema MUST distinguir **clientes** dos leads em primeira venda; um lead é
  **cliente** quando tem **pelo menos um pedido registrado**. Registrar o **1º pedido**
  fecha o lead (status "Fechado") e inicia a cadência de carteira.
- **FR-008**: O sistema MUST registrar cada **pedido/compra** de um cliente com **data
  (obrigatória)**, **valor em R$ (opcional)** e **volume em nº de rolos (opcional)**,
  formando o histórico de compras que mede a recorrência; e agendar o **recontato de
  carteira** a partir da **última compra**, com intervalo **padrão de 30 dias**
  (configurável). Valores de pedido vivem só no `/admin`, nunca expostos no site público.
- **FR-009**: O sistema MUST listar os clientes com recontato de carteira **vencido**,
  mostrando há quanto tempo estão sem contato/compra.
- **FR-010**: O sistema MUST reagendar o próximo recontato quando o representante registra
  um recontato ou nova compra.
- **FR-011**: O representante MUST conseguir **pausar/encerrar** a cadência de carteira de
  um cliente sem apagar seu histórico.
- **FR-012**: O sistema MUST permitir filtrar a lista para ver **apenas a carteira** (quem
  já comprou), separada dos leads em primeira venda.

**Funil de vendas (US3)**

- **FR-013**: O sistema MUST exibir a **contagem de leads por etapa** do pipeline (Novo, Em
  contato, Orçado, Fechado, Perdido).
- **FR-014**: O sistema MUST **registrar cada mudança de etapa** de um lead (transição de
  status, com data) e calcular as **taxas de conversão por coorte histórica**:
  lead→fechado, em contato→fechado e orçado→fechado — contando quais leads efetivamente
  passaram por cada etapa, não apenas o status atual.
- **FR-014a**: O sistema MUST registrar retroativamente uma transição inicial para os leads
  já existentes (a partir do status atual) para que o funil histórico não comece vazio.
- **FR-015**: O sistema MUST permitir filtrar o funil por **período** (ex.: este mês, este
  ano, tudo).
- **FR-016**: O sistema MUST tratar etapa sem leads no período mostrando "—" em vez de erro
  ou taxa enganosa.

**Categorias por nicho (US4)**

- **FR-017**: O sistema MUST permitir atribuir a cada lead um **nicho** de uma lista
  definida (os segmentos que o site já usa: indústria, distribuidor, e-commerce, lojas),
  mais uma opção "outro" e o estado "sem nicho".
- **FR-018**: O representante MUST conseguir **filtrar a lista** de leads por nicho.
- **FR-019**: O sistema MUST exibir a **distribuição de leads por nicho** (quantos em cada).
- **FR-020**: O sistema MUST permitir cruzar **funil por nicho** (a taxa de conversão de
  cada nicho), reusando o cálculo do funil.

**Transversais**

- **FR-021**: Todas as telas novas MUST viver sob `/admin`, exigir sessão autenticada e
  ficar fora de indexação, como o restante do painel.
- **FR-022**: O sistema MUST preservar os dados e o comportamento atuais do `/admin` (lista,
  busca, status, próximo contato, notas) — a feature adiciona, não remove.
- **FR-023**: Leads pré-existentes MUST continuar funcionando sem nicho e sem cadência
  formal até serem classificados/trabalhados; nada pode quebrar por falta desses dados.

### Key Entities *(include if feature involves data)*

- **Lead**: contato comercial existente (nome, empresa, contato, status no pipeline,
  próximo contato). Ganha um **nicho**; é **cliente** quando tem ≥1 pedido registrado.
- **Tentativa de contato**: registro de um toque de cadência num lead — data, canal,
  resultado. É o histórico que dirige o próximo passo.
- **Cadência**: primeira venda = **6 toques** (D+0, +1, +3, +7, +14, +21); carteira =
  recontato recorrente a cada **30 dias** (padrão) a partir da última compra.
- **Compra/Pedido**: registro de uma venda ao cliente — **data** (obrigatória), **valor em
  R$** e **volume em rolos** (opcionais) — base da recorrência e do histórico da carteira.
- **Transição de etapa**: registro histórico de cada mudança de status de um lead (de qual
  etapa, para qual, quando) — base das taxas de conversão por coorte.
- **Nicho**: classificação do lead por segmento de mercado (indústria, distribuidor,
  e-commerce, lojas, outro).
- **Métrica de funil**: valor derivado (contagens e taxas por etapa) das transições de
  etapa — apresentação sobre o histórico registrado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **100% dos leads ativos** têm um próximo contato agendado — zero leads ativos
  sem próximo passo definido.
- **SC-002**: O representante registra uma tentativa de contato e vê o próximo passo
  atualizado em **menos de 30 segundos**, sem sair da ficha do lead.
- **SC-003**: **Nenhum cliente da carteira** fica sem recontato além do intervalo de
  recorrência definido sem aparecer na fila de vencidos.
- **SC-004**: O representante vê as três taxas de conversão do funil em **até 5 segundos**
  ao abrir o painel, sem cálculo manual.
- **SC-005**: **100% dos leads novos** podem ser classificados por nicho, e a lista pode ser
  filtrada por nicho retornando exatamente os leads daquele nicho.
- **SC-006**: O representante consegue, a partir do funil, apontar **qual etapa concentra a
  maior perda** — a informação está visível, não precisa ser derivada à mão.
- **SC-007**: Todo o comportamento atual do `/admin` continua funcionando após a feature
  (regressão zero nas telas existentes).

## Assumptions

- **Prioridade é uma proposta de trabalho**: a ordem P1–P4 (cadência → carteira → funil →
  nicho) reflete valor de negócio + independência; pode ser reordenada no `/speckit-clarify`.
- **Ator único**: um representante comercial autenticado opera o `/admin`; não há
  multiusuário, papéis ou permissões nesta feature.
- **Nicho reusa os segmentos do site** (indústria, distribuidor, e-commerce, lojas) para
  não inventar taxonomia nova; "outro" cobre o resto.
- **Sem preço no site público não muda**: valores de compra, se registrados (FR-008), vivem
  só no `/admin`, nunca são expostos publicamente.
- **Canais de contato**: WhatsApp é o principal (já integrado no CRM), com telefone e e-mail
  como alternativas registráveis.
- **Fuso de operação**: America/Sao_Paulo, como o CRM atual.
- **Volume**: operação de um representante — dezenas a poucas centenas de leads; nada exige
  escala de milhares simultâneos.
- **Reaproveita a base existente**: leads, status, próximo contato e notas do CRM atual são
  a fundação; a feature adiciona tentativas, carteira, funil e nicho por cima.

## Dependencies

- CRM atual do `/admin` (leads, status do pipeline, próximo contato, notas, autenticação de
  sessão) — é a base sobre a qual esta feature é construída.
- Lista de segmentos do site (indústria, distribuidor, e-commerce, lojas) como fonte da
  taxonomia de nicho.
