import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

let tempDir;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-key-access-"));
  process.env.DATA_DIR = tempDir;
  delete global._dbAdapter;
  vi.resetModules();
});

afterEach(() => {
  try { global._dbAdapter?.instance?.close?.(); } catch {}
  delete global._dbAdapter;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("per API key model access", () => {
  it("persists an explicit access allow list", async () => {
    const { createApiKey, getApiKeyByKey } = await import("@/lib/db/repos/apiKeysRepo.js");
    const key = await createApiKey("test", "machine", {
      access: { restricted: true, allow: ["fast", "openai/gpt-4.1"] },
    });

    const stored = await getApiKeyByKey(key.key);
    expect(stored.access).toEqual({ restricted: true, allow: ["fast", "openai/gpt-4.1"] });
  });

  it("keeps a key unrestricted by default", async () => {
    const { createApiKey, getApiKeyByKey } = await import("@/lib/db/repos/apiKeysRepo.js");
    const key = await createApiKey("test", "machine");

    const stored = await getApiKeyByKey(key.key);
    expect(stored.access).toEqual({ restricted: false, allow: [] });
  });

  it("maps a legacy allowedModels list onto the access columns", async () => {
    const { createApiKey, getApiKeyByKey } = await import("@/lib/db/repos/apiKeysRepo.js");
    const key = await createApiKey("test", "machine", { allowedModels: ["fast"] });

    const stored = await getApiKeyByKey(key.key);
    expect(stored.access).toEqual({ restricted: true, allow: ["fast"] });
  });
});
