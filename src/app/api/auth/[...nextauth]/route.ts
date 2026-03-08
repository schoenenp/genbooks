import { handlers } from "@/server/auth";
import { NextRequest } from "next/server";
import { getRequestAppOrigin } from "@/util/app-origin";

function normalizeAuthRequestOrigin(request: NextRequest) {
  const appOrigin = getRequestAppOrigin(request.headers);
  if (!appOrigin) return request;

  const currentUrl = new URL(request.url);
  const normalizedUrl = new URL(
    `${currentUrl.pathname}${currentUrl.search}`,
    appOrigin,
  );

  if (normalizedUrl.origin === currentUrl.origin) {
    return request;
  }

  return new NextRequest(normalizedUrl.toString(), request);
}

export async function GET(request: NextRequest) {
  return handlers.GET(normalizeAuthRequestOrigin(request));
}

export async function POST(request: NextRequest) {
  return handlers.POST(normalizeAuthRequestOrigin(request));
}
