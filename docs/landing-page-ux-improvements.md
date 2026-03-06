# Landing Page UX Improvement Suggestions

**Page analysed:** `expansion` variant — `/en`
**Date:** 2026-02-26

---

## Executive summary

The current page is structurally sound — clear value prop, try-it CTA above the fold, social proof, pain/solution flow, FAQ. But the visual texture is monotone: every section is a flat card grid with identical border-radius, identical icon-pill + title + body pattern, and no visual rhythm change. The result reads like a well-organized spec sheet rather than a narrative that pulls the visitor forward.

Below are 12 targeted suggestions grouped by section. Each one is scoped to be implementable with shadcn/ui primitives, Tailwind, and the existing CSS animation approach (no new heavy dependencies).

---

## 1. Hero — Add a live before/after preview

**What:** Replace the static subtitle copy with a small interactive before/after visual — e.g. a miniature browser-chrome frame showing a snippet of a page in English on the left and the same snippet in French on the right, with a subtle sliding divider or tab toggle.

**Narrative:** The hero currently asks visitors to _imagine_ what a localized page looks like. A concrete visual shortcut ("oh, that's what my site would look like in French") is more persuasive than any sentence. It also pre-loads the mental model for the try-form result.

**shadcn approach:** Use the `Card` component as the browser-chrome wrapper. shadcn `Tabs` (install: `npx shadcn@latest add tabs`) for a simple EN / FR toggle, or a pure CSS `resize` divider for the slider approach.

---

## 2. Hero — Make the rotating word more visually distinct

**What:** Give the rotating outcome word (`conversions`, `bookings`, …) a distinct visual treatment — gradient text fill using the primary-to-accent palette, or an animated underline/highlight swoosh.

**Narrative:** Right now the rotating word is the same colour as the rest of the heading. The eye doesn't know _where_ to look during the transition. A colour or decoration difference creates a visual anchor: the user's gaze locks onto the changing word and absorbs each outcome variant, which reinforces the "this works for multiple goals" message.

**shadcn approach:** Pure Tailwind: `bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent` on the rotating `<span>`. Combine with the existing CSS keyframe animation.

---

## 3. Hero — Rethink stat cards as a horizontal trust bar

**What:** Collapse the 3 stat cards (`330+ CDN locations`, `SEO-ready`, `Brand-safe`) into a compact horizontal trust bar — a single row of icon + label chips separated by subtle dividers, sitting right below the subtitle instead of in big cards.

**Narrative:** The current 3-card grid is visually heavy for what is essentially trust signalling. It competes with the try-form for attention. A compact trust bar communicates the same credibility in less vertical space, freeing the hero to breathe and letting the try-form dominate visually.

**shadcn approach:** Use `Badge` variant="outline" for each chip, laid out in a `flex` row with `divide-x divide-border` or small `|` separators. The `InViewCountUp` can still animate the 330+ number.

---

## 4. Pain section — Add a visual "cost of inaction" chart or meter

**What:** Replace or complement the purple callout box with a small animated horizontal bar chart or gauge that fills up as the user scrolls to it — e.g., "76% prefer native language" shown as a progress bar filling to 76%.

**Narrative:** Numbers in text are easy to skim past. A visual bar filling to 76% creates a visceral "that's a lot" moment. It transforms a passive stat-read into a scroll-triggered micro-experience that makes the pain feel tangible.

**shadcn approach:** Use the shadcn `Progress` component (install: `npx shadcn@latest add progress`) with an IntersectionObserver-triggered value transition. Wrap in a `Card` for consistent styling.

---

## 5. Pain section — Flip the pain cards into a "before/after" comparison

**What:** Instead of 3 separate pain cards, show a two-column comparison: "Without WebLingo" (pain) on the left vs. "With WebLingo" (gain) on the right, using contrasting visual treatments (muted/destructive tones vs. primary/success tones).

**Narrative:** Pain points alone create anxiety but no relief. A before/after frame resolves the tension immediately, making the visitor nod along ("yes, I have that problem → oh, they solve it"). This is the classic PAS (Problem-Agitate-Solve) framework made visual.

**shadcn approach:** Two `Card` components side by side. Left card: `border-destructive/20 bg-destructive/5` with `X` icons. Right card: `border-primary/20 bg-primary/5` with `Check` icons. Use shadcn `Separator` between them on mobile (stacked).

---

## 6. Use cases section — Add hover interaction or expandable detail

**What:** Make the 3 use-case cards interactive: on hover (desktop) or tap (mobile), expand to show a concrete example ("e.g., your /pricing page in Japanese with local currency formatting") and a mini-screenshot or illustration.

**Narrative:** The current cards are static blurbs that could describe any SaaS. Adding a concrete example per card makes the use case tangible and self-qualifying: the visitor sees their own situation reflected and thinks "that's me."

**shadcn approach:** Use shadcn `HoverCard` (install: `npx shadcn@latest add hover-card`) for desktop, or `Collapsible` (install: `npx shadcn@latest add collapsible`) for a mobile-friendly expand/collapse. The expanded state shows an extra paragraph + optional image.

---

## 7. How-it-works — Add visual artefacts to each step

**What:** Each timeline step currently shows a title and body text. Add a small visual beside each step card: step 1 shows a miniature URL input, step 2 shows a rendered page thumbnail with a language flag, step 3 shows a sync/refresh icon animation.

