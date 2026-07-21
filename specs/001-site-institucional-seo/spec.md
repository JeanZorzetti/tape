# Feature Specification: Site Institucional SEO-first (TapePro — fitas adesivas)

**Feature Branch**: `001-site-institucional-seo`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: site institucional SEO-first para representante comercial da TapePro (fitas adesivas personalizadas, B2B), com funil de orçamento (WhatsApp + formulário), sem carrinho/checkout, superando o SEO fraco do site oficial e capturando long-tail que os concorrentes líderes não cobrem.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Encontrar a TapePro numa busca long-tail e chegar a uma página que resolve a dúvida (Priority: P1)

Um comprador B2B (comprador industrial, dono de e-commerce, distribuidor) pesquisa no Google algo específico como "fita gomada reforçada para caixa pesada" ou "fita personalizada com logo pedido mínimo baixo". O site aparece com um título e descrição relevantes, a pessoa clica e cai numa página que responde exatamente àquela intenção e a conduz naturalmente ao pedido de orçamento.

**Why this priority**: É a razão de o site existir. O site oficial e os concorrentes líderes não cobrem long-tail nem têm conteúdo de aplicação/uso; capturar esse tráfego é a vantagem competitiva e a fonte de leads qualificados.

**Independent Test**: Publicar um conjunto de páginas de produto/aplicação/artigo com SEO técnico completo e verificar que cada uma tem título, meta description, URL limpa em português, dados estruturados e um CTA de orçamento — e que respondem a uma intenção de busca específica.

**Acceptance Scenarios**:

1. **Given** uma página de produto ou artigo publicada, **When** um mecanismo de busca a rastreia, **Then** ela expõe título único, meta description, URL semântica em português, canonical, Open Graph e dados estruturados válidos.
2. **Given** um visitante que chega por busca long-tail, **When** ele lê a página, **Then** encontra a resposta à sua intenção e pelo menos um caminho claro para solicitar orçamento sem sair da página.
3. **Given** o site publicado, **When** avaliado por uma ferramenta de auditoria, **Then** cada página indexável tem exatamente um `<h1>`, hierarquia de headings coerente e nenhuma URL órfã (todas alcançáveis por navegação/sitemap).

---

### User Story 2 - Solicitar orçamento (WhatsApp ou formulário) (Priority: P1)

Um visitante interessado decide pedir preço. Ele clica em "Solicitar orçamento" e escolhe: abrir uma conversa no WhatsApp já com uma mensagem pré-preenchida, ou enviar um formulário curto (nome, empresa/CNPJ, tipo de fita, quantidade estimada, mensagem). O representante recebe o lead com dados suficientes para cotar.

**Why this priority**: É a conversão — o objetivo comercial do site. Sem um funil de orçamento confiável, o tráfego de SEO não vira receita.

**Independent Test**: Preencher e enviar o formulário e clicar no CTA de WhatsApp em desktop e mobile, confirmando que o lead chega ao destino configurado com todos os campos e que o usuário vê uma confirmação clara.

**Acceptance Scenarios**:

1. **Given** um visitante em qualquer página relevante, **When** ele aciona o CTA de orçamento, **Then** vê as duas opções (WhatsApp e formulário) sem fricção.
2. **Given** o formulário preenchido com dados válidos, **When** enviado, **Then** o lead é entregue ao destino configurado e o visitante vê uma mensagem de sucesso; se o envio falhar, vê uma mensagem de erro com o que fazer (ex.: tentar o WhatsApp).
3. **Given** o CTA de WhatsApp, **When** acionado, **Then** abre a conversa com o número correto e uma mensagem pré-preenchida que identifica a página de origem.
4. **Given** um envio de formulário, **When** processado, **Then** campos obrigatórios são validados e entradas maliciosas/spam são mitigadas antes da entrega.

---

### User Story 3 - Avaliar produtos, diferenciais e credibilidade (Priority: P2)

Antes de pedir orçamento, o visitante quer entender o que a TapePro vende e por que confiar. Ele navega pelas páginas dos três produtos (fita transparente personalizada, fita gomada reforçada, fita transparente comum), vê especificações, fotos reais, aplicações, e os diferenciais (pedido mínimo a partir de 20 rolos, +1.000 empresas atendidas).

**Why this priority**: Consideração e confiança. Reduz o atrito antes da conversão e diferencia da concorrência (que exige pedidos mínimos maiores).

**Independent Test**: Navegar por cada página de produto e pela página institucional e confirmar que specs, fotos reais, aplicações, diferenciais e prova social estão presentes e consistentes.

