# Tapepro — Project Instructions

> Source: adapted from `awesome-cursorrules/rules/clean-code.mdc`,
> `awesome-cursorrules/rules/toss-style-design-system.mdc`, and
> `awesome-cursorrules/rules/landing-page-image-quality-cursorrules-prompt-file.mdc`.
> This is the Claude Code equivalent of a Cursor `.mdc` rule — Claude loads this file
> automatically in every prompt for this project.

## Project Context

> **Nova sessão: leia [`handoff.md`](handoff.md) na raiz primeiro** — estado do build, pendências e o pedido do usuário de retrabalhar o visual da home.

- **TapePro** (tapeprofitas.com.br) sells **custom / branded adhesive tapes** (fitas adesivas personalizadas) — B2B, made-to-order by volume: printed BOPP packing tape, fita gomada (kraft, nylon-reinforced), plain transparent tape.
- We are building a **separate, SEO-first site** because the official one has weak SEO. The project owner is becoming a **commercial representative** for TapePro.
- **Stack:** Astro + Tailwind (chosen for SEO/performance — static-first, minimal JS).
- **Market model:** the whole niche sells by **quote, not cart** — competitors (Fitpel, Artfix) and TapePro itself all funnel to WhatsApp + orçamento form; CNPJ / volume-based. Treat "e-commerce" as a lead-gen funnel unless a standardized-roll catalog with checkout is explicitly scoped.
- **SEO opening:** no competitor has a blog or rich application/use-case pages. Long-tail technical + application content (how to choose tape, industrial use cases, personalização) is the open lane — win on content depth + structure, not on a prettier one-pager.
- **Brand identity (from real assets):** logo is **TAPE** (deep navy) + **PRO** (orange), tagline "FITAS PERSONALIZADAS"; the signature product shot is a vivid orange roll. Palette = navy + orange + kraft (the boxes) + off-white + near-black ink. Sample exact hex from the logo file.
- **Real assets:** product/portfolio photos live in `imagens/` — TapePro's own client work (Finaart, Nature's, Quemed, Lyon, Halyee, Yanmei, Comando…), printed transparent (BOPP) and kraft/gummed tapes, often with a printed security/warranty message ("ESTA FITA É SUA GARANTIA…", "CUIDADO FRÁGIL", "VOLUME CONFERIDO"). **Exclude `sua-marca-aqui.png`** — it carries another supplier's brand/phone (Chimas), not TapePro's.
- **WhatsApp:** +55 62 98344-3919.

## Design & Visual Identity — kill the "AI look"

> Goal: TapePro must not look like a generic Tailwind template. Every visual choice
> is grounded in TapePro's own subject — **custom adhesive tapes**: the roll and its core,
> the unspooled diagonal strip mid-peel, the brand printed repeating down the tape, kraft
> vs. glossy BOPP, the clean sealed box. Design from that world, not from a component-library default.

### The AI tells — do NOT ship these
- **Everything centered.** Center is a fallback, not a layout. Use asymmetry, a real grid, and left-aligned reading columns. Center only when the content genuinely warrants it.
- **Default blue buttons + purple/blue gradient hero.** Never reach for `blue-600` and a `from-blue-500 to-purple-600` gradient because it's there. No decorative gradients as a crutch.
- **The three AI-generated clichés** (they appear regardless of subject — avoid unless the brief truly demands one): (1) cream `#F4F1EA` background + high-contrast serif + terracotta accent; (2) near-black background + a single acid-green/vermilion accent; (3) broadsheet layout with hairline rules, zero radius, dense newspaper columns.
- Uniform card grids where every feature is an identical rounded box with an icon on top. Generic stock/atmospheric images. Emoji as iconography.

### Ground it in the subject
- The hero is a thesis: open with the most characteristic thing in TapePro's world — a roll unspooling with the client's brand printed down the strip, a real box being sealed, the tactile peel — not a big-number-with-gradient-accent template.
- Use the **real brand palette** — TapePro navy + orange (from the logo), with kraft and off-white as materials — not a generic scheme. The brand navy is a specific deep navy; still never the lazy Tailwind `blue-600`, and no predictable blue→purple gradient.
- Structural devices (numbering, eyebrows, dividers) must encode something true. Only use `01 / 02 / 03` markers if the content is an actual ordered sequence.

### Typography (from Toss discipline)
- Deliberate display + body pairing — not the same families every project reaches for. Make the type treatment itself memorable.
- Strict type scale with clear roles (page title, section title, body, supporting, metadata). Use **weight and color before size** to build hierarchy.
- Never pure black (`#000`) text — use a dark grayscale foreground.
- Product specs are trust signals: set dimensions and quantities (48mm × 100m, "mín. 20 rolos", nº de cores) with tabular figures so they align and scan; make the number dominant and its unit smaller but legible.

### Color, layout & rhythm (from Toss discipline)
- One primary accent; carry most structure in grayscale. No competing accent colors, no gratuitous shadows.
- Semantic colors for status only (success / warning / error / info) — and never communicate status by color alone.
- Consistent spacing tokens — **no one-off spacing values**. Related content close, unrelated separated by whitespace.
- Cards only for content that needs a surface; restrained, consistent radius; subtle shadow **or** border, not both. No nested cards.
- Rebuild the grayscale for dark mode instead of inverting; reduce accent intensity on dark surfaces.

### Motion — deliberate, not scattered
- One orchestrated moment (a roll unspooling on load, or a scroll-triggered peel revealing the printed brand) usually lands harder than effects sprinkled everywhere. Extra animation reads as AI-generated.

### Imagery (from Landing Page Image Quality)
- No placeholder services (`placehold.co`, `picsum.photos`, `via.placeholder.com`, etc.) and no hotlinking. Use real photos of the actual product — the printed rolls, the tape sealing a box, the finish and texture.
- Match images to real content — no vague atmospheric stock when the buyer needs to judge print quality and finish. Consistent aspect ratios; set `width`/`height` or `aspect-ratio` to prevent layout shift; specific `alt` text.

### Restraint & quality floor
- Spend boldness in **one** signature element; keep everything around it quiet. Before shipping, remove one accessory.
- Non-negotiable floor: responsive to mobile, visible keyboard focus, WCAG AA contrast, `prefers-reduced-motion` respected, semantic HTML before ARIA.

## Clean Code Guidelines

### Constants Over Magic Numbers
- Replace hard-coded values with named constants
- Use descriptive constant names that explain the value's purpose
- Keep constants at the top of the file or in a dedicated constants file

### Meaningful Names
- Variables, functions, and classes should reveal their purpose
- Names should explain why something exists and how it's used
- Avoid abbreviations unless they're universally understood

### Smart Comments
- Don't comment on what the code does - make the code self-documenting
- Use comments to explain why something is done a certain way
- Document APIs, complex algorithms, and non-obvious side effects

### Single Responsibility
- Each function should do exactly one thing
- Functions should be small and focused
- If a function needs a comment to explain what it does, it should be split

### DRY (Don't Repeat Yourself)
- Extract repeated code into reusable functions
- Share common logic through proper abstraction
- Maintain single sources of truth

### Clean Structure
- Keep related code together
- Organize code in a logical hierarchy
- Use consistent file and folder naming conventions

### Encapsulation
- Hide implementation details
- Expose clear interfaces
- Move nested conditionals into well-named functions

### Code Quality Maintenance
- Refactor continuously
- Fix technical debt early
- Leave code cleaner than you found it

### Testing
- Write tests before fixing bugs
- Keep tests readable and maintainable
- Test edge cases and error conditions

### Version Control
- Write clear commit messages
- Make small, focused commits
- Use meaningful branch names
