# Feature Specification: Multi-pipeline — pipeline de recuperação outbound

**Feature Branch**: `004-pipeline-recuperacao`

**Created**: 2026-07-22

**Status**: Draft

**Input**: Handoff [`docs/handoffs/handoff-multi-pipeline.md`](../../docs/handoffs/handoff-multi-pipeline.md). Decisões travadas com o usuário: (1) etapas próprias da recuperação (`a_contatar → contatado → interessado → recuperado → descartado`), tornando as etapas de funil dependentes da pipeline; (2) importação é apenas um script re-executável, **não** rodado contra o banco nesta feature; (3) o detalhe do lead ganha uma seção editável com todos os campos da planilha (sem overlay/JS); (4) modelo por discriminador de pipeline no cadastro de leads existente (sem tabela nova); (5) todos os campos da prospecção editáveis, exceto imagem-fonte e confiança (somente leitura).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trabalhar a lista de recuperação como funil separado (Priority: P1)

O operador abre o `/admin`, alterna do funil **Inbound** para o funil **Recuperação** por um seletor no header e passa a ver **apenas** os leads de prospecção — em lista própria, com contadores por etapa, follow-up vencido, funil e carteira, tudo escopado a essa pipeline. As etapas dessa pipeline são próprias (`a_contatar → contatado → interessado → recuperado → descartado`) e a cadência de toques opera igual à do inbound. Nada da recuperação aparece no funil inbound, e vice-versa.

**Why this priority**: É o valor central da feature. Sem a separação lógica das duas pipelines, a lista outbound polui o funil inbound e a operação de recuperação não existe. Entrega valor mesmo que os dados sejam inseridos manualmente, antes de qualquer importação.

**Independent Test**: Com pelo menos um lead marcado como pipeline "recuperação" e um lead inbound no banco, alternar o seletor e confirmar que cada visão (lista, contadores por etapa, funil, carteira, fila de recontato) mostra somente os leads da pipeline selecionada, e que as transições respeitam as etapas próprias da recuperação.

**Acceptance Scenarios**:

1. **Given** existe 1 lead inbound e 1 lead de recuperação, **When** o operador seleciona "Recuperação" no header, **Then** a lista, os contadores por etapa e o funil exibem apenas o lead de recuperação.
2. **Given** o operador está na pipeline "Recuperação", **When** ele avança um lead para a próxima etapa, **Then** as opções de etapa oferecidas são `a_contatar → contatado → interessado → recuperado → descartado` (não as etapas do inbound).
3. **Given** um lead de recuperação foi movido para `recuperado`, **When** o operador abre a carteira da pipeline "Recuperação", **Then** esse lead aparece na carteira e entra na fila de recontato conforme a cadência já existente.
4. **Given** nenhum parâmetro de pipeline informado, **When** qualquer tela de `/admin` é aberta, **Then** o comportamento padrão é o funil **Inbound** (idêntico ao de hoje).

---

### User Story 2 - Ver e enriquecer todos os dados da planilha no detalhe do lead (Priority: P2)

Ao abrir o detalhe de um lead de recuperação, o operador vê uma seção **"Dados da prospecção"** que renderiza **todas as colunas da planilha como campos já preenchidos** com o dado importado. O operador pode editar esses campos para enriquecer o cadastro (ex.: preencher um WhatsApp que faltava) e salvar. Imagem-fonte e confiança da leitura são exibidas como somente leitura (proveniência). Ao salvar, os campos operacionais mapeados (empresa, telefone, e-mail, CNPJ) ficam em sincronia com a edição, para que busca, botão de WhatsApp e demais telas usem o dado atualizado.

**Why this priority**: Transforma a lista bruta em base de trabalho: sem enriquecimento, ~57% dos registros não têm canal de contato. Depende da existência da pipeline (US1), por isso P2.

