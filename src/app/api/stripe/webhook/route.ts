import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { stripeClient } from "@/util/stripe";
import { db } from "@/server/db";
import {
  createSponsorInvoicesForRedemption,
  parseSponsorSessionMetadata,
  toAddressParam,
} from "@/util/sponsor/invoices";

export async function POST(request: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return new NextResponse("Webhook secret is not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing Stripe signature header", { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripeClient.webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(`Webhook verification failed: ${message}`, {
      status: 400,
    });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const sponsorMetadata = parseSponsorSessionMetadata(session.metadata);

    if (sponsorMetadata) {
      const schoolEmail = session.customer_details?.email;
      if (!schoolEmail) {
        return new NextResponse("Missing school email on checkout session", {
          status: 400,
        });
      }

      const bookOrder = session.metadata?.orderId
        ? await db.bookOrder.findUnique({
            where: { id: session.metadata.orderId },
            select: { quantity: true },
          })
        : null;

      await createSponsorInvoicesForRedemption({
        db,
        referenceId: session.id,
        sponsor: sponsorMetadata,
        school: {
          email: schoolEmail,
          name: session.customer_details?.name ?? "School",
          address: toAddressParam(session.customer_details?.address ?? null),
          phone: session.customer_details?.phone ?? undefined,
        },
        quantity: bookOrder?.quantity,
      });
    }
  }

  return NextResponse.json({ received: true });
}
