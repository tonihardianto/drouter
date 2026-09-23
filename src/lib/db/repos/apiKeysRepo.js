import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function normalizeLimit(value) {
  if (value === null || value === undefined || value === "") return null;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 0) throw new Error("API key limits must be non-negative integers");
  return limit;
}

function keyFields(data = {}) {
  return {
    dailyTokenLimit: normalizeLimit(data.dailyTokenLimit),
    dailyRequestLimit: normalizeLimit(data.dailyRequestLimit),
    monthlyTokenLimit: normalizeLimit(data.monthlyTokenLimit),
  };
}

function rowToKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    machineId: row.machineId,
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    dailyTokenLimit: row.daily_token_limit ?? null,
    dailyRequestLimit: row.daily_request_limit ?? null,
    monthlyTokenLimit: row.monthly_token_limit ?? null,
    tokensUsedToday: row.tokens_used_today || 0,
    requestsUsedToday: row.requests_used_today || 0,
    tokensUsedMonth: row.tokens_used_month || 0,
    lastDailyResetAt: row.last_daily_reset_at || null,
    lastMonthlyResetAt: row.last_monthly_reset_at || null,
  };
}

function localDateKey(timestamp = new Date()) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localMonthKey(timestamp = new Date()) {
  return localDateKey(timestamp).slice(0, 7);
}

function isPastLocalDate(timestamp, now) {
  return !timestamp || localDateKey(timestamp) !== localDateKey(now);
}

function isPastLocalMonth(timestamp, now) {
  return !timestamp || localMonthKey(timestamp) !== localMonthKey(now);
}

export async function getApiKeys() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM apiKeys ORDER BY createdAt ASC`);
  return rows.map(rowToKey);
}

export async function getApiKeyById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  return rowToKey(row);
}

export async function createApiKey(name, machineId, data = {}) {
  if (!machineId) throw new Error("machineId is required");
  const db = await getAdapter();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const limits = keyFields(data);
  const now = new Date().toISOString();
  const apiKey = {
    id: uuidv4(),
    name,
    key: result.key,
    machineId,
    isActive: true,
    createdAt: now,
    ...limits,
    tokensUsedToday: 0,
    requestsUsedToday: 0,
    tokensUsedMonth: 0,
    lastDailyResetAt: now,
    lastMonthlyResetAt: now,
  };
  db.run(
    `INSERT INTO apiKeys(
      id, key, name, machineId, isActive, createdAt,
      daily_token_limit, daily_request_limit, monthly_token_limit,
      tokens_used_today, requests_used_today, tokens_used_month,
      last_daily_reset_at, last_monthly_reset_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, 1, apiKey.createdAt,
      apiKey.dailyTokenLimit, apiKey.dailyRequestLimit, apiKey.monthlyTokenLimit,
      0, 0, 0, now, now,
    ]
  );
  return apiKey;
}

export async function updateApiKey(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToKey(row), ...data };
    const limits = keyFields(merged);
    db.run(
      `UPDATE apiKeys SET key = ?, name = ?, machineId = ?, isActive = ?,
        daily_token_limit = ?, daily_request_limit = ?, monthly_token_limit = ?
       WHERE id = ?`,
      [
        merged.key, merged.name, merged.machineId, merged.isActive ? 1 : 0,
        limits.dailyTokenLimit, limits.dailyRequestLimit, limits.monthlyTokenLimit, id,
      ]
    );
    result = { ...merged, ...limits };
  });
  return result;
}

