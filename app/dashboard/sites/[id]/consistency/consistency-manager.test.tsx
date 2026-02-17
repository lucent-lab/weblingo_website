// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/dashboard/actions", () => ({
  upsertConsistencyCpmEntryAction: vi.fn(),
  updateConsistencyBlockAction: vi.fn(),
}));

vi.mock("@/components/dashboard/action-form", () => ({
  ActionForm: ({ children }: { children: ReactNode }) => <form>{children}</form>,
}));

import { ConsistencyManager } from "./consistency-manager";

describe("ConsistencyManager", () => {
  it("renders canonical phrases, blocks, and override warnings", () => {
    render(
      <ConsistencyManager
        siteId="site-1"
        sourceLang="en"
        targetLang="fr"
        canMutate={true}
        cpmEntries={[
          {
            id: "cpm-1",
            contentId: "cid-contact",
            sourceLang: "en",
            targetLang: "fr",
            targetText: "Contactez-nous",
            scope: "site",
            status: "approved",
            occurrencesCount: 4,
            lastUsedAt: null,
            createdAt: null,
            updatedAt: null,
          },
        ]}
        blocks={[
          {
            id: "block-nav",
            blockType: "nav",
            blockSignature: "nav-signature",
            familySignature: null,
            mode: "strict",
            status: "approved",
            occurrencesCount: 8,
            firstSeenAt: null,
            lastSeenAt: null,
            members: [
              { id: "member-1", contentId: "cid-home", position: 0 },
              { id: "member-2", contentId: "cid-pricing", position: 1 },
            ],
          },
        ]}
        overrideWarnings={[
          {
            segmentId: "seg-1",
            contentId: "cid-contact",
            sourceText: "Contact us",
            overrideText: "Parlez-nous",
            canonicalTargetText: "Contactez-nous",
            canonicalStatus: "approved",
            canonicalScope: "site",
            contextHashScope: "ctx-a",
            reason: "context_override_global_exact_conflict",
          },
        ]}
      />,
    );

    expect(screen.getByText("Canonical phrases")).toBeTruthy();
    expect(screen.getByDisplayValue("Contactez-nous")).toBeTruthy();
    expect(screen.getByText("Consistency blocks")).toBeTruthy();
    expect(screen.getByDisplayValue("cid-home, cid-pricing")).toBeTruthy();
    expect(screen.getByText("Override hygiene warnings")).toBeTruthy();
    expect(screen.getByText("Parlez-nous")).toBeTruthy();
  });

  it("renders empty states when no consistency data exists", () => {
    render(
      <ConsistencyManager
        siteId="site-1"
        sourceLang="en"
        targetLang="fr"
        canMutate={false}
        cpmEntries={[]}
        blocks={[]}
        overrideWarnings={[]}
      />,
    );

    expect(screen.getByText("No canonical phrase entries found.")).toBeTruthy();
    expect(screen.getByText("No blocks detected yet.")).toBeTruthy();
    expect(screen.getByText("No active override conflicts.")).toBeTruthy();
  });
});
