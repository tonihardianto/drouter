const migration = {
  version: 4,
  name: "api-key-access-from-allowed-models",
  up(db) {
    const existing = new Set(db.all("PRAGMA table_info(apiKeys)").map((row) => row.name));
    if (!existing.has("accessRestricted")) db.exec("ALTER TABLE apiKeys ADD COLUMN accessRestricted INTEGER DEFAULT 0");
    if (!existing.has("accessAllow")) db.exec("ALTER TABLE apiKeys ADD COLUMN accessAllow TEXT");

    // Carry legacy allowed_models restrictions into the upstream access columns.
    // NULL means unrestricted and stays untouched.
    for (const row of db.all("SELECT id, allowed_models FROM apiKeys WHERE allowed_models IS NOT NULL")) {
      let allow = [];
      try {
        const parsed = JSON.parse(row.allowed_models);
        if (Array.isArray(parsed)) allow = parsed.filter((entry) => typeof entry === "string");
      } catch {
        allow = [];
      }
      db.run(
        "UPDATE apiKeys SET accessRestricted = 1, accessAllow = ? WHERE id = ?",
        [JSON.stringify(allow), row.id]
      );
    }
  },
};

export default migration;
