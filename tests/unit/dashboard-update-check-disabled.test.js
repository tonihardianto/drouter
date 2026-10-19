import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const versionRoute = readFileSync(
  fileURLToPath(new URL("../../src/app/api/version/route.js", import.meta.url)),
  "utf8"
);
const sidebar = readFileSync(
  fileURLToPath(new URL("../../src/shared/components/Sidebar.js", import.meta.url)),
  "utf8"
);

describe("dashboard update check", () => {
  it("does not contact the npm registry or report an update", () => {
    expect(versionRoute).not.toContain("registry.npmjs.org");
    expect(versionRoute).toContain("hasUpdate: false");
  });

  it("does not request or render update information", () => {
    expect(sidebar).not.toContain('fetch("/api/version")');
    expect(sidebar).not.toContain("New version available");
  });
});
