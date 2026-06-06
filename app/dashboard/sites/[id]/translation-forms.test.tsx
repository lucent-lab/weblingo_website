// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GlossaryEditor } from "./glossary-editor";
import { OverrideForm, SlugForm } from "./translation-forms";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("../../actions", () => ({
  createOverrideAction: vi.fn(),
  updateGlossaryAction: vi.fn(),
  updateSlugAction: vi.fn(),
}));

vi.mock("@internal/dashboard/use-action-toast", () => ({
  useActionToast:
    ({ formAction }: { formAction: (payload: FormData) => void }) =>
    (payload: FormData) =>
      formAction(payload),
}));

describe("dashboard example forms", () => {
  afterEach(() => {
    cleanup();
  });

  it("render readonly example controls without mutation form surfaces", () => {
    const { container } = render(
      <>
        <GlossaryEditor
          mode="example"
          initialEntries={[]}
          siteId="site-demo"
          targetLangs={["fr"]}
        />
        <OverrideForm mode="example" siteId="site-demo" targetLangs={["fr"]} />
        <SlugForm mode="example" siteId="site-demo" targetLangs={["fr"]} />
      </>,
    );

    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('input[type="hidden"]')).toBeNull();
    expect(container.querySelector('button[type="submit"]')).toBeNull();

    const controls = Array.from(container.querySelectorAll("input, select, textarea"));
    expect(controls.length).toBeGreaterThan(0);
    expect(controls.every((control) => control.hasAttribute("disabled"))).toBe(true);

    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((button) => button.hasAttribute("disabled"))).toBe(true);
  });
});
