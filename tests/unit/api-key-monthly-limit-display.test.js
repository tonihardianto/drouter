import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const endpointClient = readFileSync(
  fileURLToPath(new URL("../../src/app/(dashboard)/dashboard/endpoint/EndpointPageClient.js", import.meta.url)),
  "utf8"
);

describe("API key monthly token limit display", () => {
  it("renders monthly token usage and its configured limit", () => {
    expect(endpointClient).toMatch(/Month:\s*\{key\.tokensUsedMonth \|\| 0\}/);
    expect(endpointClient).toMatch(/key\.monthlyTokenLimit == null \? "Unlimited" : key\.monthlyTokenLimit/);
  });
});