**Acceptance Scenarios**:

1. **Given** a página de um produto, **When** o visitante a lê, **Then** encontra dimensões/specs (ex.: 48mm × 100m, até 2 cores; 70mm × 150m com reforço de nylon), aplicações e ao menos uma foto real do produto.
2. **Given** qualquer página do site, **When** o visitante procura credibilidade, **Then** os diferenciais (pedido mínimo baixo, nº de empresas atendidas) estão acessíveis de forma consistente.

---

### User Story 4 - Ler conteúdo educativo que ajuda a escolher a fita certa (Priority: P2)

Um visitante em fase de pesquisa lê artigos do blog, páginas de aplicação por segmento (indústria, distribuidor, e-commerce, lojas) e um FAQ que respondem dúvidas técnicas (como escolher a fita, tipos e aplicações, personalização, quantidades). Esse conteúdo o aproxima da decisão e alimenta o SEO.

**Why this priority**: É o motor de SEO long-tail e a lacuna dos concorrentes. Suporta a US1 gerando entradas orgânicas, mas o site entrega valor mesmo com um conjunto inicial menor de artigos.

**Independent Test**: Publicar um conjunto inicial de artigos/páginas de aplicação e FAQ, cada um respondendo a uma intenção de busca, com links internos para os produtos e para o orçamento.

**Acceptance Scenarios**:

1. **Given** um artigo ou página de aplicação, **When** publicado, **Then** tem SEO técnico completo, links internos relevantes para produtos e um CTA de orçamento.
2. **Given** o FAQ, **When** rastreado por um mecanismo de busca, **Then** expõe dados estruturados de perguntas e respostas.

---

### Edge Cases

- **Envio de lead com destino indisponível**: se o serviço de entrega do formulário falhar, o visitante vê erro acionável e o caminho alternativo (WhatsApp), sem perder o que digitou.
- **Spam/bots no formulário**: envios automatizados são mitigados (ex.: honeypot/validação) sem adicionar fricção perceptível ao humano.
- **JavaScript desabilitado ou lento**: o conteúdo principal e os CTAs de orçamento permanecem visíveis e utilizáveis (o site é estático por natureza).
- **Imagem faltando/quebrada**: nenhuma página exibe ícone de imagem quebrada em produção; reserva de espaço evita layout shift.
- **Conteúdo duplicado / paginação de blog**: URLs canônicas evitam competir consigo mesmo; nenhuma página indexável fica órfã.
- **Termo de marca**: buscas por "TapePro"/"Tape Pro" não devem confundir o visitante sobre a relação entre este site e a marca oficial.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O site MUST apresentar os três produtos em páginas dedicadas, cada uma com especificações, aplicações e ao menos uma foto real do produto.
- **FR-002**: Cada página indexável MUST expor metadados de SEO completos: título único, meta description, URL limpa em português, canonical, e tags Open Graph/Twitter.
- **FR-003**: O site MUST expor dados estruturados legíveis por máquina apropriados a cada tipo de página (organização/empresa, produto, FAQ, artigo).
- **FR-004**: O site MUST publicar um `sitemap.xml` com todas as páginas indexáveis e um `robots.txt` coerente com a política de indexação.
- **FR-005**: Toda página relevante MUST oferecer um caminho de conversão para orçamento com duas opções: abrir WhatsApp com mensagem pré-preenchida (identificando a página de origem) e um formulário de orçamento.
- **FR-006**: O formulário de orçamento MUST coletar, no mínimo, nome, empresa/CNPJ, tipo de fita, quantidade estimada e mensagem, validando campos obrigatórios antes do envio.
- **FR-007**: O sistema MUST entregar cada lead enviado ao destino configurado do representante e MUST exibir confirmação de sucesso ou erro acionável ao visitante.
- **FR-008**: O formulário MUST mitigar spam/bots sem exigir etapas que prejudiquem a acessibilidade.
- **FR-009**: O site MUST publicar conteúdo educativo (blog, páginas de aplicação por segmento e FAQ) estruturado para intenções de busca long-tail, com links internos para produtos e para o orçamento.
- **FR-010**: O site MUST destacar os diferenciais comerciais (pedido mínimo a partir de 20 rolos; +1.000 empresas atendidas) de forma consistente e verificável.
- **FR-011**: Todas as imagens informativas MUST ter `alt` específico; imagens decorativas MUST ter `alt` vazio; nenhuma imagem MUST usar serviço de placeholder ou stock genérico.
- **FR-012**: O site MUST ser responsivo mobile-first e atender contraste e navegação por teclado em nível WCAG AA, respeitando preferência de movimento reduzido.
- **FR-013**: O site MUST carregar rápido em conexões móveis típicas, com imagens otimizadas e JavaScript mínimo, sem layout shift perceptível.
- **FR-014**: A identidade visual MUST seguir as regras anti-"cara de IA" do `CLAUDE.md`, ancorada no mundo de fita adesiva, evitando template genérico, botão azul padrão e gradiente previsível.
- **FR-015**: O site MUST se posicionar como canal do **representante comercial oficial/autorizado** da TapePro, usando a marca, o nome e as fotos oficiais de forma consistente em todas as páginas e nos dados estruturados. O representante é autorizado a usar os ativos de marca, e o conteúdo pode mirar o termo de marca ("TapePro") como canal oficial.
- **FR-016**: A estratégia de SEO MUST ter **alcance nacional (Brasil)**, focada em intenções long-tail temáticas de produto e aplicação (entrega por transportadora). Esta versão NÃO inclui páginas por localidade nem SEO local baseado em endereço físico; os dados estruturados de entidade usam Organização (não LocalBusiness).

