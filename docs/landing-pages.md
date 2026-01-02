# Landing Pages: How To Add New Segments

This marketing site supports segment-specific landing pages under `/{locale}/landing/{segment}`.
They reuse a shared layout and only swap copy + iconography.

## Current segments

- `expansion` → `/en/landing/expansion` (noindex for now)

## Add a new landing segment

1. Add copy to the i18n message files:
   - `internal/i18n/messages/en.json`
   - `internal/i18n/messages/fr.json`
   - `internal/i18n/messages/ja.json`

   Use the same key prefix (example: `landing.tourism.*`) and keep wording consistent with static-site support.
   Avoid claims about dynamic flows (checkout, carts, dashboards).

2. Register the segment in `modules/landing/content.ts`:
   - Add the segment slug to `landingSegments`.
   - Add a new entry in `landingContent` with the i18n keys and icons.

3. Preview locally:
   - Run `pnpm dev`
   - Visit `http://localhost:3000/en/landing/<segment>`

4. Indexing (when ready):
   - Remove or conditionally disable the `robots: { index: false, follow: false }`
     block in `app/[locale]/landing/[segment]/page.tsx`.
   - Add the route to `app/sitemap.ts` so it appears in the sitemap.

## Structure reference

The landing page is defined in `app/[locale]/landing/[segment]/page.tsx` and renders:

- Hero: pain-first headline + embedded Try form
- Proof stats: 3 compact metrics
- Pain section: problems + cost of inaction
- Use cases: 3 cards by niche
- How it works: 3 steps
- CTA: try + contact

## Tips

- Keep the hero copy focused on cost of inaction and outcomes.
- Keep metrics aspirational but defensible; replace placeholders once real numbers exist.
- Prioritize one strong niche story per landing page (tourism, SaaS, ecommerce, etc.).
