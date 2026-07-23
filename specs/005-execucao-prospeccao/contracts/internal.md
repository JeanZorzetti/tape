# Contratos internos — Execução da prospecção (Phase 1)

O projeto não expõe API pública nova. Os "contratos" desta feature são internos: a **API do módulo de
scripts**, a **função de leitura** em `crm.ts`, e as **adições de UI** nas duas páginas `/admin`. Nenhuma
nova rota HTTP nem nova ação de formulário (POST) — a feature é display + links.

## 1. `src/lib/scripts.ts` (módulo novo)

```ts
// Passo da cadência (0..5) a partir do nº de toques já registrados.
export function passoDoLead(nToques: number): number;      // min(max(nToques,0), 5)

// Template do script para (nicho, passo). Fallback genérico se nicho ausente/não mapeado.
export function scriptDoLead(nicho: string | null, nToques: number): string;

// Substitui [empresa]/[nome]; degrada sem deixar nenhum [...] cru. (SC-004)
export function montarScript(template: string, ctx: { empresa: string; nome?: string }): string;

// Respostas a objeções (referência exibida na ficha).
export const OBJECOES: readonly { pergunta: string; resposta: string }[];
```

**Contrato de comportamento:**
- `passoDoLead(0) === 0`; `passoDoLead(1) === 1`; `passoDoLead(6) === 5`; `passoDoLead(99) === 5`.
- `scriptDoLead(n, k)` retorna um template não-vazio para **todo** `n ∈ NICHOS.value ∪ {null, "outro"}`.
- `montarScript(t, ctx)` nunca retorna string contendo `[` seguido de palavra e `]` (sem placeholder cru).

## 2. `src/lib/adminUi.ts` (acréscimos)

```ts
export const META_TOQUES_DIA: number;                 // default 20; override env META_TOQUES_DIA; > 0 garantido
export function instagramUrl(bruto: string | null): string | null;  // @x|x|instagram.com/x → https://instagram.com/x
```

## 3. `src/lib/crm.ts` (acréscimo)

```ts
// Tentativas registradas HOJE (America/Sao_Paulo) na pipeline dada.
export async function contarToquesHoje(pipeline?: Pipeline): Promise<number>;
```

**Contrato de comportamento:**
- Conta apenas tentativas cujo dia local (America/Sao_Paulo) é hoje.
- Escopa por `pipeline` via `join leads` (default `"inbound"`, coerente com as outras leituras).
- Tentativa de ontem no fuso local **não** conta; tentativa de lead de outra pipeline **não** conta.

## 4. UI — `src/pages/admin/[id].astro` (bloco novo, só `pipeline === "recuperacao"`)

Contrato visual/funcional (zero-JS):
- Renderiza **um** bloco "Script de abordagem" próximo à Cadência, exibindo `montarScript(scriptDoLead(
  lead.nicho, nToques), { empresa: lead.empresa, nome: lead.nome ?? undefined })`.
- Rótulo do passo atual (ex.: "1º toque" … "despedida"), coerente com "toque N de 6" já exibido.
- **Ação de contato**, na ordem:
  1. `lead.telefone` presente → botão **WhatsApp** `href = whatsappParaNumero(lead.telefone, <script atual>)`.
  2. senão `instagramUrl(lead.dados_import?.instagram)` não-nulo → link **"Abrir Instagram"** + texto copiável.
  3. senão → apenas o texto do script (copiável).
- **Objeções** (`OBJECOES`) exibidas como referência (ex.: `<details>` sem JS).
- Não aparece para `pipeline === "inbound"` (FR-008).
- Não altera nenhum form/ação existente da página.

## 5. UI — `src/pages/admin/index.astro` (acréscimo no cabeçalho da lista)

- Exibe `contarToquesHoje(pipelineSelecionada)` como **"N / META_TOQUES_DIA toques hoje"**.
- Estado **meta atingida** (`N >= META_TOQUES_DIA`) comunicado por rótulo/ícone além de cor (FR-012).
- Escopo = pipeline já selecionada na página (mesmo `?pipeline=` das demais leituras).
- Nunca exibe divisão por zero (META garantida > 0).

## Testes que verificam estes contratos

- `tests/scripts.test.mjs` — `passoDoLead`, `montarScript` (sem placeholder cru), cobertura de nichos,
  `instagramUrl` (formatos mistos).
- `tests/execucao-prospeccao.test.mjs` — `contarToquesHoje`: conta só hoje, escopa por pipeline, ignora
  ontem/pipeline alheia. (Integração, pula sem `DATABASE_URL`.)
