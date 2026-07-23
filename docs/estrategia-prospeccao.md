# Estratégia de prospecção — lista outbound (pipeline de recuperação)

> Playbook comercial para trabalhar a lista de **502 empresas** já capturada em
> [`docs/leads-bruto.csv`](leads-bruto.csv) na pipeline **Recuperação** do CRM (`/admin`).
> A máquina já existe (cadência de 6 toques, funil, carteira, projeção). Isto é o **como usar**:
> ordem de ataque, scripts, ritmo e metas. Documento **interno** — não vai para o site público.
>
> Fontes reais: análise da planilha (abaixo), dores por segmento em
> [`src/content/segmentos/*.mdx`](../src/content/segmentos), tickets e cenários em
> [`/admin/projecao`](../src/pages/admin/projecao.astro).

---

## TL;DR — a tese em 5 linhas

1. **O ativo:** 502 empresas na lista. Só **214 (43%) têm canal de contato** — essa é a base
   real de trabalho. As outras 288 ficam para enriquecimento, não travam a operação.
2. **A fila imediata:** **205 empresas com canal + confiança de leitura alta.** Comece por elas.
3. **A lista é pulverizada** (284 ramos distintos): não se prospecta por ramo, e sim pelos
   **4 perfis de embalagem** do site — cada um com uma dor e um produto-âncora diferentes.
4. **O dinheiro está em dois lugares:** ticket alto na **gomada** (volume/peças pesadas, 2–4× o
   ticket) e volume de fechamento na **personalizada de R$404** (marca na entrega, e-commerce).
5. **A recompra é o jogo:** fita é consumível de alto giro. O 1º pedido paga o tempo; a carteira
   recontatada a cada 30 dias é o retorno. Meta ancorada no cenário **realista** da projeção.

---

## 1. A base real (o que a planilha diz)

| Métrica | Valor | Leitura comercial |
|---|---|---|
| Empresas na lista | 502 | O universo. |
| **Com algum canal** | **214 (43%)** | A base prospectável **hoje**. |
| Com canal **+ confiança alta** | **205** | **A fila que você ataca primeiro.** |
| WhatsApp | 160 | Canal principal — cadência de 6 toques cabe aqui. |
| Instagram | 100 | Marcas de moda/cosmético/fitness — abordagem por DM. |
| Telefone (sem WhatsApp) | 54 | Ligar ou testar se o número tem WhatsApp. |
| E-mail | 10 | Marginal — não construa cadência em cima disso. |
| Sem nenhum canal | 288 (57%) | Fila de **enriquecimento**, não de ataque. |
| Ramos distintos | 284 | Pulverizado: agrupe por perfil, não por ramo. |
| Sem ramo preenchido | 129 | Descobrir o ramo no 1º toque (pergunta natural). |

**Conclusão:** você tem ~205 empresas para começar a cadenciar **amanhã de manhã**, sem depender
de mais nenhuma captação. O gargalo não é falta de lista — é execução disciplinada dessa fila.

---

## 2. Ordem de ataque — 4 filas

Trabalhe de cima para baixo. Marque cada lead no CRM com **nicho** (campo `leads.nicho`) e avance a
etapa da pipeline de recuperação (`a_contatar → contatado → interessado → recuperado → descartado`).

| Fila | Quem | Por quê primeiro | Produto-âncora |
|---|---|---|---|
| **A — Ticket alto** | Peças, hidráulica, ferragens, embalagens, distribuidora, transportes — **com canal** | Caixa pesada / rastreio → **gomada** (ticket 2–4×). Menos numerosos, mas cada fechamento vale muito. | Gomada reforçada + personalizada no lacre |
| **B — Volume de fechamento** | Cosméticos, moda, fitness, alimentos, açaí, pet, suplementos, brindes — **com canal** (muitos no Instagram) | Marca na entrega / unboxing → **personalizada R$404**. Dor clara, decisão rápida, mínimo baixo. | Personalizada (isca de entrada) |
| **C — Descobrir** | Os com canal mas **sem ramo** (129) | Têm como falar; falta saber o perfil. Descobre-se na 1ª pergunta. | Definir no 1º toque |
| **D — Enriquecer** | Os **288 sem canal** | Não dá para cadenciar sem canal. Trabalho de bastidor, em paralelo. | — |

