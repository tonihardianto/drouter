const migration = {
  version: 3,
  name: "api-key-allowed-models",
  up(db) {
    const existing = new Set(db.all("PRAGMA table_info(apiKeys)").map((row) => row.name));
    if (!existing.has("allowed_models")) db.exec("ALTER TABLE apiKeys ADD COLUMN allowed_models TEXT");
  },
};

export default migration;
