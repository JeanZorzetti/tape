# Asset Manifest — imagens reais da TapePro

Fonte: `imagens/` (fotos de cena) e `imagens/Sem fundo/` (recortes PNG com fundo transparente, 1500×1500, embutidos em SVG). Extração do PNG: pegar o maior blob `data:image/png;base64` de cada SVG.

## Recortes com fundo transparente (preferidos — hero/produto/portfólio)

| Origem (`Sem fundo/`) | Nome sugerido em `src/assets/` | Uso | Tipo de fita |
|---|---|---|---|
| Design sem nome (1).svg | `marca/hero-rolo-laranja.png` | **Hero** (rolo laranja da marca) | — |
| Design sem nome (2).svg | `marca/logo-tapepro.png` | **Logo** (header/footer/OG); base do favicon | — |
| Design sem nome (3).svg | `portfolio/natures.png` | Portfólio | transparente/BOPP |
| Design sem nome (4).svg | `portfolio/halyee.png` | Portfólio | transparente/BOPP |
| Design sem nome (5).svg | `portfolio/yanmei.png` | Portfólio | gomada/kraft |
| Design sem nome (6).svg | `portfolio/lyon.png` | Portfólio | transparente/BOPP |
| Design sem nome (7).svg | `portfolio/finaart.png` | Portfólio | transparente/BOPP |
| Design sem nome (8).svg | `portfolio/comando.png` | Portfólio | transparente/BOPP |
| Design sem nome (9).svg | `portfolio/quemed.png` | Portfólio | gomada/kraft |

## Fotos de cena (fundo folhagem verde — uso secundário/galeria)

- `722490122_...jpg` = logo da marca sobre trama (alternativa).
- `SaveClip_..._723100504_...jpg` = caixas lacradas → seção **Entregas nacionais**.
- Demais `SaveClip_...` = versões com fundo verde dos mesmos cases (usar só se precisar; preferir os recortes).
- `volume-conferido.png` = fita kraft "VOLUME CONFERIDO" (exemplo de mensagem impressa).

## EXCLUIR
- `imagens/sua-marca-aqui.png` — traz marca/telefone de **outro fornecedor (Chimas)**. Não usar.

## Clientes reais (prova social autorizada pelo representante)
Nature's Prime/Farma · Halyee · Yanmei · Lyon Peças Automotivas · Finaart Jeans Wear · Comando Auto Peças · Quemed.

## Paleta amostrada dos assets
- Navy da marca ≈ `#232C7A` · Laranja da marca ≈ `#F47C20` (ajustar do arquivo do logo no build).
- Valor agregado recorrente impresso nas fitas: "ESTA FITA É SUA GARANTIA…", "CUIDADO FRÁGIL", "VOLUME CONFERIDO" — usar como argumento de venda (fita de segurança/garantia).
