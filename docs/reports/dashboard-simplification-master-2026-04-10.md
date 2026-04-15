# Dashboard Simplification Master Report

Date: 2026-04-10

Scope:

- Customer dashboard, agency surfaces, and internal-ops dashboard in the website repo.
- Live browser exercise for customer flows in mock-auth mode.
- Code-level verification for agency and internal-ops routes, auth, entitlements, and site settings.

## What I validated

- Dashboard shell and navigation:
  - [app/dashboard/layout.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/layout.tsx)
  - [app/dashboard/\_components/sites-nav.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/_components/sites-nav.tsx)
  - [app/dashboard/\_components/dashboard-nav.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/_components/dashboard-nav.tsx)
- Customer surfaces:
  - [app/dashboard/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/page.tsx)
  - [app/dashboard/sites/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/page.tsx)
  - [app/dashboard/sites/[id]/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/page.tsx)
  - [app/dashboard/sites/[id]/pages/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/pages/page.tsx)
  - [app/dashboard/sites/[id]/admin/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/admin/page.tsx)
  - [app/dashboard/sites/[id]/overrides/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/overrides/page.tsx)
  - [app/dashboard/sites/[id]/consistency/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/consistency/page.tsx)
  - [app/dashboard/sites/new/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/new/page.tsx)
  - [app/dashboard/no-account/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/no-account/page.tsx)
- Agency and internal ops:
  - [app/dashboard/agency/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/agency/page.tsx)
  - [app/dashboard/agency/customers/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/agency/customers/page.tsx)
  - [app/dashboard/ops/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/page.tsx)
  - [app/dashboard/ops/accounts/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/accounts/page.tsx)
  - [app/dashboard/ops/previews/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/previews/page.tsx)
  - [app/dashboard/ops/showcases/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/showcases/page.tsx)
- Contracts and gating:
  - [internal/dashboard/auth.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/auth.ts)
  - [internal/dashboard/entitlements.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/entitlements.ts)
  - [internal/dashboard/site-settings.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/site-settings.ts)
  - [internal/dashboard/webhooks.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/webhooks.ts)
  - [app/dashboard/\_lib/workspace-actions.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/_lib/workspace-actions.ts)

I also exercised the customer dashboard in live mock-auth mode. That covered the home, sites list, site workspace, pages, settings, overrides, consistency, developer tools, and no-account flows.

## Executive Summary

The dashboard does not have one simplification problem. It has two:

1. The customer surface is over-fragmented.
2. The role and contract boundaries are real, but they are expressed as many local branching decisions instead of a coherent model.

So the right fix is not to merge everything into one giant dashboard. The right fix is to:

- collapse duplicate customer entry points,
- keep role separation explicit,
- preserve distinct operational states,
- move advanced/internal tools away from the default path,
- make the IA task-oriented instead of contract-shaped.

## Ranked Simplification Backlog

1. Make the customer site hub canonical.
   - Keep one main `Site` workspace.
   - Demote the current peer routes into sections or anchors inside that hub.
   - Preserve pages/crawl as an operational subsection, not a separate top-level mental model.

2. Remove repeated site status controls.
   - Keep one authoritative `Activate/Pause site` control.
   - Use the site header as the canonical location.
   - Let admin/settings link there instead of rehosting the same toggle.

3. Merge translation governance into one surface.
   - Combine glossary, manual overrides, localized slugs, and consistency into one `Translation rules` area.
   - Keep locale scope visible and sticky.

4. Collapse `Overview` and `Sites`.
   - They are both inventory + onboarding entry points.
   - Keep one landing experience and make the other a redirect or secondary alias.

5. Collapse agency overview and customer directory.
   - Agency users should get one agency hub with workspace switching and customer inventory.
   - Do not keep two surfaces that answer the same question.

6. Collapse internal ops accounts, showcases, and previews into one ops hub.
   - Keep detail pages.
   - Stop making the landing experience feel like three separate products.

7. Rework no-account and new-site into one onboarding funnel.
   - Claim access, then create the first site, then upgrade if needed.
   - Do not force the user to mentally switch products between those steps.

8. Keep developer tools as support/debug only.
   - Do not let it become a primary destination in the default dashboard IA.

## Proposed Canonical IA

### Customer

- `Dashboard`
  - site inventory
  - add site
  - onboarding / billing fallback
- `Site`
  - site summary
  - domain verification / provisioning
  - localization activation
  - translate-and-serve actions
  - automation and notifications
  - pages / crawl subsection
- `Site Settings`
  - source URL
  - locale management
  - routing
  - serving mode
  - crawl capture mode
  - client runtime / SPA refresh
  - translatable attributes
  - profile metadata
- `Translation Rules`
  - glossary
  - manual overrides
  - localized slugs
  - consistency governance

### Agency

- `Agency Hub`
  - customer inventory
  - plan / status summary
  - workspace switching
- `Customer Workspace`
  - the same customer IA as normal users after switching

### Internal Ops

- `Ops Hub`
  - managed accounts
  - showcases
  - previews
- Detail pages:
  - account policy
  - preview detail
  - showcase detail

## Why the Current UI Feels Overloaded

### Customer path

- Site discovery exists in both the dashboard home and the sites list.
- Site identity appears in the shell, site header, site detail card, and settings.
- Domain readiness, serving readiness, and crawl readiness are shown in multiple places with different labels.
- The current site nav still mirrors implementation buckets instead of user tasks.

