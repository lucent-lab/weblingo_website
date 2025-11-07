# WebMirror Pricing Spec (for Implementation)

Author: product
Purpose: Single source of truth for `/pricing` page content. Shopify-style: simple plan cards + expandable "Compare all plan features".
Audience: Frontend implementation (LLM/Codex).

---

## ✅ Plans (No Quotas, Per Website)

> Hosting of translated pages on **330+ Cloudflare CDN locations**. No traffic quotas or hidden limits. Cancel anytime.

### Plan Cards (Top Section)

- **Starter — ¥4,800 / month / website**
  - 1 website, **1 language included**
  - Automatic translation & deployment (CNAME)
  - Weekly auto-crawl & update
  - Basic SEO (canonical, hreflang, translated sitemap)
  - Email support (≤72h)
  - _Add more languages anytime: +¥1,500 / language_

- **Pro — ¥8,800 / month / website**
  - 1 website, **up to 3 languages included**
  - Edit/lock translations + glossary (brand term dictionary)
  - Advanced SEO (custom meta/canonical, exclude paths, index toggle)
  - Daily auto-crawl & update
  - Priority support (24–48h)
  - _Add more languages: +¥1,500 / language_

- **Resellers & Agencies — ¥24,800 / month base**
  - Includes **10 client websites** (mix of Starter or Pro sites)
  - Manage many sites from one dashboard
  - White-label dashboard (logo, colors, subdomain)
  - Team & client management
  - Concierge support (same day)
  - **Add sites anytime**:
    - Starter-type site: **¥4,800** / month / website
    - Pro-type site: **¥8,800** / month / website
  - _Each client site inherits its own plan rules (Starter or Pro)._

### Add-ons (Global)

- **Additional language** — +¥1,500 / month / language (any plan)
- **Dedicated support (Slack/Chat)** — +¥5,000 / month (Pro & Agency)

> Note: **No “add domain” shortcut**. Each **website** = its own plan (prevents underpricing new sites).
> Optional: allow **domain aliases** _only_ when pointing to the _same_ site (same content), if needed later.

---

## 🧾 Shopify-Style "Compare All Plan Features" (Expandable)

Render as a collapsible/expandable section below plan cards.

| Feature                                          |   Starter    |     Pro      |                        Resellers & Agencies                        |
| ------------------------------------------------ | :----------: | :----------: | :----------------------------------------------------------------: |
| **Hosting of translated pages**                  |      ✅      |      ✅      |                                 ✅                                 |
| **CDN distribution (Cloudflare 330+ locations)** |      ✅      |      ✅      |                                 ✅                                 |
| **Automatic translation & deployment (CNAME)**   |      ✅      |      ✅      |                                 ✅                                 |
| **Translation editor (manual overrides)**        |      –       |      ✅      |                     Based on client site plan                      |
| **Glossary / locked terms**                      |      –       |      ✅      |                     Based on client site plan                      |
| **SEO tools**                                    |    Basic     |   Advanced   |                     Based on client site plan                      |
| **Crawl / update frequency**                     |    Weekly    |    Daily     |                     Based on client site plan                      |
| **Team access**                                  |      –       |      –       |                                 ✅                                 |
| **White-label dashboard**                        |      –       |      –       |                                 ✅                                 |
| **Manage multiple client websites**              |      –       |      –       |                      ✅ (10 included in base)                      |
| **Concierge support**                            |      –       |      –       |                           ✅ (same-day)                            |
| **Add languages**                                | +¥1,500 each | +¥1,500 each |                            +¥1,500 each                            |
| **Per-website pricing**                          |    ¥4,800    |    ¥8,800    | Base includes 10 sites; add Starter/Pro sites at respective prices |

**Notes for FE:**

- Use ✅ and – icons for clarity.
- Under table, keep a small FAQ block answering:
  - “Can I add languages later?” → Yes, +¥1,500 per language.
  - “Is traffic limited?” → No, we don’t meter traffic; fair-use applies.
  - “How do agencies add more sites?” → From the dashboard; billed automatically at ¥4,800/¥8,800 per site.

---

## 🧭 Copy Snippets (for marketing blocks)

**Hero subline:** “Your content, everywhere — hosted on 330+ Cloudflare CDN locations.”  
**CTA microcopy:** “Includes hosting of translated pages. No quotas, cancel anytime.”  
**Agency explainer:** “Buy once, manage many. Your dashboard includes 10 client sites — add more anytime.”

---

## 🔐 Stripe Mapping (Reference)

- `starter_site` — ¥4,800 / month / website
- `pro_site` — ¥8,800 / month / website
- `agency_base` — ¥24,800 / month (includes 10 sites)
- `agency_site_starter` — ¥4,800 / month (adjustable quantity)
- `agency_site_pro` — ¥8,800 / month (adjustable quantity)
- `addon_language` — ¥1,500 / month (adjustable quantity)

**Checkout guidance:**

- Direct customers use Pricing Table (Starter/Pro).
- Agencies: custom checkout with line items for `agency_base` + adjustable quantities for site slots, or manage quantities in Customer Portal.
- After checkout, collect **URL + language** per site in your dashboard (store in DB; Stripe does not collect per-quantity metadata).

---

## 📐 UI Guidance

- **Top section:** 3 plan cards, each with 4–5 bullets max; no tables above the fold.
- **Below:** “Compare all plan features ▾” expands to full table.
- **Badges:** Mark **Pro** as “Most popular”.
- **Trust row:** Logos or line “Hosted by Cloudflare Edge (330+ PoPs)” near the fold.
- **FAQ:** Answer add-ons, billing, cancellation, indexing/SEO basics.

---

## ✅ Implementation Checklist (Frontend)

- [ ] Render plan cards with prices & bullets
- [ ] Add “Compare all plan features” expandable table
- [ ] Show Cloudflare hosting line on every plan
- [ ] Remove any “add domain” pricing from UI
- [ ] Keep add-ons minimal in UI; details in FAQ
- [ ] Place CTAs to `/pricing` checkout or embedded Stripe Pricing Table
