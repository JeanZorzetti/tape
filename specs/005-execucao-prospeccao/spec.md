# Feature Specification: Execução da prospecção — scripts na ficha e ritmo do dia

**Feature Branch**: `005-execucao-prospeccao`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "Suporte operacional à prospecção no /admin — tirar o playbook de
estratégia do papel e colocá-lo na tela onde o representante trabalha. (1) Scripts na ficha do lead
contextualizados por nicho, acompanhando a cadência, com WhatsApp pré-montado; (2) Contador de toques
do dia vs. meta diária."

## Contexto

O playbook de prospecção já existe ([`docs/estrategia-prospeccao.md`](../../docs/estrategia-prospeccao.md),
visível em `/admin/estrategia`) e a máquina de CRM também: a pipeline **recuperação** tem lista ordenada
por canal+confiança, **cadência de 6 toques** (D+0, +1, +3, +7, +14, +21), régua de **tentativas**,
campo **nicho** e botão de **WhatsApp** com mensagem pré-montada (specs 003 e 004). Falta a **camada de
execução**: hoje o representante lê o script no documento e monta a mensagem à mão. Esta feature coloca o
script certo — do nicho e do toque atual daquele lead — dentro da própria ficha, e mostra o ritmo do dia
na lista. É **adição** sobre o CRM existente; não altera cadência, funil, carteira nem a ordenação da lista.

## Clarifications

### Session 2026-07-23

- Q: Onde vive a fonte de verdade dos scripts (o texto que a tela mostra e pré-preenche)? → A: Conteúdo
  **estruturado no app** é a fonte da tela; o playbook em `docs/` segue como documento narrativo, mantidos
  em paralelo, sem sincronização automática. (Conferência contra o doc fica como upgrade futuro, só se a
  divergência virar dor real.)
- Q: O que o contador de "toques do dia" conta? → A: As tentativas de **hoje da pipeline selecionada**,
  coerente com os demais contadores do `/admin`, que já são por pipeline.
- Q: Como tratar os ~100 leads que só têm Instagram (sem WhatsApp)? → A: Botão de WhatsApp quando há
  número; para lead **só com Instagram**, exibir o texto de DM copiável **e um link que abre o perfil do
  Instagram** (do `dados_import`) para mandar a DM à mão.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Script certo na ficha do lead, pronto para enviar (Priority: P1)

Ao abrir um lead da pipeline de recuperação, o representante vê o **script de abordagem do momento** —
escolhido pelo **nicho** do lead e pelo **ponto da cadência** em que o lead está — com o nome da empresa
(e do contato, quando houver) já preenchidos. Um clique no botão de WhatsApp abre a conversa **com essa
mensagem pronta**, sem copiar e colar do documento. À medida que ele registra cada tentativa, o script
exibido avança para o follow-up correspondente (D+1, D+3, D+7, D+14, D+21). As respostas a objeções ficam
visíveis como apoio.

**Why this priority**: É o coração da feature — remove o atrito entre "saber a estratégia" e "executá-la".
Cada toque fica mais rápido e mais consistente, e o representante para de alternar entre o CRM e o playbook.
Entrega valor sozinha, mesmo sem o contador de ritmo.

**Independent Test**: Abrir um lead de recuperação com nicho definido e sem tentativas; conferir que o
script do 1º toque aparece com a empresa preenchida e que o botão de WhatsApp abre com essa mensagem;
registrar uma tentativa e conferir que o script exibido passa a ser o follow-up seguinte.

**Acceptance Scenarios**:

1. **Given** um lead de recuperação com nicho "e-commerce" e nenhuma tentativa, **When** o representante
   abre a ficha, **Then** vê o script de **1º toque** de e-commerce com o nome da empresa preenchido e um
   botão de WhatsApp que abre a conversa com essa mensagem.
2. **Given** o mesmo lead após **1 tentativa** registrada, **When** o representante reabre a ficha,
   **Then** o script exibido é o **follow-up D+1**, não mais o 1º toque.
3. **Given** um lead com **6 ou mais tentativas** (cadência esgotada), **When** o representante abre a
   ficha, **Then** vê o **último toque (despedida)** e a sinalização de cadência esgotada que já existe.
4. **Given** um lead de recuperação **sem nicho**, **When** o representante abre a ficha, **Then** vê um
   script **genérico** utilizável e um convite para classificar o nicho (sem bloquear nada).
5. **Given** um lead **sem número de WhatsApp/telefone**, **When** o representante abre a ficha, **Then**
   o **texto do script** continua visível e copiável, mas o botão de WhatsApp não é oferecido.
5a. **Given** um lead **só com Instagram** (sem número, com handle no `dados_import`), **When** o
   representante abre a ficha, **Then** vê o texto de DM copiável **e um link que abre o perfil do
   Instagram** do lead.
6. **Given** a ficha de um lead de recuperação, **When** o representante procura como responder a "quanto
   custa?" ou "já tenho fornecedor", **Then** encontra as **respostas a objeções** disponíveis na própria tela.
