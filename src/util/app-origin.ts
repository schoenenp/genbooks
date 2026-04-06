const isProduction = process.env.NODE_ENV === "production";
const localhostHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function splitConfiguredOrigins(value: string | undefined) {
  if (!value) return [];

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function coerceUrl(value: string) {
  const normalizedValue = trimTrailingSlash(value.trim());
  if (!normalizedValue) return null;

  try {
    if (normalizedValue.includes("://")) return new URL(normalizedValue);
    return new URL(`http://${normalizedValue}`);
  } catch {
    return null;
  }
}

export function normalizeAppOrigin(value: string): string | null {
  const url = coerceUrl(value);
  if (!url) return null;

  const hostname = url.hostname.toLowerCase();
  if (localhostHosts.has(hostname)) {
    url.protocol = "http:";
    return url.origin;
  }

  url.protocol = "https:";
  url.port = "";
  return url.origin;
}

export function getConfiguredAppOrigins() {
  const configuredOrigins = [
    ...splitConfiguredOrigins(process.env.APP_ALLOWED_ORIGINS),
    process.env.APP_FALLBACK_ORIGIN,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
  ];

  const normalizedOrigins = new Set<string>();
  for (const configuredOrigin of configuredOrigins) {
    if (!configuredOrigin) continue;

    const normalizedOrigin = normalizeAppOrigin(configuredOrigin);
    if (!normalizedOrigin) continue;

    normalizedOrigins.add(normalizedOrigin);
  }

  return [...normalizedOrigins];
}

export function getConfiguredAppOrigin() {
  const [configuredOrigin] = getConfiguredAppOrigins();
  if (configuredOrigin) return configuredOrigin;

  return "http://127.0.0.1:3000";
}

export function getRequestAppOrigin(headers: Headers): string | null {
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost ?? headers.get("host")?.trim();
  if (!host) return null;

  const parsedHost = coerceUrl(host);
  if (!parsedHost) return null;

  const hostname = parsedHost.hostname.toLowerCase();
  if (localhostHosts.has(hostname)) {
    return `http://${parsedHost.host}`;
  }

  const forwardedProto = headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    ?.toLowerCase();
  const protocol = forwardedProto === "http" ? "http:" : "https:";

  return `${protocol}//${parsedHost.hostname.toLowerCase()}`;
}

type AllowedOriginOptions = {
  headers?: Headers;
  extraOrigins?: Iterable<string>;
};

export function toAllowedAppOrigin(
  value: string,
  options: AllowedOriginOptions = {},
): string | null {
  const normalizedOrigin = normalizeAppOrigin(value);
  if (!normalizedOrigin) return null;

  const hostname = new URL(normalizedOrigin).hostname.toLowerCase();
  if (!isProduction && localhostHosts.has(hostname)) return normalizedOrigin;

  const allowedOrigins = new Set<string>(getConfiguredAppOrigins());

  const requestOrigin = options.headers
    ? getRequestAppOrigin(options.headers)
    : null;
  if (requestOrigin) {
    allowedOrigins.add(requestOrigin);
  }

  for (const extraOrigin of options.extraOrigins ?? []) {
    const normalizedExtraOrigin = normalizeAppOrigin(extraOrigin);
    if (!normalizedExtraOrigin) continue;
    allowedOrigins.add(normalizedExtraOrigin);
  }

  if (allowedOrigins.has(normalizedOrigin)) return normalizedOrigin;
  return null;
}

export function getAppOriginFromHeaders(headers: Headers) {
  return getRequestAppOrigin(headers) ?? getConfiguredAppOrigin();
}

export function buildAppUrl(origin: string, path: string) {
  return new URL(path, origin).toString();
}