## Locked-State UX

The gating model is precise, but it is too local and too verbose.

Examples of current user-visible gates:

- No-account / claim flow: `No dashboard account linked yet`, `Create free dashboard access`, `View pricing page`
- Site creation gate: `Billing action required`, `Site limit reached`, `Site creation is locked`, `Update billing`, `Upgrade plan`
- Site activation: `Pause localization`, `Enable localization`
- Site settings locks: `Billing action required`, `Some settings are locked`, `This setting is locked for your account. Contact support to enable editing.`
- Section-level locks: `Source URL and routing are locked for this account.`, `Locale updates are locked for this account.`, `Serving mode updates are locked for this account.`, `Crawl capture mode is locked for this account.`, `Client runtime settings are locked for this account.`, `Client navigation settings are locked for this account.`, `Attribute translation settings are locked for this account.`, `Site profile updates are locked for this account.`
- Translation rule gates: `Glossary`, `Manual overrides`, `Localized slugs`, `Locked`, `Billing issue`
- Consistency gate: `Consistency governance`, `Upgrade to edit canonical phrases and block policies.`
- Domain / serving gate: `Update billing to resume domain verification and serving.`, `Upgrade to manage domain verification and serving.`

What the user should see instead:

- One page-level explanation of whether the page is editable or locked.
- One reason, not three.
- One unlock action.
- Section-level capability detail only inside advanced areas.

The copy should be task-first:

- `Edit site settings`
- `Manage translation rules`
- `Verify domains`
- `Operate translations`

Capability names such as `client_runtime_toggle` or `crawl_capture_mode` should remain implementation details.

### Agency path

- Workspace switching is duplicated in the sidebar and inline per-row forms.
- Agency overview and customer directory both summarize the same customers.
- The user is forced to infer whether they are acting as the agency or inside a customer workspace.

### Internal ops path

- Ops pages are individually coherent, but the landing experience is split into separate inventories.
- This makes the internal plane feel more like a collection of utilities than one admin system.

## What Duplication Is Actually Necessary

Do not flatten these away:

- `actorAccount` vs `subjectAccount`
- site status vs domain status vs deployment serving status vs translation-run status vs showcase status vs plan status
- billing lock vs feature lock
- customer site policy vs internal account policy
- agency plan assignment vs internal ops policy editing
- customer dashboard vs no-account portal state

These are real contracts, not UI accidents.

## Safe Versus Unsafe Simplifications

### Safe

- Collapse `Overview` + `Sites`.
- Make one canonical customer `Site` hub.
- Merge translation governance into one area.
- Merge agency landing pages into one hub.
- Merge ops inventories into one hub.
- Treat no-account and new-site as sequential onboarding.
- Use task-grouped screens for the customer IA.
- Keep capability grouping for backend policy, developer tools, and internal ops only.

### Unsafe

- Hide actor vs subject context.
- Merge internal ops into customer settings.
- Flatten site settings into one giant form without capability buckets.
- Collapse all statuses into one generic badge.
- Merge billing, feature, and workspace gating into one lock state.
- Group customer navigation by backend capability names instead of user tasks.

## Role-by-Role Guidance

### Normal customer

The customer should have one obvious route:

`Dashboard -> Site -> Settings / Rules / Pages`

The current problem is not missing features. It is too many ways to reach the same feature.
The better grouping is `Overview`, `Site`, `Site Settings`, `Translation Rules`, and `Pages` as a subsection.

### Agency

Agency users need one workspace switcher and one customer-management hub.

They should not need multiple inline workspace jumps when a single, obvious switcher already exists in the shell.

### Internal ops

Internal ops should remain detached from customer administration.

It answers a different question, uses different auth, and has different mutation rights.

## Suggested Copy / Naming Changes

- `Overview` and `Sites` should not both read as primary homes.
- Use one term for site activation: `Activate site` / `Pause site`.
- Use `Translation rules` instead of a mix of glossary / overrides / consistency / slug-specific route names.
- Use `Customer workspace` and `Agency hub` explicitly so users know what context they are in.
- Keep `Site settings` for durable configuration and `Site` for live operational state.
- Prefer `Translation rules` over `Glossary`, `Overrides`, and `Consistency` as separate primary destinations.

## External Reference Used

I also cross-checked a task-oriented IA example from Nielsen Norman Group, which reinforces the idea that a role-rich product should organize around user tasks and keep navigation consistent across levels rather than mirroring internal organization.

- [Intranet Design Annual 2009 PDF](https://media.nngroup.com/media/reports/free/Intranet_Design_Annual_2009.pdf)

## Final Recommendation

The best simplification is not fewer permissions. It is fewer canonical screens.

If I had to reduce the customer dashboard to the smallest workable set, I would keep:

1. `Dashboard`
2. `Site`
3. `Site Settings`
4. `Translation Rules`

Then I would make `Pages / Crawl` a subsection of `Site`, not a separate top-level destination.

Agency and internal ops should get their own hubs, but those hubs should be flat and task-oriented, not collections of near-duplicate inventory screens.

## Validation Notes

- Customer flows were exercised live in mock-auth mode.
- Agency and internal-ops behavior was verified from route guards and auth contracts because the mock path only exposes the starter customer account.
- The sharpest overload point remains the site admin form, which combines multiple capability buckets into one long page.