> **Regra:** nunca deixe a Fila A parada esperando a Fila D. Enriquecimento é tarefa de intervalo
> (fim de tarde, dia de chuva), nunca substitui a cadência ativa das filas A/B/C.

---

## 3. Segmentação — ramo real → nicho → dor-âncora → produto

Casamento dos ramos que aparecem na lista com os 4 segmentos do site. A **dor-âncora** vem palavra
por palavra das [dores dos segmentos](../src/content/segmentos) — é o gancho do 1º toque.

| Perfil (nicho CRM) | Ramos na lista | Dor-âncora (o gancho) | Produto a puxar |
|---|---|---|---|
| **Indústria / expedição** | peças agrícolas, embalagens, produtos que saem em volume | "A fita descola no meio do transporte" · "Ninguém sabe de onde veio o volume" | Gomada (>20 kg) + personalizada/comum no fluxo |
| **Distribuidor / transporte** | distribuidora, transportes, auto peças, hidráulica, ferragens | "Avaria sem responsável definido" · "Volume trocado entre cargas" | Gomada (alto valor) + personalizada (volume geral) |
| **E-commerce** | cosméticos, moda feminina, jeans, fitness, esportes, suplementos, maquiagem, açaí, pet, alimentos | "A embalagem não parece sua" · "Extravio na última milha" | **Personalizada R$404** (unboxing) |
| **Lojas / franquias / redes** | uniformes, gráfica, comunicação visual, informática, móveis planejados, hospitalar | "Cada unidade embala de um jeito" · "Entrega local sem identificação" | Personalizada + comum |

> **Gancho universal de conversão:** *"te mando uma prévia da sua marca impressa na fita"*. Ver a
> própria logo no rolo é o momento que vira interesse em pedido — o clichê (custo único, a partir de
> R$80) é a única barreira de entrada, e a prévia derruba ela.

---

## 4. Scripts de abordagem

Princípios (B2B WhatsApp/DM, 2026): **mensagem curta**, contexto relevante na 1ª linha, **uma** dor,
**um** CTA leve. Nada de "Olá, tudo bem?" seguido de parede de texto. Sem preço no 1º toque — o preço
puxa para o orçamento, não fecha por mensagem. WhatsApp oficial: **+55 62 98344-3919**.

### 4.1 — WhatsApp · E-commerce / marca (Fila B)

> Oi, [nome/marca]! Vi a [marca] aqui e queria te mostrar uma coisa rápida.
>
> Vocês despacham em caixa pardo comum? A gente faz **fita personalizada com a marca de vocês
> impressa** — a caixa vira embalagem de marca sem trocar de caixa, e o lacre ainda protege contra
> extravio na entrega.
>
> Posso te mandar uma **prévia da logo de vocês na fita** pra você ver como fica? Sem compromisso.

### 4.2 — WhatsApp · Volume / peças pesadas (Fila A)

> Oi, [nome]! Trabalho com fitas de lacre pra quem envia volume — vi que a [empresa] é do ramo de
> [peças/hidráulica/etc].
>
> A pergunta que sempre faço: **a fita de vocês aguenta a caixa empilhada até o cliente, ou levanta a
> aba no meio do caminho?** A gente tem a **gomada reforçada com fios de nylon** (vira parte da caixa,
> pra abrir tem que rasgar) e a **personalizada** com o nome de vocês no lacre pra identificar o volume.
>
> Quer que eu monte um orçamento rápido pro volume que vocês fecham por mês?

### 4.3 — Instagram DM · marcas que só têm Insta (as 100)

