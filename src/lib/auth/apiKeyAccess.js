/** Extract a client API key consistently across OpenAI, Anthropic, and Gemini requests. */
export function extractApiKey(request) {
  const authorization = request?.headers?.get("Authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim() || null;
  return request?.headers?.get("x-api-key")?.trim()
    || request?.headers?.get("x-goog-api-key")?.trim()
    || new URL(request?.url || "http://localhost").searchParams.get("key")?.trim()
    || null;
}
