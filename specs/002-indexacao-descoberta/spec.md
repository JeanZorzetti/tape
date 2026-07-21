# Feature Specification: Indexação rápida e descoberta por buscadores e motores de IA

**Feature Branch**: `002-indexacao-descoberta`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "1. Index now 2. Bing webmaster 3. Tem mais ideia?" — expandido para: IndexNow com ping automático, verificação no Bing Webmaster Tools, llms.txt + regras de crawler de IA no robots.txt, e feed RSS do blog. Google Search Console fora de escopo (já verificado, sem ação adicional aplicável).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conteúdo novo aparece nos buscadores em horas, não semanas (Priority: P1)

O responsável pelo site publica um post no blog ou uma página nova. Hoje ele espera passivamente o rastreamento acontecer. Com esta feature, o próprio deploy avisa os buscadores que aquelas URLs mudaram, e o conteúdo entra no índice do Bing/Yandex/Seznam/Naver em horas.

**Why this priority**: É o pedido original e o único item que muda a velocidade de indexação. Todo o resto amplia alcance; este acelera o que já existe. Sozinho já entrega valor mensurável.

**Independent Test**: Publicar uma alteração de conteúdo, disparar o deploy e confirmar no painel do Bing que as URLs foram recebidas via IndexNow e que a nova página aparece no índice em menos de 48h.

**Acceptance Scenarios**:

1. **Given** o site publicado com o arquivo de chave acessível na raiz, **When** um deploy conclui com sucesso, **Then** as URLs públicas do site são submetidas aos buscadores compatíveis e o resultado (aceito/recusado) fica registrado no log do deploy.
2. **Given** o serviço de submissão está fora do ar ou responde erro, **When** o deploy roda, **Then** o deploy conclui com sucesso mesmo assim, registrando o aviso no log — a submissão nunca bloqueia a publicação.
3. **Given** uma URL do painel administrativo, **When** a submissão é montada, **Then** essa URL não é enviada — só entram páginas públicas indexáveis.

---

### User Story 2 - Domínio verificado e sitemap monitorado no Bing (Priority: P2)

O responsável precisa enxergar se o Bing está de fato lendo o site: quais URLs foram indexadas, quais deram erro, quais consultas trazem tráfego. Sem a propriedade verificada, o IndexNow funciona às cegas.

**Why this priority**: É o painel de leitura do resultado da US1 — sem ele não há como confirmar nem diagnosticar. Depende de passos manuais no painel do Bing, então vem logo depois.

**Independent Test**: Acessar o Bing Webmaster Tools e confirmar que a propriedade aparece como verificada e o sitemap consta como processado, com contagem de URLs descobertas.

**Acceptance Scenarios**:

1. **Given** o marcador de verificação publicado no site, **When** o Bing tenta validar a propriedade, **Then** a verificação é aceita e a propriedade fica ativa.
2. **Given** a propriedade verificada, **When** o sitemap é submetido, **Then** o painel mostra o sitemap como processado com o número de URLs encontradas.
3. **Given** um novo responsável assume o site, **When** ele consulta a documentação do repositório, **Then** encontra os passos manuais do painel registrados e consegue refazer a verificação sem adivinhar.

---

### User Story 3 - O site é legível e citável por motores de IA (Priority: P2)

Compradores de fita personalizada perguntam a assistentes de IA ("qual a diferença entre fita gomada e BOPP?", "onde mandar fazer fita com minha marca?"). Para a TapePro ser citada, os crawlers de IA precisam ter permissão explícita e um índice de conteúdo legível apontando o que vale ler.

**Why this priority**: É o diferencial estratégico do projeto — nenhum concorrente do nicho tem conteúdo. Mas o retorno é mais lento e menos verificável que a indexação clássica, então fica depois dela.

**Independent Test**: Requisitar o índice de conteúdo e o arquivo de regras de crawler direto pela URL pública e confirmar que ambos respondem com o conteúdo esperado e listam as páginas certas.

**Acceptance Scenarios**:

