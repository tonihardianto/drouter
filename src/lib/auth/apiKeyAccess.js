import { getActiveApiKeyBySecret, getCombos } from "@/lib/localDb";

/** Extract a client API key consistently across OpenAI, Anthropic, and Gemini requests. */
export function extractApiKey(request) {
  const authorization = request?.headers?.get("Authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim() || null;
  return request?.headers?.get("x-api-key")?.trim()
    || request?.headers?.get("x-goog-api-key")?.trim()
    || new URL(request?.url || "http://localhost").searchParams.get("key")?.trim()
    || null;
}

export async function resolveApiKeyAccess(request) {
  const secret = extractApiKey(request);
  const apiKey = secret ? await getActiveApiKeyBySecret(secret) : null;
  return { secret, apiKey, allowedModels: apiKey?.allowedModels ?? null };
}

function expandCombo(name, comboMap, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const members = comboMap[name];
  if (!members) return [name];
  return members.flatMap((member) => expandCombo(member, comboMap, new Set(seen)));
}

/** NULL is unrestricted; [] denies every model; combo entries authorize all internal leaves. */
export function isModelAllowed(access, model, combos = {}) {
  const allowedModels = access?.allowedModels;
  if (allowedModels === null || allowedModels === undefined) return true;
  if (!allowedModels.includes(model)) {
    return allowedModels.some((entry) => expandCombo(entry, combos).includes(model));
  }
  return true;
}

export async function getComboModelMap() {
  const combos = await getCombos();
  return Object.fromEntries(combos.map((combo) => [combo.name, combo.models || []]));
}

export async function isRequestModelAllowed(request, model) {
  const access = await resolveApiKeyAccess(request);
  if (!access.apiKey) return true;
  return isModelAllowed(access, model, await getComboModelMap());
}

export async function enforceModelAccess(request, model) {
  if (await isRequestModelAllowed(request, model)) return null;
  return Response.json({ error: { message: `Model is not allowed for this API key: ${model}`, type: "permission_error", code: "model_not_allowed" } }, { status: 403 });
}

export async function filterAllowedModels(request, models) {
  const access = await resolveApiKeyAccess(request);
  if (!access.apiKey || access.allowedModels === null) return models;
  const combos = await getComboModelMap();
  return models.filter((model) => isModelAllowed(access, model.id || model, combos));
}