> Oi! Acompanhei o feed de vocês 👀 vocês vendem bastante online, né?
>
> Faço **fita personalizada com a marca impressa** — pro pacote de vocês chegar com a cara da [marca]
> e não numa caixa pardo qualquer. Mínimo baixo, serve pra caixa de qualquer tamanho.
>
> Te mando uma prévia da logo na fita? 🎁

### 4.4 — Lojas / franquias / redes (Fila B/C)

> Oi, [nome]! Vocês têm mais de uma unidade / entregam em casa?
>
> A fita personalizada é o jeito mais barato de **padronizar o pacote em todas as unidades** — a matriz
> compra em lote e distribui, o gerente não precisa escolher nada. E na entrega local, identifica de qual
> loja veio.
>
> Posso te mostrar uma prévia com a marca de vocês?

### 4.5 — Toques de follow-up (D+1 em diante, sem resposta)

Não repita a 1ª mensagem. Cada toque muda o ângulo:

- **D+1:** *"Passando aqui de novo — consigo te mandar a prévia da fita hoje ainda se quiser 🙂"*
- **D+3:** foto de um case real (portfólio: Nature's, Halyee, Lyon…) — *"Olha como ficou pra [cliente similar]"*.
- **D+7:** ângulo de dor diferente do 1º toque (se puxou marca, agora puxa proteção/extravio).
- **D+14:** *"Fecho o mês com uma condição boa pra primeiro pedido — quer que eu reserve?"*
- **D+21 (último):** *"Vou parar de te incomodar 🙂 se um dia precisar de fita com a marca de vocês, é só chamar."* → se sem resposta, marca **descartado**.

### 4.6 — Respostas a objeções

| Cliente diz | Resposta |
|---|---|
| "Quanto custa?" | Puxa spec antes do preço: *"Depende do volume e se é 1 ou 2 cores. Fecha quantos rolos/mês mais ou menos? Aí te passo certinho."* |
| "Já tenho fornecedor" | *"Show. Só pra referência: quanto vocês pagam por rolo hoje? Muita gente troca quando vê a arte + o preço no volume."* |
| "É caro personalizar" | *"A arte tem um custo único (o clichê, a partir de R$80) que fica guardado — do 2º pedido em diante você paga só a fita. Some rápido no volume."* |
| "Me manda por e-mail" | Manda, mas mantém o WhatsApp: *"Mandei! Qualquer dúvida respondo aqui mesmo, é mais rápido."* |

---

## 5. Cadência operacional (a régua de 6 toques no CRM)

A pipeline de recuperação usa a **mesma cadência de 6 toques** do CRM: **D+0, +1, +3, +7, +14, +21**.
Cada toque é uma ação registrada na ficha do lead (canal + resultado), e o sistema já sugere a próxima data.

| Toque | Dia | Ação | Etapa CRM |
|---|---|---|---|
| 1 | D+0 | 1ª abordagem (script da seção 4) | `a_contatar` → `contatado` |
| 2 | D+1 | Reforço leve | `contatado` |
| 3 | D+3 | Prova social (case do portfólio) | `contatado` |
| 4 | D+7 | Novo ângulo de dor | `contatado` |
| 5 | D+14 | Gancho de condição / urgência | `contatado` |
| 6 | D+21 | Despedida educada | → `descartado` se sem resposta |

**Quando responde com interesse** → mova para **`interessado`** e trabalhe o orçamento (a prévia da arte,
o volume, o produto). **Quando fecha o 1º pedido** → registre o pedido: o lead vira **`recuperado`**,
entra na **carteira** e agenda recontato **+30 dias** automaticamente.

### Ritmo diário sugerido (1 representante)

- **~20 toques/dia úteis** = mix de novos 1ºs toques + follow-ups da cadência.
- Começa com ~10–12 novos 1ºs toques/dia; conforme a cadência enche, os follow-ups (D+1, D+3…) tomam a
  fila e você reduz os novos para ~4–6/dia. **A cadência vencida do dia tem prioridade sobre lead novo.**
- Nesse ritmo a fila de 205 recebe o 1º toque em **~5–6 semanas** e todos os 6 toques em **~90 dias** —
  o horizonte do cenário da projeção.
- **Bloco fixo:** 1 hora de manhã limpando os **follow-ups vencidos** (o CRM destaca), depois 1º toques.

---

## 6. Metas e leitura do funil

Não invente meta — **use o cenário `realista`** já modelado em [`/admin/projecao`](../src/pages/admin/projecao.astro),
e compare **meta × real** semanalmente no mesmo painel (ele já cruza com o funil por coorte).

Premissas do cenário realista (sobre a base contatável):

- Resposta **25%** · resposta→orçamento **40%** · orçamento→fechado **30%** → **~6 leads → 1 cliente**.
- Sobre ~214 contatáveis: **~15–20 clientes** de 1º pedido no ciclo de 90 dias.
- Ticket blended ~R$1.100 · **potencial ano 1 com recompra** é onde o modelo paga.

**Rotina de leitura (semanal, 10 min):**

1. `/admin?pipeline=recuperacao` — quantos follow-ups vencidos? (meta: **zero** ao fim do dia).
2. `/admin/funil?pipeline=recuperacao` — as 3 taxas reais **vs.** a meta. Onde vaza?
   - Resposta baixa (<15%) → problema de **canal/abertura** (revise os scripts da seção 4, teste Instagram).
   - Responde mas não orça → problema de **oferta** (mande a prévia da arte mais cedo).
   - Orça e não fecha → problema de **preço/condição** (trabalhe o gancho do clichê e do volume).
3. `/admin/projecao?pipeline=recuperacao` — % da meta de receita; ajuste o ritmo se estiver atrás.

---

## 7. Enriquecimento dos 288 sem canal (fila D, em paralelo)

Não pare a operação por eles, mas recupere canal aos poucos — cada um vira um lead da Fila B/C:

- **Tem Instagram mas não WhatsApp (parte dos 100):** DM primeiro; peça o WhatsApp na conversa.
- **Sem nada:** busque `[empresa] + [cidade_uf]` no Google/Instagram; a maioria de PME tem WhatsApp no perfil.
- **Enriqueça no próprio CRM:** a seção **"Dados da prospecção"** na ficha do lead tem os 12 campos
  editáveis — preencha o WhatsApp achado e salve; o botão de WhatsApp e a busca passam a funcionar.
- **Meta modesta:** recuperar canal de ~5 empresas/dia no intervalo já devolve ~100 leads em um mês.

---

## 8. Arranque — os primeiros passos

1. **Rodar o import** (decisão operacional, ainda não feita):
   `DATABASE_URL=<prod> node scripts/importar-recuperacao.mjs docs/leads-bruto.csv`
   → cria os 502 como pipeline `recuperacao`, etapa inicial, idempotente.
2. **Marcar nicho** nos ~205 da fila imediata (Fila A/B) — habilita o funil por nicho depois.
3. **Semana 1:** atacar a **Fila A** (ticket alto, menos gente) enquanto calibra os scripts; começar a Fila B.
4. **A partir da semana 2:** ritmo de ~20 toques/dia, follow-up vencido em primeiro lugar.
5. **Fim de cada semana:** rotina de leitura (seção 6). Dobre no que estiver convertendo.

---

## 9. Regras de ouro

- **Follow-up vencido antes de lead novo.** Sempre. É onde o dinheiro já está a meio caminho.
- **Sem preço no 1º toque.** Preço puxa para orçamento; scripts vendem a dor e a prévia da arte.
- **A prévia da marca na fita é o melhor argumento** — use cedo, é o que vira interesse em pedido.
- **Gomada em quem manda volume/peça pesada** (ticket 2–4×); **personalizada de R$404 como isca** no resto.
- **Recompra é o jogo.** Todo `recuperado` entra na carteira; o recontato de +30 dias não é opcional.
- **Um ângulo de dor por toque** — nunca repita a mesma mensagem; a lista de dores da seção 3 é o roteiro.
- **Descarte sem culpa** após o 6º toque sem resposta — libera seu tempo para a fila que responde.
