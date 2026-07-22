# Handoff — Harness de prompt de imagem para os posts do blog

> Documento de passagem entre sessões. Leia junto com [`handoff.md`](handoff.md) e `CLAUDE.md`.
> Criado em **2026-07-21**. Status: **concluído** — as 7 capas trocadas.
> Objetivo: gerar, a partir do assunto de cada post, um **prompt em inglês** para o Gemini produzir a imagem de capa.

---

## O que construir

Um script Node que lê o frontmatter de um post e imprime um prompt em inglês pronto para colar no Gemini.

```bash
node scripts/prompt-imagem-post.mjs como-escolher-fita-para-caixa-pesada   # um post
node scripts/prompt-imagem-post.mjs                                        # todos
```

**O harness NÃO chama a API do Gemini.** Decisão tomada: sem `GEMINI_API_KEY`, sem `@google/genai`, sem custo por imagem. O projeto hoje não tem nenhuma dependência de IA e não vale abrir esse precedente para uma tarefa que roda meia dúzia de vezes por mês. Você cola o prompt no Gemini, salva o arquivo e roda a normalização.

**O valor do harness é o invólucro, não a cena.** Derivar automaticamente uma boa cena a partir de uma long-tail em português exigiria um LLM — que é justamente o que estamos evitando aqui. Quem escreve a cena (uma linha) é o autor do post; o script embrulha essa linha em ~20 linhas de direção de arte consistente: paleta da marca, luz, lente e a lista de proibições. É isso que garante que 30 posts não virem 30 estéticas diferentes.

---

## ⚠️ Decisão registrada — e a tensão com o CLAUDE.md

**Decidido:** as imagens geradas entram **nos artigos do blog, incluindo a troca das imagens dos 7 posts atuais**.

O `CLAUDE.md` manda usar *"fotos reais do produto — os rolos impressos, a fita selando a caixa"* e proíbe placeholder. Esta decisão **abre uma exceção só para as capas de blog**. O motivo é real: o acervo tem ~10 fotos e um blog que cresce esgota isso em poucas semanas — o risco de repetir a mesma foto em quatro posts é maior que o de usar imagem gerada.

**O limite da exceção — não ultrapassar:**

| Onde | O que usa |
| --- | --- |
| Capas de **post de blog** | Imagem gerada (esta exceção) |
| `/segmentos/*` | **Foto real.** Não trocar. |
| `/produtos/*` | **Foto real.** Não trocar — o comprador julga acabamento e qualidade de impressão ali. |
| Home, portfólio, `/sobre` | **Foto real.** É prova social de cliente. |

---

## 🚨 Duas armadilhas que já estão montadas

### 1. Duas fotos são compartilhadas com segmentos — apagar quebra o build

Ao trocar as capas dos posts, **não delete** estas duas:

- `volume-conferido.jpg` → usada em `/segmentos/distribuidor` **e** no post do aviso de segurança
- `caixas-lacradas.jpg` → usada em `/segmentos/industria` **e** no post de por que descola

As outras cinco (`fita-gomada-quemed`, `fita-gomada-yanmei`, `fita-natures`, `rolo-tapepro`, `fita-comando`) ficam sem referência depois da troca. **Mantenha os arquivos** — são material real de portfólio e servem para páginas futuras. Astro simplesmente não as inclui no bundle enquanto ninguém importar.

### 2. Os `imagemAlt` atuais citam marcas reais — viram mentira

Os alts de hoje descrevem o que a foto real mostra:

> `"Rolo de fita adesiva transparente personalizada com a marca Comando Auto Peças impressa"`

Uma imagem gerada **não terá** a marca Comando, nem deve ter (a lista de proibições veta logos). Manter esse alt é descrever uma coisa que não está na tela — quebra acessibilidade e é falso.

**Ao trocar a imagem, reescreva o `imagemAlt` no mesmo commit.** O alt novo descreve a cena gerada, sem nome de cliente.

---

## Passo 1 — campo `cenaImagem` no schema

Em `src/content.config.ts`, na coleção `blog`:

```ts
/** Uma linha em inglês descrevendo a cena — entra no prompt do Gemini.
 *  Ver scripts/prompt-imagem-post.mjs e handoff-imagens-blog.md. */
cenaImagem: z.string().optional(),
```

Opcional para o build não quebrar em post antigo; o script avisa quando falta.

## Passo 2 — o script

