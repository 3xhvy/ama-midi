# Login Page Design — Amanotes Brand, AMA-MIDI Shell

**Date:** 2026-05-22  
**Status:** Approved

## Goal

Rebuild `/login` so it reflects Amanotes corporate identity (logo, pink→purple gradient accents) while preserving the AMA-MIDI app design system (light shell, Inter, indigo primary for in-app UI).

## Decisions (brainstorm)

| Topic | Choice |
|-------|--------|
| Overall balance | **App-first** — light `#F8F7FF` shell; Amanotes as accents only |
| Layout | **Centered card** — logo above white card; sign-in inside card |
| Google CTA | **Gradient-accent button** — white fill, gradient rim, Google “G” icon |
| Extra accents | **Button + card rim** — no gradient headline |
| Footer | **None** |

## Visual structure

```
[ AmanotesLogo — above card ]
[ gradient rim → white card ]
  AMA-MIDI (h1)
  tagline
  [ gradient rim → Google sign-in link ]
```

## Tokens (additive)

```css
--amanotes-pink: #ff3177;
--amanotes-purple: #5b00e3;
```

Tailwind: `from-amanotes-pink`, `to-amanotes-purple`. Do **not** replace `--color-primary` (#6C63FF).

## Components & files

| File | Role |
|------|------|
| `pages/LoginPage.tsx` | Login UI (`<main>`, card, CTA) |
| `components/AmanotesLogo.tsx` | Unchanged wordmark SVG |
| `globals.css` | CSS variables |
| `tailwind.config.js` | `amanotes` colors, optional `shadow-amanotes` |
| `App.tsx` | Route only |

## Sign-in link

`${VITE_API_URL ?? 'http://localhost:3001'}/auth/google` — same fallback as `features/auth/api.ts`.

## Out of scope

Footer, dark hero, Montserrat, email/password, shared `BrandPanel` abstraction, changes to post-login pages.

## Accessibility

- Logo: `aria-label="Amanotes"`
- `<main aria-labelledby="login-title">`
- CTA: `<a>` with visible “Sign in with Google” + icon `aria-hidden`