**Independent Test**: Abrir um lead de recuperação com dados importados, confirmar que cada coluna da planilha aparece como campo pré-preenchido, editar um campo (ex.: WhatsApp), salvar, reabrir e confirmar que o valor persistiu e que os campos operacionais mapeados refletem a edição.

**Acceptance Scenarios**:

1. **Given** um lead de recuperação com dados importados, **When** o operador abre o detalhe, **Then** vê um campo por coluna da planilha, com rótulo humano e valor pré-preenchido.
2. **Given** a seção "Dados da prospecção", **When** o operador edita o WhatsApp e salva, **Then** o valor persiste e o campo de telefone/contato usado pelo botão de WhatsApp e pela busca reflete a atualização.
3. **Given** a seção "Dados da prospecção", **When** o operador tenta editar a imagem-fonte ou a confiança, **Then** esses campos são somente leitura e não podem ser alterados.
4. **Given** um lead **inbound**, **When** o operador abre o detalhe, **Then** a seção "Dados da prospecção" **não** aparece (é exclusiva da recuperação).

---

### User Story 3 - Importar a lista bruta de forma idempotente (Priority: P3)

O operador dispõe de um script re-executável que lê a planilha bruta de prospecção e insere os registros no CRM como leads da pipeline "recuperação", cada um preservando a linha crua completa da planilha e começando na etapa inicial. O script respeita aspas e caracteres especiais do CSV, ignora linhas sem nome de empresa, e é idempotente: rodar de novo não duplica registros. Ao final, reporta quantos foram inseridos, pulados (já existentes) e ignorados (sem empresa). **Nesta feature o script apenas fica pronto e testado; não é executado contra o banco de produção.**

**Why this priority**: É a alimentação em massa da pipeline. A separação (US1) e o enriquecimento (US2) já entregam valor com dados inseridos manualmente; a importação escala isso. Rodar contra produção é decisão operacional posterior.

**Independent Test**: Rodar o script contra um banco de teste com uma planilha de amostra que contenha linhas com vírgulas dentro de aspas, uma linha sem empresa e uma empresa repetida; confirmar contagem correta de inseridos/pulados/ignorados; rodar de novo e confirmar zero novas inserções.

**Acceptance Scenarios**:

1. **Given** a planilha bruta, **When** o script roda pela primeira vez, **Then** cada linha com empresa vira um lead de recuperação na etapa inicial, preservando todas as colunas da planilha.
2. **Given** uma linha com vírgulas dentro de aspas (ex.: `"CORTINAS, PERSIANAS, TOLDOS"`), **When** o script processa essa linha, **Then** o valor é lido como um único campo, sem quebrar as colunas.
3. **Given** o script já rodou uma vez, **When** ele roda de novo com a mesma planilha, **Then** nenhum registro é duplicado e o relatório indica os registros como pulados.
4. **Given** uma linha sem nome de empresa, **When** o script a processa, **Then** ela é ignorada e contabilizada no relatório como ignorada.

---

### Edge Cases

- **Empresa duplicada na planilha (29 casos)**: registros com mesma empresa mas imagem-fonte diferente são tratados como distintos (chave de idempotência combina imagem-fonte + empresa). Duplicatas verdadeiras são revisadas depois na tela, sem bloquear a importação.
- **Lead de recuperação sem nenhum canal (~57%)**: é importado para registro, mas a lista o ordena abaixo dos que têm canal e alta confiança.
- **Campo da planilha vazio**: aparece como campo editável em branco no detalhe, pronto para enriquecimento.
- **Coluna da planilha sem rótulo humano mapeado**: exibida com o nome da coluna em Title-case.
- **Lead inbound existente após a mudança de esquema**: continua na pipeline inbound sem qualquer migração de dados, e o funil inbound permanece idêntico ao atual.
- **Chave de contato ausente ao salvar enriquecimento**: salvar campos vazios não deve apagar dados operacionais válidos de forma silenciosa — a ressincronização só sobrescreve com o valor efetivamente editado.

## Requirements *(mandatory)*

