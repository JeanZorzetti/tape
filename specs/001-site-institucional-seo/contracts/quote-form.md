# Contract — Funil de Orçamento (formulário + WhatsApp)

Cobre FR-005/006/007/008. Site estático: sem backend próprio.

## Formulário (Web3Forms)

**Método**: `POST` para `https://api.web3forms.com/submit` (multipart/form-data), com `access_key` embutido.

**Campos** (ver `Lead` em data-model.md):

| Campo (name) | Obrigatório | Validação |
|---|---|---|
| `nome` | sim | não-vazio |
| `empresa` | sim | não-vazio |
| `cnpj` | não | se preenchido: 14 dígitos / máscara CNPJ |
| `email` | sim | formato e-mail |
| `telefone` | sim | não-vazio (máscara BR) |
| `tipoFita` | sim | ∈ {`personalizada`,`gomada`,`comum`,`nao_sei`} |
| `quantidadeEstimada` | sim | não-vazio |
| `mensagem` | não | — |
| `paginaOrigem` | auto (hidden) | URL da página de origem |
| `botcheck` | hidden honeypot | DEVE estar vazio; se preenchido, descartar |
| `_subject` | auto | ex.: "Novo orçamento — {tipoFita} — {empresa}" |

**Anti-spam**: honeypot `botcheck` + Cloudflare Turnstile opcional. Sem CAPTCHA visual intrusivo (a11y).

**Estados (obrigatório expor ao usuário)**:
- *sucesso* (HTTP ok): mensagem "Recebemos seu pedido de orçamento — retornamos em breve." + limpar form.
- *erro de validação* (client-side, antes do POST): marca campos inválidos, foco no primeiro erro.
- *erro de envio* (rede/serviço): mensagem acionável + oferecer o WhatsApp como alternativa; preserva o que foi digitado.

**Acessibilidade**: labels associados, erros com `aria-describedby`, foco gerenciado, funciona via teclado.

## WhatsApp (deep-link)

`https://wa.me/{WHATSAPP_NUMERO}?text={mensagem}` — número em `constants.ts`, `mensagem` `encodeURIComponent`.

Template da mensagem (identifica a origem — Acceptance Scenario US2/3):
```
Olá! Vim pela página {paginaOrigem} e quero um orçamento de {contexto}.
```
`{contexto}` = produto da página quando houver (ex.: "fita gomada"), senão genérico.

**Contrato do CTA**: presente em toda página relevante; ≤ 2 cliques até WhatsApp ou formulário (SC-003). Em página de produto, o texto já vem com o produto.