7. **Given** um lead da pipeline **inbound**, **When** o representante abre a ficha, **Then** o bloco de
   scripts de prospecção **não** aparece (os scripts são de abordagem fria, específicos da recuperação).

---

### User Story 2 - Ritmo do dia: toques feitos vs. meta (Priority: P2)

Na lista do `/admin`, o representante vê **quantas tentativas de contato já registrou hoje** e a **meta
diária** (padrão ~20), para manter a disciplina da rotina — saber, num olhar, se já bateu o ritmo do dia
ou quanto falta.

**Why this priority**: Dá cadência à operação e transforma a meta abstrata do playbook num número visível
todo dia. Depende só do registro de tentativas que já existe; é uma leitura por cima. Vem depois dos
scripts porque o valor maior está em executar bem cada toque (US1); o ritmo é o hábito que sustenta.

**Independent Test**: Com nenhuma tentativa registrada hoje, abrir a lista e conferir que o contador
mostra 0 de [meta]; registrar duas tentativas e conferir que o contador passa a mostrar 2 de [meta];
no dia seguinte, conferir que voltou a 0.

**Acceptance Scenarios**:

1. **Given** nenhuma tentativa registrada hoje, **When** o representante abre a lista, **Then** vê o
   contador "0 / [meta]" do dia.
2. **Given** algumas tentativas registradas hoje, **When** o representante registra mais uma e volta à
   lista, **Then** o contador reflete o novo total do dia.
3. **Given** o representante atingiu ou superou a meta do dia, **When** ele olha o contador, **Then** o
   estado de "meta batida" é comunicado de forma clara (e não apenas por cor).
4. **Given** a virada do dia no fuso de operação (America/Sao_Paulo), **When** o representante abre a
   lista no dia seguinte, **Then** o contador recomeça do zero.

---

### Edge Cases

- **Lead com nicho "outro" ou não mapeado**: cai no script genérico, como o lead sem nicho.
- **Placeholder sem dado** (nome do contato ausente): o script degrada para uma saudação neutra usando a
  empresa, sem deixar `[nome]` cru na mensagem.
- **Tentativa registrada mas lead já respondeu/avançou de etapa**: o script segue o número de tentativas;
  quando o lead vira `interessado`/`recuperado`, o foco deixa de ser o script de abordagem fria (a régua de
  cadência de 1ª venda já sai de cena como hoje).
- **Meta diária não configurada**: usa o valor padrão; nunca mostra "0 / 0" nem divisão por zero.
- **Reabertura de lead descartado que volta a responder**: a contagem de tentativas continua de onde parou;
  o script exibido acompanha esse número.
- **Fuso**: "hoje" do contador e o "vencido" da cadência seguem o mesmo fuso (America/Sao_Paulo) já usado.

## Requirements *(mandatory)*

### Functional Requirements

**Scripts na ficha (US1)**

- **FR-001**: No detalhe de um lead da pipeline **recuperação**, o sistema MUST exibir um **script de
  abordagem** selecionado pelo **nicho** do lead e pelo **passo da cadência** correspondente ao número de
  tentativas já registradas.
- **FR-002**: O mapeamento de passo MUST ser: **0 tentativas → 1º toque (D+0)**; e cada tentativa seguinte
  avança para o próximo follow-up da cadência de 6 toques (D+1, +3, +7, +14, +21); a partir do 6º, exibe o
  **último toque (despedida)** e a sinalização de cadência esgotada já existente.
- **FR-003**: O script exibido MUST ter os **placeholders preenchidos** com os dados do lead (empresa e,
  quando houver, nome do contato), sem deixar marcadores crus quando um dado faltar.
- **FR-004**: O sistema MUST oferecer um **botão de WhatsApp** que abre a conversa com o número do lead e a
  **mensagem do script atual pré-preenchida**, reutilizando o mecanismo de link do WhatsApp já existente.
- **FR-005**: Quando o lead **não tem número** de WhatsApp/telefone, o sistema MUST ainda exibir o texto do
  script (copiável) e MUST omitir o botão de WhatsApp, sem erro.
- **FR-005a**: Quando o lead **não tem número mas tem Instagram** (handle no `dados_import`), o sistema MUST
  exibir o texto de DM copiável e **um link que abre o perfil do Instagram** do lead, para o representante
  mandar a DM manualmente. Sem número e sem Instagram → apenas o texto copiável.
- **FR-006**: O sistema MUST cobrir todos os nichos usados no CRM (indústria, distribuidor, e-commerce,
  lojas) e MUST prover um **script genérico** para lead sem nicho ou com nicho "outro"/não mapeado,
  convidando à classificação sem bloquear a tela.
- **FR-007**: O sistema MUST disponibilizar, na mesma tela, as **respostas a objeções** de referência
  (ex.: preço, fornecedor atual, custo do clichê).
- **FR-008**: O bloco de scripts MUST aparecer **apenas** para leads da pipeline recuperação e não para
  leads inbound.