### Functional Requirements

**Separação de pipelines (US1)**

- **FR-001**: O sistema MUST associar cada lead a exatamente uma pipeline entre "inbound" e "recuperação", com "inbound" como padrão para todo lead sem pipeline explícita (incluindo os já existentes).
- **FR-002**: O `/admin` MUST oferecer um seletor de pipeline no header que alterna todas as visões entre "Inbound" e "Recuperação", com "Inbound" como padrão quando nenhuma pipeline é informada.
- **FR-003**: Lista de leads, contadores por etapa, contagem de follow-up vencido, funil por coorte, carteira e fila de recontato MUST exibir somente os leads da pipeline selecionada.
- **FR-004**: A pipeline "recuperação" MUST usar as etapas próprias `a_contatar → contatado → interessado → recuperado → descartado`; a pipeline "inbound" MUST manter suas etapas atuais. As etapas oferecidas nas transições MUST corresponder à pipeline do lead.
- **FR-005**: A cadência de toques, as notas e as transições de etapa MUST funcionar para a recuperação com a mesma mecânica já usada no inbound, apenas escopadas por pipeline.
- **FR-006**: A lista de recuperação MUST priorizar leads que têm canal de contato e maior confiança de leitura antes dos demais, exibindo ramo e cidade/UF na linha.
- **FR-007**: Um lead que atinge a etapa de fechamento da recuperação (`recuperado`) MUST entrar na carteira e na cadência de recontato da pipeline "recuperação".

**Dados da prospecção no detalhe (US2)**

- **FR-008**: No detalhe de um lead de recuperação, o sistema MUST renderizar uma seção "Dados da prospecção" com um campo por coluna da planilha, pré-preenchido com o dado importado.
- **FR-009**: Todos os campos da prospecção MUST ser editáveis, exceto imagem-fonte e confiança da leitura, que MUST ser somente leitura.
- **FR-010**: Cada campo MUST ter um rótulo humano; colunas sem rótulo mapeado MUST ser exibidas com o nome da coluna em Title-case.
- **FR-011**: Ao salvar a seção "Dados da prospecção", o sistema MUST persistir os valores editados e ressincronizar os campos operacionais mapeados (empresa, telefone/contato, e-mail, CNPJ) para que busca, botão de WhatsApp e demais telas usem o dado atualizado.
- **FR-012**: A seção "Dados da prospecção" MUST aparecer apenas para leads da pipeline "recuperação" e não para leads inbound.
- **FR-013**: A operação de salvar MUST usar o mesmo padrão sem-JS (envio de formulário + redirecionamento pós-gravação) das demais ações do `/admin`.

**Importação (US3)**

- **FR-014**: O sistema MUST fornecer um script re-executável que importa a planilha bruta de prospecção como leads da pipeline "recuperação", cada um preservando a linha crua completa da planilha e iniciando na etapa inicial da recuperação.
- **FR-015**: O script MUST interpretar corretamente CSV com aspas e vírgulas dentro de campos, e descartar marcador de ordem de bytes (BOM) no início do arquivo.
- **FR-016**: O script MUST ignorar linhas sem nome de empresa e contabilizá-las separadamente.
- **FR-017**: O script MUST ser idempotente: reexecutar com a mesma planilha não cria registros duplicados, usando uma chave de idempotência que combina imagem-fonte e empresa.
- **FR-018**: O script MUST semear a transição inicial de etapa de cada lead importado, para que ele seja contabilizado no funil da recuperação.
- **FR-019**: O script MUST reportar, ao final, as quantidades de registros inseridos, pulados (já existentes) e ignorados (sem empresa).
- **FR-020**: Nesta feature o script NÃO deve ser executado contra o banco de produção; entrega-se apenas pronto e testado.

**Esquema e integridade**

