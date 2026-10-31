// www.<domain> -> <domain>: the apex is the one canonical address (cookies, service worker and search engines all key on it).
// Returns the apex URL to redirect to, or null when the request is not on a www host. Path and query are kept; https is forced.
export function wwwRedirectTarget(rawUrl: string, hostHeader?: string | null): string | null {
  let u: URL;
  try { u = new URL(rawUrl); } catch { return null; }
  const host = (hostHeader || u.host).toLowerCase().replace(/:\d+$/, '');
  if (!host.startsWith('www.') || host.length <= 4 || host === 'www.localhost') return null;
  const apex = host.slice(4);
  if (!apex.includes('.')) return null; // "www.com"-style oddities: leave alone
  return `https://${apex}${u.pathname}${u.search}`;
}
