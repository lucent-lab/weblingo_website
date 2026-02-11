import { describe, expect, test } from "vitest";

import { readJsonBodyLimited, RequestBodyInvalidJsonError, RequestBodyTooLargeError } from "./body";

describe("readJsonBodyLimited", () => {
  test("parses JSON under the byte limit", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ hello: "world" }),
    });

    await expect(readJsonBodyLimited(request, { maxBytes: 1024 })).resolves.toEqual({
      hello: "world",
    });
  });

  test("rejects invalid JSON", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: "{not valid json}",
    });

    await expect(readJsonBodyLimited(request, { maxBytes: 1024 })).rejects.toBeInstanceOf(
      RequestBodyInvalidJsonError,
    );
  });

  test("rejects when content-length exceeds the limit", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-length": "200",
      },
      body: JSON.stringify({ ok: true }),
    });

    await expect(readJsonBodyLimited(request, { maxBytes: 10 })).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  test("rejects when streamed body exceeds the limit", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ big: "x".repeat(200) }),
    });

    await expect(readJsonBodyLimited(request, { maxBytes: 20 })).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });
});
