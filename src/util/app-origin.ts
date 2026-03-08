const isProduction = process.env.NODE_ENV === "production";
const localhostHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const allowedAppHosts = new Set(["planer.pirrot.de", "planer.pirrot.eu"]);

function isAllowedAppHostname(hostname: string) {
  if (allowedAppHosts.has(hostname)) return true;
  if (!isProduction && localhostHosts.has(hostname)) return true;
  return false;
}

export function toAllowedAppOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (!isAllowedAppHostname(hostname)) return null;

    if (localhostHosts.has(hostname)) {
      url.protocol = "http:";
      return url.origin;
    }

    url.protocol = "https:";
    url.port = "";
    return url.origin;
  } catch {
    return null;
  }
}

export function getConfiguredAppOrigin() {
  const configuredOrigins = [process.env.AUTH_URL, process.env.NEXTAUTH_URL];
  for (const configuredOrigin of configuredOrigins) {
    if (!configuredOrigin) continue;
    const allowedOrigin = toAllowedAppOrigin(configuredOrigin);
    if (allowedOrigin) return allowedOrigin;
  }

  if (isProduction) return "https://planer.pirrot.de";
  return "http://127.0.0.1:3000";
}

export function getRequestAppOrigin(headers: Headers): string | null {
  const forwardedHost = headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost ?? headers.get("host")?.trim();
  if (!host) return null;

  try {
    const parsedHost = new URL(`http://${host}`);
    const hostname = parsedHost.hostname.toLowerCase();
    if (!isAllowedAppHostname(hostname)) return null;

    if (localhostHosts.has(hostname)) {
      return `http://${parsedHost.host}`;
    }

    return `https://${hostname}`;
  } catch {
    return null;
  }
}

export function getAppOriginFromHeaders(headers: Headers) {
  return getRequestAppOrigin(headers) ?? getConfiguredAppOrigin();
}

export function buildAppUrl(origin: string, path: string) {
  return new URL(path, origin).toString();
}
