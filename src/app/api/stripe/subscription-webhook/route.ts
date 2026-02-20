import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { stripeClient } from "@/util/stripe";
import { db } from "@/server/db";

const STRIPE_CONNECT_PROVIDER = "stripe_connect";
const STRIPE_SUBSCRIPTION_STATUS_PROVIDER = "stripe_connect_subscription_status";

const HANDLED_SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "payment_method.attached",
  "payment_method.detached",
  "customer.updated",
  "customer.tax_id.created",
  "customer.tax_id.deleted",
  "customer.tax_id.updated",
  "billing_portal.configuration.created",
  "billing_portal.configuration.updated",
  "billing_portal.session.created",
  "invoice.paid",
]);

function resolveConnectedAccountId(event: Stripe.Event): string | null {
  const object = event.data.object as unknown as Record<string, unknown>;

  // For V2 account subscriptions, Stripe sends customer_account (acct_...) on subscription objects.
  if (typeof object.customer_account === "string") {
    return object.customer_account;
  }

  // Fallback to event.account when delivered in connected-account context.
  if (typeof event.account === "string") {
    return event.account;
  }

  return null;
}

async function persistSubscriptionState(params: {
  accountId: string;
  eventType: string;
  object: Record<string, unknown>;
}) {
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
    return;
  }

  const subscriptionStatus =
    typeof params.object.status === "string" ? params.object.status : null;

  const subscriptionItems = params.object.items as
    | { data?: Array<Record<string, unknown>> }
    | undefined;
  const firstItem = subscriptionItems?.data?.[0];
  const firstItemPrice = firstItem?.price as Record<string, unknown> | undefined;
  const firstPriceId =
    typeof firstItemPrice?.id === "string" ? firstItemPrice.id : null;
  const firstQuantity =
    typeof firstItem?.quantity === "number" ? String(firstItem.quantity) : null;

  const currentPeriodEnd =
    typeof params.object.current_period_end === "number"
      ? params.object.current_period_end
      : null;

  await db.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: STRIPE_SUBSCRIPTION_STATUS_PROVIDER,
        providerAccountId: params.accountId,
      },
    },
    create: {
      userId: mapping.userId,
      type: "oauth",
      provider: STRIPE_SUBSCRIPTION_STATUS_PROVIDER,
      providerAccountId: params.accountId,
      scope: subscriptionStatus ?? params.eventType,
      access_token: firstPriceId ?? undefined,
      refresh_token: JSON.stringify({
        eventType: params.eventType,
        quantity: firstQuantity,
        cancel_at_period_end: params.object.cancel_at_period_end,
        pause_collection: params.object.pause_collection,
        objectId: params.object.id,
        receivedAt: new Date().toISOString(),
      }),
      expires_at: currentPeriodEnd ?? undefined,
    },
    update: {
      scope: subscriptionStatus ?? params.eventType,
      access_token: firstPriceId ?? undefined,
      refresh_token: JSON.stringify({
        eventType: params.eventType,
        quantity: firstQuantity,
        cancel_at_period_end: params.object.cancel_at_period_end,
        pause_collection: params.object.pause_collection,
        objectId: params.object.id,
        receivedAt: new Date().toISOString(),
      }),
      expires_at: currentPeriodEnd ?? undefined,
    },
  });
}

export async function POST(request: Request) {
  if (!env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET) {
    return new NextResponse(
      "Missing STRIPE_SUBSCRIPTION_WEBHOOK_SECRET. Add a placeholder value in env and configure Stripe webhook signing for this endpoint.",
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing stripe-signature header", { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripeClient.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(`Invalid webhook signature: ${message}`, {
      status: 400,
    });
  }

  if (!HANDLED_SUBSCRIPTION_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const accountId = resolveConnectedAccountId(event);
  if (!accountId) {
    // For objects without account context, we acknowledge but skip persistence.
    return NextResponse.json({ received: true, ignored: "no_account_context" });
  }

  await persistSubscriptionState({
    accountId,
    eventType: event.type,
    object: event.data.object as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ received: true, eventType: event.type, accountId });
}
