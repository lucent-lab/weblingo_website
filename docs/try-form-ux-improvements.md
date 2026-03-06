# Try Form — UX Analysis & Improvement Suggestions

> Generated 2026-02-27 · Covers `components/try-form.tsx`, `components/language-tag-combobox.tsx`, `components/preview-status-center.tsx`

---

## What works well

| Aspect                       | Detail                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Progressive disclosure**   | Language selectors only appear after URL entry, reducing initial cognitive load                                                      |
| **SSE real-time updates**    | `EventSource` streams preview progress with heartbeat timeout detection and manual status-check fallback — robust two-layer approach |
| **Session persistence**      | `localStorage`-backed `PreviewStatusCenterStore` lets users navigate away and still see job status on return                         |
| **Error resolution helpers** | `resolveUserFriendlyError` maps raw API codes to actionable copy with `t()` keys                                                     |
| **Same-language guard**      | Client-side validation prevents wasting a preview when source === target                                                             |
| **Accessible combobox**      | `LanguageTagCombobox` supports keyboard navigation, ARIA attributes, and focus-on-open via `requestAnimationFrame`                   |

---

## What's problematic

### 1. Field ordering is backwards

The form presents **URL → Email → Source language → Target language**. Users think "I want to translate _this site_ from _X_ to _Y_" — the mental model is URL → languages → action. Email appearing between URL and languages interrupts the task flow.

### 2. Email field feels secondary but is required

Email is gated behind `showEmailField` and rendered with secondary styling, yet it blocks submission. This creates a mismatch between visual weight and actual importance.

### 3. No progress indicator during processing

Once the preview starts, `showEditableControls` becomes `false` and the entire form disappears, replaced only by a status label. There's no progress bar, step indicator, or percentage — just text swaps between "creating…", "crawling…", "translating…", "rendering…".

### 4. Underwhelming "ready" state

When the preview succeeds, the user gets a text label and an "Open preview" button with no visual celebration. For a first-time user, this is the money moment — it should feel rewarding.

### 5. Form disappears during processing

`showEditableControls` hides URL/email/languages while the preview runs. If a user wants to double-check what they submitted, they can't. This also makes the card feel empty.

### 6. Confusing timeout branches

The SSE layer has a 45 s heartbeat timeout that triggers a manual status check, which itself can timeout. The distinction between "SSE lost" and "preview actually failed" is invisible to the user — both surface as vague error text.

### 7. Language combobox hydration flash

`LanguageTagCombobox` is dynamically imported with `{ ssr: false }`, causing a layout shift on hydration. The placeholder button snaps into the combobox after JS loads.

### 8. No autofocus on primary input

The URL field doesn't autofocus when the form mounts, requiring an extra click to start.

### 9. Weak "copied URL" feedback

After the preview URL is generated, copying it shows only a brief icon swap. No toast, no "Copied!" text — easy to miss.

---

## Suggestions

### A. Reorder fields to match mental model

**URL → Source language → Target language → Email → Submit**

This follows the user's natural thought process. Email moves to the end as the final "gate" before submission.

**Priority:** High · **Effort:** Low (reorder JSX + adjust progressive disclosure logic)

### B. Inline email with contextual justification

Replace the floating email input with an inline field that includes micro-copy: _"We'll email you when your preview is ready"_. This explains _why_ email is needed at the moment it's requested.

**Priority:** High · **Effort:** Low

### C. Add a step progress indicator

Replace the bare status text with a horizontal stepper or segmented progress bar showing the pipeline stages: **Creating → Crawling → Translating → Rendering → Ready**. Map SSE `status` values to steps.

```
[ Creating ]──[ Crawling ]──[ Translating ]──[ Rendering ]──[ ✓ Ready ]
                  ●━━━━━━━━━━○
```

**Priority:** High · **Effort:** Medium (new `PreviewProgressStepper` component, map SSE events to step index)

### D. Keep submitted values visible during processing

Instead of hiding the form, collapse it into a read-only summary row: `example.com · en → fr · user@email.com`. This reassures users and saves vertical space without hiding context.

**Priority:** Medium · **Effort:** Low

### E. Celebrate the "ready" state

When status hits `ready`:

- Confetti burst or subtle check-mark animation (use `canvas-confetti` or CSS keyframes)
- Primary-colored card border pulse
- Larger, more prominent "Open preview" CTA

This makes the first successful preview feel like an achievement and encourages sharing.

**Priority:** Medium · **Effort:** Low–Medium

### F. Skeleton placeholder for language comboboxes

Add a `min-h` + `animate-pulse` skeleton that matches the combobox dimensions, shown until the dynamic import resolves. This eliminates layout shift.

**Priority:** Low · **Effort:** Low

### G. Autofocus URL input

Add `autoFocus` to the URL `<Input>` (or use a `ref` + `useEffect` for conditional autofocus when the form section is in viewport via `IntersectionObserver`).

**Priority:** Low · **Effort:** Trivial

### H. Toast feedback for copy action

Use `sonner` (already a shadcn dependency) to show a brief toast: _"Preview URL copied!"_. More discoverable than an icon swap.

**Priority:** Low · **Effort:** Trivial

---

## Priority matrix

| Priority     | Suggestions                                                       |
| ------------ | ----------------------------------------------------------------- |
| **Do first** | A (reorder fields), B (email justification), C (progress stepper) |
| **Do next**  | D (read-only summary), E (celebrate ready)                        |
| **Polish**   | F (skeleton), G (autofocus), H (copy toast)                       |

---

## Field count analysis: are there too many fields?

### Current fields (4)

| #   | Field           | Required                    | Visible by default |
| --- | --------------- | --------------------------- | ------------------ |
| 1   | Website URL     | Yes                         | Yes                |
| 2   | Email           | Yes (when `showEmailField`) | After URL entry    |
| 3   | Source language | Yes                         | After URL entry    |
| 4   | Target language | Yes                         | After URL entry    |

### Verdict: 4 fields is acceptable — but just barely

**Why it's fine:**

1. **All four are genuinely necessary.** URL identifies the site, source/target define the translation pair, and email is the only way to deliver the result for longer previews. There's no field that could be removed without losing essential functionality.

2. **Progressive disclosure mitigates perceived complexity.** On first render the user only sees 1 field (URL) + 1 button. The remaining 3 fields appear after URL entry. Perceived field count at decision time is 1, not 4.

3. **Industry benchmarks support this count.** The "3-field rule" for lead-gen forms targets email-only signups. Tool/demo forms that require configuration (Vercel's deploy form, Netlify's site import, Figma's share dialog) routinely use 3–5 fields without conversion issues because each field is clearly purposeful.

4. **The fields map 1:1 to the user's mental model.** "Translate _this URL_ from _X_ to _Y_, notify me at _email_" — no field feels arbitrary.

**Where to be cautious:**

1. **Email is the weakest link.** It's the only field that serves the _system's_ need (async notification) rather than the _user's_ task definition. If previews ever become fast enough to return synchronously (< 15 s), email should become optional or deferred to a "notify me later" flow.

2. **Source language could be auto-detected.** Running a lightweight `Accept-Language` or HTML `lang` detection on the submitted URL could pre-fill source language, effectively reducing perceived fields to 3. This is the single highest-impact field reduction.

3. **Don't add a 5th field.** Any future additions (project name, custom glossary, output format) should live on a second screen or in an "Advanced" collapsible — not inline. Crossing the 4-field threshold for a top-of-funnel demo form will measurably hurt conversion.

### Recommendation

Keep 4 fields but apply suggestions A + B above (reorder to match mental model, justify email inline). Consider auto-detecting source language as a future optimisation to bring perceived field count to 3.
