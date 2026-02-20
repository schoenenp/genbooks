import crypto from "node:crypto";
import { env } from "@/env";

type TokenClaimsBase = {
  exp: number;
  kind: "campaign_link" | "sponsored_checkout";
};

export type CampaignLinkClaims = TokenClaimsBase & {
  kind: "campaign_link";
  sponsorUserId: string;
  templateId: string;
  snapshotBookId: string;
  promotionCodeId: string;
};

export type SponsoredCheckoutClaims = TokenClaimsBase & {
  kind: "sponsored_checkout";
  sponsorUserId: string;
  templateId: string;
  snapshotBookId: string;
  promotionCodeId: string;
  promotionCode: string;
};

type TokenClaims = CampaignLinkClaims | SponsoredCheckoutClaims;

const DEFAULT_LINK_TTL_SECONDS = 365 * 24 * 60 * 60;

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(paddingLength), "base64");
}

function getTokenSecret(): string {
  return env.SPONSOR_LINK_SECRET ?? env.AUTH_SECRET ?? env.CANCEL_SECRET;
}

function signRawPayload(payloadB64: string): string {
  return base64UrlEncode(
    crypto.createHmac("sha256", getTokenSecret()).update(payloadB64).digest(),
  );
}

export function createCampaignLinkToken(
  claims: Omit<CampaignLinkClaims, "kind" | "exp"> & { exp?: number },
): string {
  const exp =
    claims.exp ?? Math.floor(Date.now() / 1000) + DEFAULT_LINK_TTL_SECONDS;

  const payload = {
    kind: "campaign_link",
    sponsorUserId: claims.sponsorUserId,
    templateId: claims.templateId,
    snapshotBookId: claims.snapshotBookId,
    promotionCodeId: claims.promotionCodeId,
    exp,
  } satisfies CampaignLinkClaims;

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = signRawPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function createSponsoredCheckoutToken(
  claims: Omit<SponsoredCheckoutClaims, "kind" | "exp"> & { exp?: number },
): string {
  const exp =
    claims.exp ?? Math.floor(Date.now() / 1000) + DEFAULT_LINK_TTL_SECONDS;

  const payload = {
    kind: "sponsored_checkout",
    sponsorUserId: claims.sponsorUserId,
    templateId: claims.templateId,
    snapshotBookId: claims.snapshotBookId,
    promotionCodeId: claims.promotionCodeId,
    promotionCode: claims.promotionCode,
    exp,
  } satisfies SponsoredCheckoutClaims;

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = signRawPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifySponsorToken(token: string): TokenClaims {
  const [payloadB64, providedSignature] = token.split(".");
  if (!payloadB64 || !providedSignature) {
    throw new Error("Invalid sponsor token format");
  }

  const expectedSignature = signRawPayload(payloadB64);
  if (providedSignature.length !== expectedSignature.length) {
    throw new Error("Invalid sponsor token signature");
  }
  if (
    !crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature),
    )
  ) {
    throw new Error("Invalid sponsor token signature");
  }

  const payload = JSON.parse(
    base64UrlDecode(payloadB64).toString("utf-8"),
  ) as TokenClaims;

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Sponsor token has expired");
  }

  if (
    payload.kind !== "campaign_link" &&
    payload.kind !== "sponsored_checkout"
  ) {
    throw new Error("Unknown sponsor token type");
  }

  return payload;
}