- **FR-021**: A mudança de esquema MUST ser idempotente e não exigir migração de dados dos leads existentes, que assumem a pipeline "inbound" automaticamente.
- **FR-022**: A validação do formulário público de orçamento (inbound) MUST continuar garantindo os campos obrigatórios do inbound, mesmo que o esquema afrouxe essas obrigatoriedades para acomodar leads de recuperação sem esses campos.

**Segurança / privacidade**

- **FR-023**: A lista de recuperação e todos os dados de prospecção MUST ficar acessíveis apenas sob `/admin` (sessão autenticada, `noindex`), nunca em rota pública nem em sitemap.
- **FR-024**: A planilha bruta de prospecção NÃO deve ser servida publicamente nem incluída no build público.

### Key Entities *(include if feature involves data)*

- **Lead**: registro de contato comercial já existente no CRM. Ganha uma **pipeline** (inbound | recuperação), a **linha crua da planilha** (todas as colunas da prospecção) e uma **chave de idempotência de importação** (imagem-fonte + empresa). Campos hoje obrigatórios do inbound tornam-se opcionais no armazenamento para acomodar leads de recuperação.
- **Pipeline**: discriminador lógico que separa dois funis sobre o mesmo cadastro de leads. Determina o conjunto de etapas válidas e escopa todas as visões (lista, funil, carteira, cadência).
- **Etapa de recuperação**: sequência própria `a_contatar → contatado → interessado → recuperado → descartado`, onde `recuperado` é o fechamento (entra em carteira) e `descartado` é a perda.
- **Registro da planilha de prospecção**: 12 colunas (imagem-fonte, empresa, ramo, telefone, whatsapp, cidade/UF, e-mail, instagram, endereço, cnpj, confiança, observação) preservadas por lead e renderizadas como campos no detalhe.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um lead de recuperação nunca aparece em nenhuma visão do funil inbound, e um lead inbound nunca aparece em nenhuma visão da recuperação (0% de vazamento cruzado em todas as telas).
- **SC-002**: O funil inbound existente permanece idêntico ao atual quando nenhuma pipeline é selecionada (nenhuma mudança observável para quem usa o inbound).
- **SC-003**: O operador consegue alternar entre as duas pipelines e trabalhar um lead de recuperação (ver, avançar etapa, cadenciar, enriquecer) sem sair do `/admin`.
- **SC-004**: 100% das colunas da planilha aparecem como campos no detalhe do lead de recuperação; edições persistem e ficam refletidas nos campos operacionais mapeados na reabertura.
- **SC-005**: Reexecutar o script de importação sobre a mesma planilha resulta em 0 registros duplicados, e o relatório final bate com a composição da planilha (linhas com empresa inseridas + linhas sem empresa ignoradas).
- **SC-006**: Nenhum dado de prospecção fica acessível fora de `/admin` (nenhuma rota pública, sitemap ou build público expõe a lista ou a planilha bruta).

## Assumptions

- O CRM atual é agnóstico de pipeline: cadência, carteira, funil, notas e transições operam sobre etapa e agendamento de contato, não sobre a origem do lead — por isso reusa-se a máquina existente com um discriminador, sem CRM ou tabela nova.
- As etapas de funil deixam de ser globais e passam a ser definidas por pipeline (decisão do usuário); o inbound mantém as etapas atuais.
- A linha crua da planilha é armazenada por lead e é a fonte que o detalhe percorre para renderizar os campos; apenas os campos operacionais (empresa, telefone/contato, e-mail, CNPJ) são espelhados em campos dedicados para busca e ações.
- A confiança da leitura é derivável da linha crua armazenada (não precisa de campo dedicado) e é usada apenas para ordenar a lista.
- A importação é um script de linha de comando (sem tela de upload, sem JS no cliente), coerente com o padrão dos demais scripts do projeto.
- A planilha bruta permanece fora do diretório público do projeto.
- Segmentar/filtrar a recuperação por ramo ou cidade/UF fica fora de escopo até haver demanda real (a informação está preservada na linha crua e pode ser promovida a campo dedicado depois).
