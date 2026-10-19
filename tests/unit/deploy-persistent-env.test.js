import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const deployScript = readFileSync(
  fileURLToPath(new URL("../../deploy.sh", import.meta.url)),
  "utf8"
);

describe("standalone VPS deployment", () => {
  it("keeps the production env outside the replaced app directory", () => {
    expect(deployScript).toContain('VPS_ENV_FILE="/home/toni/drouter/.env"');
    expect(deployScript).toContain("--env-file='$VPS_ENV_FILE'");
    expect(deployScript).not.toContain("[ -f '$VPS_APP_DIR/.env' ]");
  });
});