### Key Entities *(include if feature involves data)*

- **Produto**: um tipo de fita comercializado. Atributos: nome, categoria (personalizada / gomada / comum), especificações (largura, comprimento, cores de impressão, reforço), aplicações, fotos, diferenciais associados.
- **Página de Aplicação / Segmento**: caso de uso por perfil de cliente (indústria, distribuidor, e-commerce, lojas). Atributos: segmento, dores atendidas, produtos recomendados, CTA.
- **Artigo (Blog)**: conteúdo educativo long-tail. Atributos: título, intenção/keyword-alvo, corpo, links internos, data, produtos relacionados.
- **Item de FAQ**: pergunta e resposta. Atributos: pergunta, resposta, agrupamento temático.
- **Lead de Orçamento**: solicitação enviada por um visitante. Atributos: nome, empresa/CNPJ, tipo de fita, quantidade estimada, mensagem, página de origem, canal (WhatsApp/formulário).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das páginas indexáveis publicadas possuem título único, meta description, URL semântica em português, canonical e dados estruturados válidos (verificável por auditoria automatizada).
- **SC-002**: Em auditoria de qualidade web padrão, todas as páginas principais atingem faixa alta em Performance, Acessibilidade, Boas Práticas e SEO (metas de Core Web Vitals dentro do "bom").
- **SC-003**: Um visitante consegue solicitar orçamento (via WhatsApp ou formulário) a partir de qualquer página relevante em no máximo 2 cliques.
- **SC-004**: 100% dos leads de formulário enviados com dados válidos chegam ao destino configurado do representante, com confirmação visível ao visitante.
- **SC-005**: No lançamento, o site cobre os 3 produtos, ao menos 4 páginas de aplicação/segmento, um FAQ e um conjunto inicial de ao menos 6 artigos long-tail — superando em profundidade de conteúdo o site oficial e cobrindo lacunas dos concorrentes.
- **SC-006**: Nenhuma página exibe imagem de placeholder, stock genérico ou imagem quebrada em produção.
- **SC-007**: O site é utilizável e legível de 360px (mobile) a desktop, com foco de teclado visível e movimento reduzido respeitado.

## Assumptions

- **Papel do usuário**: o operador do site é o representante comercial da TapePro; o público é B2B (empresas, geralmente CNPJ), não consumidor final.
- **Sem transação online**: não há carrinho, checkout, pagamento nem área logada nesta versão; a conversão é geração de lead por orçamento.
- **Stack (restrição dada)**: Astro + Tailwind (estático/SSG), escolhida para SEO e performance; o conteúdo é autorado como arquivos de conteúdo estruturado (sem CMS no-code separado na v1).
- **Entrega de leads**: os leads do formulário são entregues ao representante por um serviço de formulário/e-mail configurável; número de WhatsApp e e-mail de destino são fornecidos pelo representante como configuração.
- **Ativos reais**: fotos reais dos produtos serão fornecidas pelo representante/TapePro; enquanto não houver, páginas não usam placeholder — o espaço fica reservado e a publicação da página aguarda o ativo real.
- **Idioma/mercado**: conteúdo em português do Brasil.
- **Dados de produto**: os três produtos e diferenciais descritos são a base inicial; catálogo pode crescer.
- **Fora de escopo (v1)**: carrinho, checkout, pagamento online, login/área do cliente, integração com ERP/estoque.