export async function deleteApiKey(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM apiKeys WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

export async function validateApiKey(key) {
  const db = await getAdapter();
  const row = db.get(`SELECT isActive FROM apiKeys WHERE key = ?`, [key]);
  if (!row) return false;
  return row.isActive === 1 || row.isActive === true;
}

export async function reserveApiKeyRequest(key) {
  const db = await getAdapter();
  let result = null;
  const now = new Date();
  const nowIso = now.toISOString();

  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE key = ?`, [key]);
    if (!row || row.isActive !== 1) {
      result = { allowed: false, status: 401, code: "invalid_api_key" };
      return;
    }

    let tokensUsedToday = row.tokens_used_today || 0;
    let requestsUsedToday = row.requests_used_today || 0;
    let tokensUsedMonth = row.tokens_used_month || 0;
    let lastDailyResetAt = row.last_daily_reset_at;
    let lastMonthlyResetAt = row.last_monthly_reset_at;

    if (isPastLocalDate(lastDailyResetAt, now)) {
      tokensUsedToday = 0;
      requestsUsedToday = 0;
      lastDailyResetAt = nowIso;
    }
    if (isPastLocalMonth(lastMonthlyResetAt, now)) {
      tokensUsedMonth = 0;
      lastMonthlyResetAt = nowIso;
    }

    const limitError = row.daily_request_limit !== null && requestsUsedToday >= row.daily_request_limit
      ? { code: "daily_request_limit", message: "Daily request limit exceeded for this API key" }
      : row.daily_token_limit !== null && tokensUsedToday >= row.daily_token_limit
        ? { code: "daily_token_limit", message: "Daily token limit exceeded for this API key" }
        : row.monthly_token_limit !== null && tokensUsedMonth >= row.monthly_token_limit
          ? { code: "monthly_token_limit", message: "Monthly token limit exceeded for this API key" }
          : null;

    if (limitError) {
      db.run(
        `UPDATE apiKeys SET tokens_used_today = ?, requests_used_today = ?, tokens_used_month = ?, last_daily_reset_at = ?, last_monthly_reset_at = ? WHERE id = ?`,
        [tokensUsedToday, requestsUsedToday, tokensUsedMonth, lastDailyResetAt, lastMonthlyResetAt, row.id]
      );
      result = { allowed: false, status: 429, ...limitError, key: rowToKey({ ...row, tokens_used_today: tokensUsedToday, requests_used_today: requestsUsedToday, tokens_used_month: tokensUsedMonth, last_daily_reset_at: lastDailyResetAt, last_monthly_reset_at: lastMonthlyResetAt }) };
      return;
    }

    requestsUsedToday += 1;
    db.run(
      `UPDATE apiKeys SET tokens_used_today = ?, requests_used_today = ?, tokens_used_month = ?, last_daily_reset_at = ?, last_monthly_reset_at = ? WHERE id = ?`,
      [tokensUsedToday, requestsUsedToday, tokensUsedMonth, lastDailyResetAt, lastMonthlyResetAt, row.id]
    );
    result = {
      allowed: true,
      key: rowToKey({ ...row, tokens_used_today: tokensUsedToday, requests_used_today: requestsUsedToday, tokens_used_month: tokensUsedMonth, last_daily_reset_at: lastDailyResetAt, last_monthly_reset_at: lastMonthlyResetAt }),
    };
  });

  return result;
}

export async function incrementApiKeyUsage(key, tokenCount) {
  const tokens = Number(tokenCount);
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const db = await getAdapter();
  const now = new Date();
  const nowIso = now.toISOString();
  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE key = ?`, [key]);
    if (!row) return;
    const dailyReset = isPastLocalDate(row.last_daily_reset_at, now);
    const monthlyReset = isPastLocalMonth(row.last_monthly_reset_at, now);
    const today = dailyReset ? 0 : (row.tokens_used_today || 0);
    const month = monthlyReset ? 0 : (row.tokens_used_month || 0);
    db.run(
      `UPDATE apiKeys SET tokens_used_today = ?, tokens_used_month = ?, last_daily_reset_at = ?, last_monthly_reset_at = ? WHERE id = ?`,
      [today + tokens, month + tokens, dailyReset ? nowIso : row.last_daily_reset_at, monthlyReset ? nowIso : row.last_monthly_reset_at, row.id]
    );
  });
}
