import { NextResponse } from "next/server";
import { env } from "@/env";
import { stripeClient } from "@/util/stripe";
import { getStripeV2CoreClient } from "@/util/stripe-connect";
import { db } from "@/server/db";

const STRIPE_CONNECT_PROVIDER = "stripe_connect";
const STRIPE_CONNECT_REQUIREMENTS_PROVIDER = "stripe_connect_requirements";

const HANDLED_THIN_EVENT_TYPES = new Set([
  "v2.core.account[requirements].updated",
  "v2.core.account[configuration.merchant].capability_status_updated",
  "v2.core.account[configuration.customer].capability_status_updated",
  "v2.core.account[.recipient].capability_status_updated",
]);

type ParsedThinEvent = {
  id: string;
  type: string;
  context?: string;
  related_object?: { id?: string };
};

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getRequirementsStatus(account: unknown): string | undefined {
  const requirements = asObject(asObject(account)?.requirements);
  const summary = asObject(requirements?.summary);
  const minimumDeadline = asObject(summary?.minimum_deadline);
  return asString(minimumDeadline?.status);
}

function isOnboardingComplete(account: unknown): boolean {
  const requirementsStatus = getRequirementsStatus(account);
  return (
    requirementsStatus !== "currently_due" &&
    requirementsStatus !== "past_due"
  );
}

function parseThinEventOrThrow(
  payload: string,
  signature: string,
  webhookSecret: string,
): ParsedThinEvent {
  const parser = (
    stripeClient as unknown as {
      parseThinEvent?: (
        body: string,
        sig: string,
        secret: string,
      ) => ParsedThinEvent;
    }
  ).parseThinEvent;

  if (!parser) {
    throw new Error(
      "Stripe SDK does not expose parseThinEvent. Upgrade Stripe SDK to use thin event parsing.",
    );
  }

  return parser(payload, signature, webhookSecret);
}

async function persistRequirementSnapshot(params: {
  accountId: string;
  eventType: string;
  payload: unknown;
}): Promise<string | undefined> {
  const mapping = await db.account.findFirst({
    where: {
      provider: STRIPE_CONNECT_PROVIDER,
      providerAccountId: params.accountId,
    },
    select: {
      userId: true,
    },
  });

  if (!mapping) {
    return undefined;
  }

  await db.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: STRIPE_CONNECT_REQUIREMENTS_PROVIDER,
        providerAccountId: params.accountId,
      },
    },
    create: {
      userId: mapping.userId,
      type: "oauth",
      provider: STRIPE_CONNECT_REQUIREMENTS_PROVIDER,
      providerAccountId: params.accountId,
      scope: params.eventType,
      refresh_token: JSON.stringify(params.payload),
      expires_at: Math.floor(Date.now() / 1000),
    },
    update: {
      scope: params.eventType,
      refresh_token: JSON.stringify(params.payload),
      expires_at: Math.floor(Date.now() / 1000),
    },
  });

  return mapping.userId;
}

async function promoteUserToSponsorIfNeeded(params: {
  userId: string | undefined;
  accountSnapshot: unknown;
}) {
  if (!params.userId || !isOnboardingComplete(params.accountSnapshot)) {
    return;
  }

  await db.user.updateMany({
    where: {
      id: params.userId,
      role: {
        not: "SPONSOR",
      },
    },
    data: {
      role: "SPONSOR",
    },
  });
}

export async function POST(request: Request) {
  if (!env.STRIPE_CONNECT_THIN_WEBHOOK_SECRET) {
    return new NextResponse(
      "Missing STRIPE_CONNECT_THIN_WEBHOOK_SECRET. Add a placeholder value in env and configure Stripe to sign this endpoint.",
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing stripe-signature header", { status: 400 });
  }

  const rawBody = await request.text();

  let thinEvent: ParsedThinEvent;
  try {
    // Parse the thin event from webhook payload.
    thinEvent = parseThinEventOrThrow(
      rawBody,
      signature,
      env.STRIPE_CONNECT_THIN_WEBHOOK_SECRET,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(`Failed to parse thin event: ${message}`, {
      status: 400,
    });
  }

  const v2Core = getStripeV2CoreClient();

  // Retrieve the full event after parsing thin payload so handlers can use complete context.
  const event = await v2Core.events.retrieve(thinEvent.id);
  const eventType = String((event as { type?: string }).type ?? thinEvent.type);

  if (!HANDLED_THIN_EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ received: true, ignored: eventType });
  }

  const accountId =
    String(
      (event as { related_object?: { id?: string } }).related_object?.id ??
        thinEvent.related_object?.id ??
        (event as { context?: string }).context ??
        thinEvent.context ??
        "",
    ) || "";

  if (!accountId.startsWith("acct_")) {
    return new NextResponse("Unable to resolve connected account from event", {
      status: 400,
    });
  }

  const accountSnapshot = await v2Core.accounts.retrieve(accountId, {
    include: ["configuration.merchant", "requirements"],
  });

  const userId = await persistRequirementSnapshot({
    accountId,
    eventType,
    payload: {
      thinEventId: thinEvent.id,
      eventType,
      accountSnapshot,
      handledAt: new Date().toISOString(),
    },
  });

  await promoteUserToSponsorIfNeeded({
    userId,
    accountSnapshot,
  });

  return NextResponse.json({ received: true, eventType, accountId });
}
