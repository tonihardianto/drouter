import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

let tempDir;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-api-key-limit-"));
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

async function setupKey(overrides = {}) {
  const { createApiKey, getApiKeyById, reserveApiKeyRequest } = await import("@/lib/db/repos/apiKeysRepo.js");
  const { getAdapter } = await import("@/lib/db/driver.js");
  const key = await createApiKey("test", "machine", overrides);
  return { key: await getApiKeyById(key.id), reserveApiKeyRequest, db: await getAdapter() };
}

describe("per API key rate limits", () => {
  it("resets daily counters when the local date changes", async () => {
    const { key, reserveApiKeyRequest, db } = await setupKey({ dailyRequestLimit: 5, dailyTokenLimit: 1000 });
    db.run(
      `UPDATE apiKeys SET requests_used_today = 4, tokens_used_today = 900, last_daily_reset_at = ?, tokens_used_month = 1200 WHERE id = ?`,
      ["2000-01-01T00:00:00.000Z", key.id]
    );

    const result = await reserveApiKeyRequest(key.key);

    expect(result.allowed).toBe(true);
    expect(result.key.requestsUsedToday).toBe(1);
    expect(result.key.tokensUsedToday).toBe(0);
    expect(result.key.tokensUsedMonth).toBe(1200);
  });

  it("does not reset daily counters before the local date changes", async () => {
    const { key, reserveApiKeyRequest, db } = await setupKey({ dailyRequestLimit: 5 });
    db.run(
      `UPDATE apiKeys SET requests_used_today = 2, last_daily_reset_at = ? WHERE id = ?`,
      [new Date().toISOString(), key.id]
    );

    const result = await reserveApiKeyRequest(key.key);

    expect(result.allowed).toBe(true);
    expect(result.key.requestsUsedToday).toBe(3);
  });

  it("rejects a request when a daily request or token limit is reached", async () => {
    const { key, reserveApiKeyRequest, db } = await setupKey({ dailyRequestLimit: 2, dailyTokenLimit: 100 });
    db.run(
      `UPDATE apiKeys SET requests_used_today = 2, tokens_used_today = 100, last_daily_reset_at = ? WHERE id = ?`,
      [new Date().toISOString(), key.id]
    );

    const requestResult = await reserveApiKeyRequest(key.key);

    expect(requestResult.allowed).toBe(false);
    expect(requestResult.status).toBe(429);
    expect(requestResult.code).toBe("daily_request_limit");
  });

  it("increments daily and monthly token counters after usage is recorded", async () => {
    const { key } = await setupKey();
    const { incrementApiKeyUsage, getApiKeyById } = await import("@/lib/db/repos/apiKeysRepo.js");

    await incrementApiKeyUsage(key.key, 125);
    const updated = await getApiKeyById(key.id);

    expect(updated.tokensUsedToday).toBe(125);
    expect(updated.tokensUsedMonth).toBe(125);
  });
});
