# Bouquet Studio — Claude Code rules

## CSS Kit: The Bloom Atelier

This project uses The Bloom Atelier CSS kit located in `styles/`.

- `styles/bloom-tokens.css` — all design tokens (`--color-rose`, `--font-display`, `--radius-pill`, etc.)
- `styles/bloom-components.css` — component classes prefixed with `bloom-` (`.bloom-btn`, `.bloom-card`, `.bloom-input`, etc.)

**Always use these classes and tokens when writing any HTML or CSS for this project.**
Never hard-code colour hex values or font names that are already covered by a Bloom token.

### Token quick-reference

```
--color-parchment  #F5F0EC   --color-canvas   #EDECEA
--color-rose       #D9C5C0   --color-mauve    #B89FA0
--color-sage       #C4C5AA   --color-stone    #A8A089
--color-bark       #2C2725   --color-muted    #8C7F7A

--font-display   Cormorant Garamond (headings)
--font-body      Jost (UI / body)
--font-mono      Courier Prime (labels / receipt)

--radius-sm 8px  --radius-md 16px  --radius-lg 24px  --radius-pill 999px
--ease-bloom     --ease-petal
```

### Component classes

| Element | Class |
|---|---|
| Hero heading | `bloom-hero` |
| Eyebrow label | `bloom-eyebrow` |
| Body text | `bloom-body` |
| Primary button | `bloom-btn bloom-btn--primary bloom-btn--lg/md/sm` |
| Dark button | `bloom-btn bloom-btn--dark` |
| Outline button | `bloom-btn bloom-btn--outline` |
| Card | `bloom-card` |
| Form field wrapper | `bloom-field` |
| Label | `bloom-label` |
| Text input | `bloom-input` |
| Textarea | `bloom-textarea` |
| Tag/badge | `bloom-tag bloom-tag--rose/sage/mauve/dark/outline` |
| Toast | `bloom-toast bloom-toast--dark/rose` |
| Ornament divider | `bloom-ornament` |
| Fade-up animation | `bloom-animate-fade-up` |

Full usage examples are in `bloom-usage.md`.

## Project stack

- Pure HTML/CSS/JS single file (`index.html`) — no framework, no build step
- `html2canvas` (CDN) for PNG export
- Web Share API for native sharing
- 10-language i18n via `TRANSLATIONS` object + `navigator.language` detection
- Arabic RTL via `dir="rtl"` on `<html>`
