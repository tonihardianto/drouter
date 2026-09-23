import { describe, expect, it } from "vitest";
import {
  extractApiKey,
  isModelAllowed,
} from "../../src/lib/auth/apiKeyAccess.js";

describe("per API key model allowlist", () => {
  it("extracts credentials consistently from every supported API key location", () => {
    const requests = [
      new Request("http://localhost/v1/models", { headers: { Authorization: "Bearer bearer-key" } }),
      new Request("http://localhost/v1/models", { headers: { "x-api-key": "x-api-key" } }),
      new Request("http://localhost/v1/models", { headers: { "x-goog-api-key": "google-key" } }),
      new Request("http://localhost/v1/models?key=query-key"),
    ];

    expect(requests.map(extractApiKey)).toEqual(["bearer-key", "x-api-key", "google-key", "query-key"]);
  });

  it("keeps null unrestricted, denies an empty allowlist, and expands selected combos to leaves", () => {
    expect(isModelAllowed({ allowedModels: null }, "openai/gpt-4.1")).toBe(true);
    expect(isModelAllowed({ allowedModels: [] }, "openai/gpt-4.1")).toBe(false);
    expect(isModelAllowed({ allowedModels: ["fast"] }, "openai/gpt-4.1", { fast: ["openai/gpt-4.1"] })).toBe(true);
    expect(isModelAllowed({ allowedModels: ["fast"] }, "openai/gpt-4.1")).toBe(false);
    expect(isModelAllowed({ allowedModels: ["openai/gpt-4.1"] }, "fast", { fast: ["openai/gpt-4.1"] })).toBe(false);
  });
});
