export const stripSlash = (url) => (url || "").replace(/\/+$/, "");

export const ensureV1 = (url) => {
  const trimmed = stripSlash(url);
  if (!trimmed) return "";
  return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
};

export function buildEndpointOptions({ localUrl, requiresExternalUrl, tunnelEnabled, tunnelPublicUrl, tailscaleEnabled, tailscaleUrl, cloudEnabled, cloudUrl, savedPresets, withV1 }) {
  const options = [];
  const wrap = (url) => (withV1 ? ensureV1(url) : stripSlash(url));
  if (!requiresExternalUrl && localUrl) {
    const url = wrap(localUrl);
    options.push({ value: "local", label: url, url });
  }
  if (tunnelEnabled && tunnelPublicUrl) {
    const url = wrap(tunnelPublicUrl);
    options.push({ value: "tunnel", label: url, url });
  }
  if (tailscaleEnabled && tailscaleUrl) {
    const url = wrap(tailscaleUrl);
    options.push({ value: "tailscale", label: url, url });
  }
  if (cloudEnabled && cloudUrl) {
    const url = wrap(cloudUrl);
    options.push({ value: "cloud", label: url, url });
  }
  savedPresets.forEach((preset) => {
    options.push({ value: `saved:${preset.name}`, label: preset.baseUrl, url: preset.baseUrl, saved: true });
  });
  return options;
}
