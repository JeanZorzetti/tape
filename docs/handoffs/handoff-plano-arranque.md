# Handoff — Plano de arranque da prospecção outbound

> Documento de passagem para **outra sessão/chat**. O objetivo desta próxima sessão é **criar o
> "Plano de arranque"**: a rotina operacional concreta para começar a prospectar a lista outbound —
> o que fazer na segunda de manhã, nas 2 primeiras semanas. **Não é uma feature de código** (a
> máquina já existe); é um plano de execução ancorado no playbook que já está pronto.
>
> Data: **2026-07-23**. Leia junto: [`../estrategia-prospeccao.md`](../estrategia-prospeccao.md) (o
> playbook), [`handoff.md`](handoff.md) (estado geral) e [`CLAUDE.md`](../../CLAUDE.md).

## O pedido

O usuário já tem a **estratégia** (playbook) e o **suporte no CRM** (em andamento — ver abaixo). O que
falta é o **plano de arranque**: transformar a estratégia num roteiro operacional dos primeiros 10–15
dias úteis. Menos "o que é a estratégia", mais "abre o CRM segunda 9h e faz **isto**".

## Estado atual (o que já existe — NÃO refazer)

- **Playbook completo** em [`docs/estrategia-prospeccao.md`](../estrategia-prospeccao.md), também
  visível no CRM em **`/admin/estrategia`**. Tem ordem de ataque (4 filas), scripts por canal/nicho,
  cadência de 6 toques, metas ancoradas na projeção. **É a fonte — o plano de arranque destila ela.**
- **Pipeline de recuperação implementada** (spec 004): lista escopada por pipeline, **já ordenada por
  canal + confiança** ([`crm.ts`](../../src/lib/crm.ts) `listarLeads`), cadência de 6 toques, funil por
  coorte, carteira (+30d), seção "Dados da prospecção" editável na ficha. Etapas próprias:
  `a_contatar → contatado → interessado → recuperado → descartado`.
- **Projeção** em `/admin/projecao?pipeline=recuperacao` — 3 cenários, meta × real, tickets.
- **Suporte no CRM em andamento** (feature nova, via Spec Kit, iniciada na sessão de 2026-07-23):
  scripts na ficha do lead + contador de toques do dia. Confira o estado em `specs/` antes de assumir
  o que existe na tela — pode já ter mudado a ficha do lead.

### ⚠️ O gargalo que o plano precisa resolver primeiro

**O import NUNCA foi rodado em produção.** Sem ele, `/admin` na pipeline recuperação está vazio — não há
o que prospectar. O plano de arranque **começa** por essa decisão/passo:

```
DATABASE_URL=<prod> node scripts/importar-recuperacao.mjs docs/leads-bruto.csv
```

Cria os 502 como `pipeline='recuperacao'`, etapa inicial, idempotente (rodar 2× não duplica). Validado
em banco de teste: `inseridos: 502 · pulados: 0 · sem-empresa: 1`.

## Os números reais (base da rotina)

Da análise de [`docs/leads-bruto.csv`](../leads-bruto.csv) (502 empresas):

- **214 têm canal (43%)** → base prospectável hoje. **205 com canal + confiança alta** → a fila imediata.
- Canais: **WhatsApp 160 · Instagram 100 · telefone 54 · e-mail 10**. 288 sem canal (enriquecimento).
- Ramos **pulverizados** (284 distintos) → agrupar nos 4 perfis do playbook, não prospectar por ramo.

## O que o "Plano de arranque" deve entregar

Um documento curto e operacional (sugestão: `docs/plano-arranque.md`), com:

1. **Checklist de largada** (uma vez): rodar o import · conferir que os 502 aparecem em
   `/admin?pipeline=recuperacao` · marcar nicho nos ~205 da fila imediata.
2. **Rotina diária** concreta: bloco da manhã (follow-ups vencidos primeiro) + bloco de 1ºs toques;
   quantos toques/dia (o playbook sugere ~20 — **confirmar com o usuário** quanto tempo/dia ele tem).
3. **Semana 1 × Semana 2** dia a dia: semana 1 ataca a **Fila A** (ticket alto/gomada) enquanto
   calibra scripts; semana 2 entra no ritmo cheio com a Fila B.
4. **Checkpoint semanal**: o que olhar em `/admin/funil` e `/admin/projecao` (as 3 taxas real × meta) e
   como reagir (resposta baixa → canal; orça e não fecha → preço/condição).
5. **Meta das 2 semanas**: número concreto de 1ºs toques dados e primeiras respostas — não receita
   ainda (o ciclo é de 90 dias).

## Decisões a confirmar com o usuário (antes de fechar o plano)

1. **Roda o import agora?** É a decisão operacional que destrava tudo. (Recomendado: sim.)
2. **Quanto tempo/dia** o representante tem para prospectar? Define a meta de toques/dia (o playbook
   assume ~20; pode ser menos no começo).
3. **WhatsApp vs. Instagram primeiro?** 160 têm WhatsApp, 100 Instagram — atacar em paralelo ou
   priorizar o WhatsApp (cadência estruturada) e deixar Instagram como 2ª onda?

## Regra do projeto

Este projeto tem `.specify/` → **se o plano virar mudança de código/tela, usar o fluxo Spec Kit**
(`/speckit-specify`…), não superpowers. Mas o plano de arranque em si é um **documento operacional**;
provavelmente não precisa de código nenhum. Idioma: português (código/commits em inglês).

Ao terminar, subir com commit + push para `main` (preferência do usuário) e, se fizer sentido,
apontar o novo doc em [`handoff.md`](handoff.md).