`scripts/prompt-imagem-post.mjs`. Lê os `.mdx` de `src/content/blog/`, parseia o frontmatter (o campo é uma linha simples — dá para pegar com regex, sem adicionar um parser de YAML), e monta o prompt.

O corpo do prompt é uma constante única. **Não parametrize a direção de arte** — ela ser fixa é o ponto.

```
Editorial product photograph, 3:2 landscape aspect ratio.

SUBJECT: {cenaImagem}

MATERIAL TRUTH: packaging adhesive tape as it really looks — glossy transparent BOPP
film with visible thickness at the cut edge of the roll, or matte brown kraft paper
gummed tape with a fibrous, slightly uneven surface. Corrugated cardboard with an
honest recycled-fibre texture, not clean white board. Show how the tape physically
behaves: tension across a box seam, a slight lift at a flap edge, an unspooled strip
curving under its own weight.

COLOUR: deep navy (#232c7a) and warm orange (#f47c20) are the only saturated accents,
and they must be carried by a real object — a roll, a printed band, a crate — never as
a background wash or gradient. Everything else is kraft brown, off-white and near-black.
Muted and material, not candy-coloured.

LIGHT: a single soft directional daylight source from the side, honest falloff, real
contact shadows. Warehouse or packing-bench ambience. Not studio seamless white, not
rim-lit hero product lighting.

CAMERA: 50mm, eye level or slight top-down, shallow depth of field, focus on the tape.

STRICTLY AVOID: any text, letters, numbers or writing anywhere in the frame, except a
word the SUBJECT explicitly asks to be printed — and that word must be spelled exactly
as written there and appear nowhere else; any logo, brand mark or watermark of any
other company; any human face; an object floating on a radial
spotlight or glowing disc; blue-to-purple gradients; a glossy 3D render or CGI look;
stock-photo staging with a smiling worker holding a clipboard; a centred symmetrical
composition.

The frame must read as a real photograph taken in a real packing area.
```

**Por que cada proibição está lá:**
- **Texto e letras** — geradores produzem garatuja, e texto falso em português numa fita seria pior que nenhum. Também evita inventar aviso de segurança que a TapePro não imprime. **Exceção:** a palavra `TAPEPRO` quando a própria cena pede (dois posts pedem hoje) — é a marca da casa, não simula cliente. Conferir a grafia na imagem antes de commitar; se o gerador errar uma letra, descartar e gerar de novo.
- **Logo e marca** — imagem gerada não pode simular cliente real. Prova social só com foto real.
- **Objeto flutuando sobre spotlight radial** — essa direção **já foi reprovada** neste projeto (virou "disco/prato", ver histórico de design no `handoff.md`). Não repetir.
- **Gradiente azul→roxo, render 3D, foto de banco de imagem** — as marcas de "cara de IA" listadas no `CLAUDE.md`.

## Passo 3 — as 7 cenas

Cada uma sai da tese real do artigo, não do título:

| Post | `cenaImagem` |
| --- | --- |
| como-escolher-fita-para-caixa-pesada | `a heavy over-filled cardboard box on a warehouse pallet, the top flap under visible tension against a single strip of tape, the seam starting to bow open` |
| fita-gomada-ou-fita-bopp | `two tape rolls side by side on a workbench, one glossy transparent film and one matte brown kraft paper, a short strip of each pulled out and laid flat to compare` |
| o-que-e-cliche-flexografico | `a flexible flexographic printing plate with a raised relief surface lying on a press bench next to a partly printed tape roll, ink catching on the raised areas` |
| quanto-custa-personalizar-fita-adesiva | `a receding row of identical tape rolls stacked on a warehouse shelf, depth of field falling away down the row, suggesting quantity and scale` |
| quantos-rolos-de-fita-por-mes | `a half-used tape roll beside a full one on a packing bench, the difference in remaining diameter clearly readable, sealed boxes stacked behind` |
| aviso-de-seguranca-na-fita-reduz-extravio | `a close crop of a cardboard box seam where tape has been cut and pressed back down, the disturbed edge catching the light as evidence of opening` |
| por-que-a-fita-descola-do-papelao | `a macro of a tape strip lifting away from recycled cardboard with a layer of torn brown fibre still stuck to the adhesive, the box left pale where the paper came away` |

## Passo 4 — normalizar e trocar

Salve o arquivo em `imagens/gerado/` e rode:

```bash
node scripts/normalizar-imagem-post.mjs <origem.png> <destino.jpg> [corte] [l,t,w,h]
```

Depois, no `.mdx` do post: apontar `imagem` para o arquivo novo **e reescrever `imagemAlt`** (ver armadilha 2).

### 🚨 Armadilha 3 — o watermark ✦ do Gemini

Toda imagem vem com uma estrelinha de quatro pontas perto do canto inferior direito —
**a uns 10% da borda, não colada nela**, então margem fixa não resolve. Abra a imagem
final antes de commitar; se a estrela estiver lá, use o 4º argumento (`l,t,w,h`) para
recortar a região antes do redimensionamento. Foi o que as duas capas trocadas exigiram.

O Gemini também ignora o 3:2 às vezes e devolve 1:1 — daí o argumento `corte`
(`center`, `bottom`, `atencao`…) para escolher que parte sobrevive.

### Convenção de nomes

`imagens/gerado/` guarda **um PNG por post, com o nome do slug** — é a origem, pareada
1:1 com o `.mdx`. Regerou? Sobrescreve o arquivo do slug. Nada de subpasta por lote e
nada de `Gemini_Generated_Image_…`: sem o slug no nome ninguém sabe qual imagem é de
qual post daqui a duas semanas.

O nome do destino em `src/assets/conteudo/` descreve a **cena**, não o slug
(`bopp-e-gomada-lado-a-lado.jpg`) — é o que o `imagemAlt` vai dizer, e a foto pode ser
reaproveitada em outra página.

## Estado das 7 capas

| Post | Situação |
| --- | --- |
| por-que-a-fita-descola-do-papelao | ✅ `fita-descolando-papelao.jpg` |
| aviso-de-seguranca-na-fita-reduz-extravio | ✅ `lacre-violado-papelao.jpg` |
| quanto-custa-personalizar-fita-adesiva | ✅ `rolos-tapepro-prateleira.jpg` |
| fita-gomada-ou-fita-bopp | ✅ `bopp-e-gomada-lado-a-lado.jpg` |
| quantos-rolos-de-fita-por-mes | ✅ `rolos-tapepro-diametros.jpg` |
| o-que-e-cliche-flexografico | ✅ `cliche-flexografico-bancada.jpg` |
| como-escolher-fita-para-caixa-pesada | ✅ `caixa-pesada-aba-cedendo.jpg` |

**Critério que decidiu a última capa.** Havia duas opções limpas de texto: uma caixa
sendo lacrada com aplicador, e a caixa estufada com as abas arqueando. Ganhou a
segunda porque **a capa tem que ser a tese do artigo** — o post explica que o peso não
rompe a fita, abre a aba, e só uma das imagens mostra isso. Imagem bonita que conta a
história errada perde para imagem correta.

Ela vinha perfeitamente centrada e simétrica (um dos "AI tells" do `CLAUDE.md`): os
512px que o 3:2 exigia saíram **todos de um lado só**, o que jogou a caixa para fora do
centro e ainda levou o watermark junto. Corte assimétrico resolve os dois de uma vez.

Nas duas rodadas, a proibição só pegou quando entrou **dentro do `SUBJECT`**
("completely blank unprinted", "no shipping label") — o bloco `STRICTLY AVOID` sozinho
foi ignorado nas quatro primeiras. E `TAPEPRO` numa palavra só virou "TAPPEPRO"; pedir
`'TAPE'` e `'PRO'` como duas palavras empilhadas acertou nas duas vezes.

Nenhuma foto real foi apagada — `fita-gomada-yanmei`, `fita-natures` e `fita-comando`
ficaram sem referência com esta troca, e continuam no repositório.

## Definition of done

- [x] `scripts/prompt-imagem-post.mjs` roda com slug e sem slug
- [x] `cenaImagem` no schema, preenchido nos 7 posts
- [x] 7 imagens geradas, normalizadas em 1200×800 e commitadas
- [x] 7 `imagemAlt` reescritos, **sem nome de cliente**
- [x] `volume-conferido.jpg` e `caixas-lacradas.jpg` **ainda existem** e os segmentos seguem no ar
- [x] `npm run build && npm run verificar` → TUDO OK, 21 páginas
- [ ] Conferir as 7 capas lado a lado: se duas parecerem a mesma imagem, a direção de arte está genérica demais — mexer na cena, não no invólucro