**Ritmo do dia (US2)**

- **FR-009**: Na lista do `/admin`, o sistema MUST exibir a **contagem de tentativas registradas hoje na
  pipeline selecionada** e a **meta diária**, no fuso de operação (America/Sao_Paulo).
- **FR-010**: A **meta diária** MUST ser configurável, com um valor **padrão** definido; o sistema nunca
  MUST exibir estado inválido (ex.: divisão por zero) quando a meta não estiver configurada.
- **FR-011**: O contador MUST refletir novas tentativas assim que registradas e MUST **reiniciar** na virada
  do dia no fuso de operação.
- **FR-012**: O estado de **meta atingida** MUST ser comunicado sem depender apenas de cor.

**Transversais**

- **FR-013**: Todas as adições MUST viver sob `/admin`, exigir sessão autenticada e ficar fora de indexação,
  como o restante do painel.
- **FR-014**: A interação MUST ser **zero-JS no client** (envio de formulário + redirecionamento pós-gravação,
  o padrão PRG do `/admin`).
- **FR-015**: A feature MUST preservar o comportamento atual da ficha do lead e da lista (cadência, funil,
  carteira, ordenação, notas) — adiciona, não altera.

### Key Entities *(include if feature involves data)*

- **Script de abordagem**: **conteúdo estruturado no app** (chaveado por **nicho** e **passo da cadência** —
  1º toque + 5 follow-ups), mais um conjunto de **respostas a objeções** e um **script genérico** de
  fallback. É a fonte de verdade do texto exibido e da mensagem pré-montada do WhatsApp/DM. O playbook em
  `docs/` é o documento narrativo paralelo, não a fonte que a tela lê.
- **Meta diária de toques**: alvo numérico configurável de tentativas por dia, com valor padrão.
- **Tentativa** (existente, spec 003): cada toque registrado num lead — sua **contagem por lead** dirige qual
  script exibir, e sua **contagem por dia** dirige o contador de ritmo. Reusada, não redefinida.
- **Nicho** / **Lead** / **Cadência** (existentes, specs 003/004): reusados como chave de seleção e contexto.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O representante envia o toque atual de um lead **sem sair do CRM e sem copiar do documento** —
  do abrir a ficha ao WhatsApp aberto com a mensagem pronta em **até 2 cliques**.
- **SC-002**: O script exibido corresponde ao passo correto da cadência em **100% dos casos** (0 tentativas →
  1º toque; N tentativas → follow-up N), verificável na ficha.
- **SC-003**: **100% dos nichos** têm script definido, e um lead **sem nicho** nunca deixa a tela sem um
  script utilizável (fallback genérico).
- **SC-004**: Nenhuma mensagem enviada contém marcador de placeholder cru (`[nome]`, `[empresa]`) — a
  substituição degrada com elegância quando falta dado.
- **SC-005**: O contador do dia reflete o número real de tentativas registradas hoje e **zera** na virada do
  dia, sem intervenção manual.
- **SC-006**: Todo o comportamento atual do `/admin` (cadência, funil, carteira, ordenação, notas) continua
  funcionando após a feature (regressão zero).

## Assumptions

- **Recuperação-first**: os scripts são de **abordagem fria** e, portanto, específicos da pipeline de
  recuperação; a pipeline inbound (o lead já procurou a empresa) não recebe este bloco. Pode ser estendida
  depois se surgir demanda.
- **Fonte dos scripts** (travado): o conteúdo dos scripts é **conteúdo estruturado do aplicativo** (chaveado
  por nicho e passo), servindo a tela; o playbook em `docs/` continua o **documento narrativo** paralelo.
  Mudar um não muda o outro automaticamente; conferência contra o doc fica como upgrade futuro (só se a
  divergência virar dor real).
- **Contador escopado à pipeline selecionada** (travado), coerente com todos os outros contadores do
  `/admin` que já são por pipeline; a meta padrão (~20) reflete o ritmo outbound do playbook.
- **Leads só com Instagram**: recebem o texto de DM copiável + link para o perfil do Instagram (do
  `dados_import`); não há envio pré-montado por Instagram (a plataforma não suporta DM pré-preenchida por URL).
- **Meta configurável por valor único** (não há, nesta feature, tela de configuração por usuário nem por
  pipeline); multiusuário e papéis seguem fora de escopo, como no restante do CRM.
- **Fuso de operação**: America/Sao_Paulo, como o CRM atual.
- **Placeholders disponíveis**: empresa (sempre presente na recuperação) e nome do contato (opcional) — os
  únicos campos que os scripts do playbook usam.

## Dependencies

- CRM atual do `/admin`: ficha do lead, régua de **tentativas** e cadência (spec 003), pipeline de
  **recuperação** e campo **nicho** (specs 003/004), e o mecanismo de **link do WhatsApp** por número de lead.
- Os textos de abordagem definidos no playbook [`docs/estrategia-prospeccao.md`](../../docs/estrategia-prospeccao.md)
  (seção 4) como fonte editorial dos scripts.
