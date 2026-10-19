import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cliSource = readFileSync(
  fileURLToPath(new URL("../../cli/cli.js", import.meta.url)),
  "utf8"
);

describe("CLI update check", () => {
  it("does not contact the npm registry when starting", () => {
    expect(cliSource).not.toContain("registry.npmjs.org");
    expect(cliSource).toContain("const updatePromise = Promise.resolve(null);");
  });
});
