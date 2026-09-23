const COLUMNS = {
  daily_token_limit: "INTEGER",
  daily_request_limit: "INTEGER",
  monthly_token_limit: "INTEGER",
  tokens_used_today: "INTEGER DEFAULT 0",
  requests_used_today: "INTEGER DEFAULT 0",
  tokens_used_month: "INTEGER DEFAULT 0",
  last_daily_reset_at: "TEXT",
  last_monthly_reset_at: "TEXT",
};

const migration = {
  version: 2,
  name: "api-key-rate-limits",
  up(db) {
    const existing = new Set(db.all("PRAGMA table_info(apiKeys)").map((row) => row.name));
    for (const [name, definition] of Object.entries(COLUMNS)) {
      if (!existing.has(name)) db.exec(`ALTER TABLE apiKeys ADD COLUMN ${name} ${definition}`);
    }
  },
};

export default migration;