1. **Given** o site publicado, **When** um crawler de IA consulta as regras de rastreamento, **Then** encontra permissão explícita para os agentes de IA relevantes e bloqueio da área administrativa.
2. **Given** o índice de conteúdo publicado, **When** ele é lido, **Then** descreve o que a TapePro faz e lista as páginas de produto, segmento e blog com links absolutos válidos.
3. **Given** uma página nova de produto ou segmento entra no site, **When** o índice de conteúdo é gerado, **Then** ela aparece na listagem sem edição manual.

---

### User Story 4 - Blog acompanhável por feed (Priority: P3)

Leitores, agregadores e ferramentas de monitoramento conseguem acompanhar novos posts do blog sem visitar o site.

**Why this priority**: Baixo esforço e amplia distribuição, mas é o item de menor impacto direto em indexação. Último da fila.

**Independent Test**: Abrir a URL do feed em um leitor de RSS e confirmar que os posts publicados aparecem com título, resumo, link e data.

**Acceptance Scenarios**:

1. **Given** posts publicados no blog, **When** o feed é requisitado, **Then** retorna os posts em ordem cronológica decrescente com título, descrição, link absoluto e data de publicação.
2. **Given** um post marcado como rascunho, **When** o feed é gerado, **Then** esse post não aparece.
3. **Given** um visitante em qualquer página do site, **When** um leitor de RSS inspeciona a página, **Then** encontra a referência ao feed no cabeçalho do documento.

---

### Edge Cases

- **Deploy sem mudança de conteúdo**: reenviar o mesmo conjunto de URLs a cada deploy é aceito pelo protocolo, mas submissões repetidas sem alteração real degradam a reputação da chave. O conjunto submetido deve refletir páginas que mudaram sempre que essa informação estiver disponível.
- **Chave de submissão inacessível**: se o arquivo de chave não responder na raiz do domínio, os buscadores recusam a submissão. O resultado da recusa precisa ficar visível no log, não silencioso.
- **Ambiente de preview ou local**: submissões disparadas fora do domínio de produção enviariam URLs inválidas. A submissão só ocorre para o domínio público de produção.
- **Blog vazio**: o feed precisa responder com um documento válido e vazio, não com erro.
- **Página despublicada**: uma URL removida do site continua listada no índice de conteúdo até a próxima geração — a geração é derivada do conteúdo real, nunca de uma lista mantida à mão.
- **Regra de crawler conflitante**: liberar agentes de IA não pode abrir a área administrativa nem endpoints de formulário.

## Requirements *(mandatory)*

### Functional Requirements

#### Submissão de URLs (IndexNow)

- **FR-001**: O sistema DEVE publicar um arquivo de chave de submissão acessível publicamente na raiz do domínio.
- **FR-002**: O sistema DEVE submeter as URLs públicas do site aos buscadores compatíveis com o protocolo a cada deploy de produção concluído.
- **FR-003**: O conjunto submetido DEVE conter apenas URLs públicas indexáveis — excluindo área administrativa, endpoints de formulário e qualquer rota fora do sitemap.
- **FR-004**: Falha na submissão (rede, erro do serviço, chave recusada) NÃO PODE fazer o deploy falhar; o erro DEVE ser registrado no log com a resposta recebida.
- **FR-005**: A submissão NÃO PODE ocorrer fora do domínio de produção.
- **FR-006**: O resultado de cada submissão (quantidade de URLs e resposta do serviço) DEVE ser observável no log do deploy.

- **FR-017**: O sitemap DEVE informar a data da última modificação das páginas do blog, derivada da data de atualização (ou de publicação, na ausência dela) do próprio post. É o único sinal de atualização disponível para buscadores que não aceitam submissão programática.

#### Verificação no Bing Webmaster Tools

- **FR-007**: O site DEVE publicar o marcador de verificação de propriedade exigido pelo Bing.
- **FR-008**: O repositório DEVE documentar os passos manuais do painel (verificar propriedade, submeter sitemap, onde conferir o recebimento das submissões) de forma que outra pessoa consiga executá-los.

#### Descoberta por motores de IA

