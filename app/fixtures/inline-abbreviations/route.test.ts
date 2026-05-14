import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("inline abbreviation fixture", () => {
  it("serves nested abbreviation scenarios for translation preview testing", async () => {
    const response = await GET();
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-weblingo-inline-abbreviation-fixture")).toBe("1");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(html).toContain('data-fixture="inline-abbreviations"');
    expect(html).toContain('<abbr title="General availability">GA</abbr>');
    expect(html).toContain('<abbr title="Production readiness">Productization</abbr>');
    expect(html).toContain("<strong>AI</strong>-assisted");
    expect(html).toContain('<abbr title="Mean time to recovery">MTTR</abbr>');
    expect(html).toContain(
      '<code><abbr title="Lifetime value">LTV</abbr> / <abbr title="Customer acquisition cost">CAC</abbr> &gt; 3</code>',
    );
    expect(html).toContain("<strong>CO<sub>2</sub>-equivalent</strong>");
    expect(html).toContain('aria-label="Open CLI-style command palette for UAT"');
  });
});
