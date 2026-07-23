# Research — Execução da prospecção (Phase 0)

Poucas incógnitas; nenhuma exige dependência ou tecnologia nova. Cada decisão abaixo é local e testável.

## 1. Como mapear o passo da cadência ao script

- **Decision**: O passo é `min(tentativas.length, 5)`, indexando um array de **6 scripts por nicho**
  (1º toque + 5 follow-ups), alinhado a `CADENCIA_DIAS = [0,1,3,7,14,21]`. `tentativas.length >= 6` →
  último script (despedida). `passoDoLead(nToques)` encapsula isso.
- **Rationale**: A ficha já deriva o toque atual de `tentativas.length` (`nToques`, e `cadenciaEsgotada`).
  Reusar a mesma contagem mantém o script sincronizado com a régua de cadência sem novo estado.
- **Alternatives**: Derivar do número de dias desde o 1º toque (rejeitado — a cadência real é ajustável pelo
  representante; a contagem de toques é o sinal canônico já usado). Guardar o passo numa coluna (rejeitado —
  estado redundante; `tentativas.length` já é a verdade).

## 2. "Hoje" no fuso de operação para o contador

- **Decision**: Contar `tentativas` cujo `criado_em`, convertido para America/Sao_Paulo, cai na data de hoje
  local: `(criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date`,
  com `join` em `leads` para escopar por `pipeline`.
- **Rationale**: `tentativas.criado_em` é `timestamptz`; a virada do dia tem que seguir o fuso de operação,
  como o resto do CRM (histórico já formata em `America/Sao_Paulo`). A conversão no `where` evita depender do
  fuso do servidor Postgres.
- **Alternatives**: `criado_em::date = current_date` (rejeitado — usa o fuso do servidor/UTC; erraria a virada
  do dia perto da meia-noite BR). Materializar contagem por dia (rejeitado — YAGNI neste volume).

## 3. Instagram handle → URL do perfil

- **Decision**: `instagramUrl(bruto)` normaliza o valor guardado em `dados_import.instagram`: remove `@`,
  espaços e um eventual prefixo `instagram.com/`/`https://`; devolve `https://instagram.com/<usuario>`. Se o
  valor não render um usuário plausível, devolve `null` (a UI então só mostra o texto copiável).
- **Rationale**: Os dados são extraídos de fotos (spec 004) e vêm inconsistentes: `@marca`, `marca`, um link
  completo. Uma normalização tolerante cobre os casos reais sem travar em formato.
- **Alternatives**: Assumir sempre `@handle` (rejeitado — a planilha tem formatos mistos). Deep link de DM
  pré-preenchida (rejeitado — o Instagram não suporta DM pré-preenchida por URL; por isso "link do perfil +
  DM copiável", conforme o clarify).

## 4. Substituição de placeholders com degradação

- **Decision**: `montarScript(template, { empresa, nome })` substitui `[empresa]`/`[nome]` e, quando `nome`
  falta, usa uma saudação neutra (sem deixar `[nome]` cru). Regra final: **nenhum `[...]` sobra** no texto de
  saída (varredura que garante SC-004). Templates de recuperação assumem `empresa` sempre presente.
- **Rationale**: Recuperação quase nunca tem nome de contato (planilha extraída de fotos); o script tem que
  ler bem mesmo só com a empresa. A degradação é regra de negócio, não detalhe cosmético.
- **Alternatives**: Deixar o placeholder e confiar no representante editar (rejeitado — viola SC-004 e o
  objetivo de "pronto para enviar"). Exigir nome (rejeitado — mataria o uso na maioria dos leads).

## 5. Fonte de verdade dos scripts (travado no clarify)

- **Decision**: Conteúdo estruturado em `src/lib/scripts.ts` (a fonte que a tela lê e o WhatsApp/DM usa). O
  playbook [`docs/estrategia-prospeccao.md`](../../docs/estrategia-prospeccao.md) §4 é a origem editorial dos
  textos, mas segue como documento narrativo paralelo, sem sincronização automática.
- **Rationale**: Parsear a prosa do playbook seria frágil; um script de conferência pagaria esse custo só para
  um aviso de divergência de baixa consequência. `// ponytail: uma fonte no app; conferência contra o doc só
  se a divergência virar dor real.`
- **Alternatives**: Derivar do markdown (rejeitado — frágil). App + conferência (adiado — upgrade futuro).

## 6. Meta diária configurável

- **Decision**: Constante `META_TOQUES_DIA` em `adminUi.ts`, **default 20**, com override opcional por variável
  de ambiente (`Number(import.meta.env.META_TOQUES_DIA) || 20`). Sem tela de configuração.
- **Rationale**: "Configurável com valor padrão" (FR-010) sem inventar UI de settings (fora do escopo do CRM
  monousuário). O override por env cobre ajuste sem deploy de código.
- **Alternatives**: Tabela de configuração (rejeitado — over-engineering para um valor). Hard-coded sem
  override (rejeitado — FR-010 pede configurável).
