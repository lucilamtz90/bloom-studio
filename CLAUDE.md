# Bouquet Studio — Claude Code rules

## CSS Kit: The Bloom Atelier

This project uses The Bloom Atelier CSS kit located in `styles/`.

- `styles/bloom-tokens.css` — all design tokens (`--color-rose`, `--font-display`, `--radius-pill`, etc.)
- `styles/bloom-components.css` — component classes prefixed with `bloom-` (`.bloom-btn`, `.bloom-card`, `.bloom-input`, etc.)

**Always use these classes and tokens when writing any HTML or CSS for this project.**
Never hard-code colour hex values or font names that are already covered by a Bloom token.

### Token quick-reference

```
--color-parchment  #F6F3EE   --color-canvas   #EFEBE5
--color-rose       #B5395A   --color-mauve    #8F2D47   (raspberry accent + hover)
--color-sage       #DDD7CD   --color-bark     #1E1A19   (warm grey panel / ink)
--color-stone / --color-muted / --color-hairline / --color-line  = ink at reduced opacity

--font-display   Momo Trust Display (headers/titles only)
--font-body      Gabarito, regular weight (all other text)
--font-mono      Gabarito too — a "variant" flavour (weight 500, tracked, uppercase) used where a
                 monospace face used to sit (Typewriter message option, ticket char-count, switch
                 labels). There is no monospace face anywhere on this site any more.

--radius-*  all 0 (square UI — never add rounded corners); no shadows (flat, hairline borders)
--ease-bloom     --ease-petal
```

Style: editorial monochrome (greige + ink), Momo Trust Display + Gabarito, all regular weight, square shapes, uppercase tracked
buttons/labels. The page background is hand-drawn grid journaling paper with tiny hearts (`--texture-paper`, `images/grid-paper.svg`) with gem stickers from `images/gems/` scattered over it, kept sparse and well-spread (`layoutGems()`). The raspberry accent is used sparingly (primary buttons, step numbers, selected states). The cursor is a small heart-gem (`images/cursor-heart.png`) instead of the OS default arrow.

Site credits live in a pink "washi tape" footer (`.site-footer`/`.washi-tape`, deckle-edge
clip-path, same `--color-blush` tone as the ticket stub / music bar) — not in the header.

Four deliberate exceptions to the square-corners rule — don't "fix" these back to square:
the photo-booth machine front (`.booth-panel`/`.booth-bezel`/`.booth-opening`) around the
result-screen ticket; the pill-shaped `.bloom-switch` toggle (used for the "add jewels" and
"music" switches), which copies the two-option track shape from lucilamtz90's portfolio; the
washi-tape footer's deckled clip-path edges + slight rotation; and the `.bloom-btn--circle`
floating action buttons (share/customize/new) on the result screen.

### Circular buttons (`.bloom-btn--circle`)

Combine with a colour variant, e.g. `bloom-btn bloom-btn--circle bloom-btn--primary`:
- `bloom-btn--primary` (rose) — the primary action
- `bloom-btn--outline` (transparent, bark border) — the secondary action
- `bloom-btn--tertiary` (pale pink, `--color-blush` — same tone as the ticket stub/music
  bar/footer) — the tertiary action

Icons are inlined `<svg fill="currentColor">` (not `<img>`) so they inherit the variant's
`color` — an outlined-style icon from the Figma icon library
(figma.com/design/slBEDifQOEQ50FATyBAr8Z, node 144:201 "Icons"), saved to `images/icons/` for
reference. A label below each button uses `.ticket-fab-label`, the same font styling as
`.swatch-label` (the colour-swatch names) but always visible rather than a hover reveal.

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
