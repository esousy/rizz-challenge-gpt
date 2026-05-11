# Design Brief: Rizz Me If You Can

## Purpose & Tone
Gamified AI chat experience for practicing flirting. Confident, playful, modern. Blends iMessage clarity with Duolingo gamification energy.

## Differentiation
Confidence-forward design: vibrant purple accents, bold typography, zero UI clutter. Every element has intentional purpose. Game overlay (score, level, progress) persists as header; chat is the focal point.

## Color Palette (OKLCH)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Primary (accent) | 0.65 0.22 280 | 0.65 0.22 280 | User bubbles, buttons, scores, interactive states |
| Background | 0.99 0 0 | 0.12 0 0 | Page background (near-black dark) |
| Foreground | 0.15 0 0 | 0.95 0 0 | Body text (dark light, light dark) |
| Card | 0.97 0 0 | 0.16 0 0 | AI bubble background |
| Muted | 0.92 0 0 | 0.22 0 0 | AI bubble text, secondary UI |
| Destructive | 0.55 0.22 25 | 0.65 0.19 22 | Error states, warnings |
| Border | 0.88 0.01 280 | 0.25 0.02 280 | Input borders, dividers (subtle purple tint) |

## Typography

| Tier | Font | Weight | Size | Usage |
|------|------|--------|------|-------|
| Display | Space Grotesk | 700 | 2.5rem–3.5rem | Title, level, score |
| Body | General Sans | 400–600 | 1rem | Chat messages, UI copy, buttons |
| Mono | Geist Mono | 400–500 | 0.875rem | Stats, code snippets (optional) |

## Structural Zones

| Zone | Treatment | Example |
|------|-----------|----------|
| Header | `bg-card`, `border-b border-border`, persistent | Level (Level 1 – Easy), Interest gauge (50%) |
| Chat area | `bg-background`, scrollable, flex column | User & AI bubbles, fade-in animation |
| Input | `bg-card`, `border-t border-border`, fixed bottom | Text input + send button |
| Feedback card | `bg-muted/20`, rounded-lg, inline below AI message | Score (72/100), breakdown, buttons |
| Buttons | `rounded-lg`, primary accent or secondary | "Start Challenge", "Try again", "Next level" |

## Component Patterns

- **Chat bubbles**: `rounded-2xl` (24px), user = accent purple, AI = muted gray, padding `px-4 py-3`, max-width constraint
- **Score display**: `.score-display` = 5xl bold font-display accent color, tracking-tight
- **Input box**: Border-b on header, input text + icon button (send), fixed position
- **Feedback card**: Horizontal breakdown (confidence/humor/originality as stacked labels), large score, action buttons below

## Motion & Transitions

- **Fade-in**: New messages, 0.3s ease-in-out (`.fade-in` utility)
- **Scroll**: Auto-scroll to bottom on new message (smooth behavior)
- **Button hover**: Slight opacity shift (opacity-80), no delay
- **No bounce/scale animations**: Confidence-forward means restrained motion

## Constraints

- **Mobile-first**: Single column, max-width 512px content on desktop
- **Dark mode only** (no light mode toggle)
- **High contrast**: AA+ WCAG compliance, accent on dark passes all checks
- **Font loading**: Swap display (no invisible text during load)
- **No animations on initial page load**: Fade-in only applies to chat messages post-load

## Signature Detail

Purple-tinted borders on input/card elements echo the accent color and unify the design. Score display in large, bold Space Grotesk creates visual emphasis without clutter.