**Narrative:** The timeline structure is good but the cards are text-heavy. Small visuals alongside each step act as cognitive shorthand: the visitor processes the flow in seconds instead of reading three paragraphs. It also breaks the visual monotony of card-after-card-after-card.

**shadcn approach:** Simple Lucide icon compositions (e.g., `Globe` + `ArrowRight` + flag emoji) or small SVG illustrations embedded directly. Wrap in a `div` with `bg-secondary rounded-lg p-4` for a contained visual block inside each timeline card.

---

## 8. FAQ — Replace flat cards with an accordion

**What:** Replace the 6 static FAQ cards (always visible Q+A) with a proper accordion where only questions are visible and answers expand on click.

**Narrative:** Showing all 6 answers at once creates a wall of text that most visitors will scroll past. An accordion creates curiosity gaps — the visitor sees a question relevant to them, clicks it, and feels rewarded with a focused answer. It also dramatically reduces the visual weight of this section, making the page feel shorter and more digestible.

**shadcn approach:** Use shadcn `Accordion` (install: `npx shadcn@latest add accordion`). The `AccordionItem` + `AccordionTrigger` + `AccordionContent` structure maps directly to the current `questionKey`/`answerKey` data. Use `type="multiple"` to allow several open at once.

---

## 9. CTA section — Add urgency and social proof

**What:** Enhance the final CTA with: (a) a small live counter ("12 previews generated today" or "Join 50+ teams already testing"), and (b) a row of small avatar circles (even placeholder ones) to suggest community.

**Narrative:** The current CTA is clean but cold. Social proof at the moment of decision reduces the perceived risk of clicking. The counter creates gentle urgency ("others are doing this right now"). Together they transform "Generate preview" from a lonely experiment into joining a movement.

**shadcn approach:** Use shadcn `Avatar` (install: `npx shadcn@latest add avatar`) for the avatar stack with overlapping `-ml-2` positioning. The counter can use `InViewCountUp` with a static target.

---

## 10. Global — Add section entrance animations

**What:** Add subtle scroll-triggered fade-up animations to each section heading and content block, similar to the existing `segment-fade-up` keyframe but applied page-wide via IntersectionObserver.

**Narrative:** Currently only the stat cards animate in. Everything else is static on page load. Scroll-triggered entrances create a sense of the page "unfolding" for the visitor, which keeps engagement high and signals craftsmanship. Without them, the page below the fold feels like a static document rather than an interactive experience.

**shadcn approach:** No extra component needed. Create a reusable `<InViewFadeUp>` wrapper component using the existing `usePrefersReducedMotion` hook + IntersectionObserver pattern already in the codebase. Apply the existing `segment-fade-up` keyframe via a CSS class toggled on intersection.

---

## 11. Global — Break visual monotony with alternating layouts

**What:** Instead of every section being centered text + card grid, alternate the layout rhythm:

- Pain section: already has left-text/right-cards (good)
- Use cases: shift to a staggered layout — one featured card large on the left, two smaller cards stacked on the right
- CTA: add a subtle diagonal or wave SVG separator above it

**Narrative:** When every section uses the same layout template, the brain habituates and starts skimming. Varying the spatial rhythm forces re-engagement at each section boundary. The visitor processes each section as a new "scene" in the narrative rather than scrolling through a uniform feed.

**shadcn approach:** Pure Tailwind layout changes: `lg:grid-cols-[1.2fr_0.8fr]` for the featured use-case card, `grid-rows-2` for the stacked pair. The wave separator is a simple inline SVG with `fill-secondary/50` placed between sections.

---

## 12. Header — Add a mobile menu

**What:** The navigation links are hidden on mobile (`hidden md:flex`) with no hamburger menu fallback. Add a mobile slide-out or dropdown menu.

**Narrative:** On mobile, the only navigation options are the "Try" CTA button and the logo. Visitors who want to explore pricing, docs, or the blog have no way to reach them. This is a basic UX gap that hurts discoverability and could lose visitors who aren't ready to try but want to learn more.

**shadcn approach:** Use shadcn `Sheet` (install: `npx shadcn@latest add sheet`) for a slide-out mobile menu triggered by a `Menu` Lucide icon. The `SheetContent` renders the same `navLinks` array vertically.

---

## Priority ranking

| #   | Suggestion                       | Impact | Effort |
| --- | -------------------------------- | ------ | ------ |
| 8   | FAQ accordion                    | High   | Low    |
| 12  | Mobile menu                      | High   | Low    |
| 2   | Rotating word highlight          | Medium | Low    |
| 10  | Section entrance animations      | Medium | Low    |
| 3   | Trust bar (compact stats)        | Medium | Low    |
| 5   | Before/after pain comparison     | High   | Medium |
| 11  | Alternating layouts              | Medium | Medium |
| 4   | Animated progress bars for stats | Medium | Medium |
| 1   | Hero before/after preview        | High   | Medium |
| 9   | CTA social proof + urgency       | Medium | Medium |
| 7   | How-it-works visual artefacts    | Medium | Medium |
| 6   | Use case hover/expand detail     | Medium | Medium |

---

## shadcn components to install

```bash
npx shadcn@latest add accordion tabs progress hover-card collapsible avatar sheet separator
```

All suggestions above are compatible with the existing `new-york` shadcn style, the Tailwind theme tokens, and the CSS-only animation approach already used in the codebase.