- **FR-009**: O site DEVE publicar um índice de conteúdo legível por máquina na raiz, descrevendo o negócio e listando as páginas de produto, segmento e blog com links absolutos.
- **FR-010**: Esse índice DEVE ser derivado do conteúdo real do site, sem lista mantida manualmente.
- **FR-011**: As regras de rastreamento DEVEM declarar permissão explícita para os agentes de IA relevantes (rastreadores de treinamento e de busca generativa).
- **FR-012**: As regras de rastreamento DEVEM manter a área administrativa e os endpoints de formulário fora do alcance de qualquer rastreador.

#### Feed do blog

- **FR-013**: O site DEVE publicar um feed dos posts do blog com título, descrição, link absoluto e data de publicação, em ordem cronológica decrescente.
- **FR-014**: O feed NÃO PODE incluir posts marcados como rascunho.
- **FR-015**: Todas as páginas DEVEM referenciar o feed no cabeçalho do documento.
- **FR-016**: O feed DEVE responder com documento válido mesmo sem nenhum post publicado.

### Key Entities

- **Chave de submissão**: identificador público que prova ao buscador o controle sobre o domínio. Pública por design do protocolo — não é segredo e não conta como credencial.
- **Conjunto de URLs submetidas**: lista de endereços públicos enviada em cada deploy, derivada do sitemap.
- **Índice de conteúdo para IA**: documento legível que descreve o negócio e mapeia as páginas relevantes, derivado das coleções de conteúdo.
- **Item do feed**: post do blog com título, resumo, link, data e estado de publicação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma página nova aparece no índice do Bing em até 48 horas após o deploy, contra semanas do rastreamento passivo.
- **SC-002**: 100% dos deploys de produção resultam em submissão registrada no log, com resultado explícito de sucesso ou falha.
- **SC-003**: Nenhum deploy falha por causa da submissão de URLs, mesmo com o serviço de indexação indisponível.
- **SC-004**: A propriedade aparece como verificada no painel do Bing e o sitemap consta como processado com todas as páginas públicas descobertas.
- **SC-005**: Nenhuma URL administrativa ou de endpoint de formulário aparece em qualquer artefato público de descoberta (sitemap, índice de conteúdo, submissões).
- **SC-006**: O índice de conteúdo lista todas as páginas de produto, segmento e blog publicadas, sem faltar nem sobrar, verificável na primeira geração após adicionar uma página nova.
- **SC-007**: Uma pessoa que nunca mexeu no projeto consegue refazer a verificação no painel do Bing seguindo apenas a documentação do repositório.

## Assumptions

- **`/admin` é CRM de leads, não CMS.** A descrição original previa ping "ao publicar post pelo admin", mas o painel administrativo gerencia leads; os posts do blog são arquivos de conteúdo versionados no repositório. Logo, conteúdo só muda em deploy, e o deploy é o único gatilho de submissão necessário. Um gatilho sob demanda seria código sem caso de uso.
- **Submissão programática ao Google fica fora de escopo**, com justificativa: a propriedade já foi verificada no Search Console e o sitemap submetido; a API de indexação do Google aceita apenas os tipos JobPosting e BroadcastEvent, nenhum aplicável a este site. Sobra o sinal de data de modificação no sitemap — que **hoje não é emitido** e passa a ser, nas páginas do blog, como parte desta feature.
- **O domínio de produção é o publicado no sitemap atual**; ambientes de preview não disparam submissão.
- **O sitemap existente é a fonte de verdade** das URLs públicas — ele já exclui a área administrativa, então a submissão herda essa exclusão em vez de manter uma segunda lista.
- **Volume de URLs é pequeno** (dezenas, não milhares), então submeter o conjunto completo do sitemap por deploy é aceitável enquanto não houver como derivar de forma confiável só o que mudou.
- **Sem novas dependências** além da biblioteca de geração de feed do próprio framework. Nenhuma credencial de API entra no repositório — a chave de submissão é pública por definição do protocolo.
- **Passos de painel são manuais e ficam documentados**, não automatizados: não há API de verificação de propriedade que justifique o custo.
