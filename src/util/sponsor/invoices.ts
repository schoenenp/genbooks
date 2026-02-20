import type { PrismaClient } from "@prisma/client";
import type Stripe from "stripe";
import { stripeClient } from "@/util/stripe";
import { logger } from "@/util/logger";

const STRIPE_GERMAN_LOCALE = "de";

export type SponsorSessionMetadata = {
  sponsorUserId: string;
  sponsorTemplateId: string;
  sponsorSnapshotBookId: string;
  sponsorPromotionCodeId: string;
  sponsorStripeAccountId: string;
  sponsorBaseUnitAmount: number;
  sponsorBaseTotalAmount: number;
};

type SponsorInvoiceInput = {
  db: PrismaClient;
  referenceId: string;
  sponsor: SponsorSessionMetadata;
  school: {
    email: string;
    name: string;
    address?: Stripe.AddressParam;
    phone?: string;
  };
  quantity?: number;
};

type SponsorInvoiceResult = {
  sponsorInvoiceId?: string;
  proofInvoiceId?: string;
};

function getEffectiveQuantity(input: SponsorInvoiceInput): number {
  if (input.quantity && input.quantity > 0) {
    return input.quantity;
  }

  const { sponsorBaseUnitAmount, sponsorBaseTotalAmount } = input.sponsor;
  if (sponsorBaseUnitAmount > 0 && sponsorBaseTotalAmount > 0) {
    const estimated = Math.round(sponsorBaseTotalAmount / sponsorBaseUnitAmount);
    if (estimated > 0) {
      return estimated;
    }
  }

  return 1;
}

function getPlannerReference(snapshotBookId: string): string {
  const compact = snapshotBookId.replace(/[^a-zA-Z0-9]/g, "");
  const shortRef = compact.slice(-6).toUpperCase();
  return shortRef.length > 0 ? shortRef : snapshotBookId;
}

function buildSponsorProofDescription(input: SponsorInvoiceInput): string {
  const quantity = getEffectiveQuantity(input);
  const plannerRef = getPlannerReference(input.sponsor.sponsorSnapshotBookId);
  return `${quantity}-mal Planer-${plannerRef} à 0.00€`;
}

function normalizeReference(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

function toInt(input: string | undefined): number {
  if (!input) return 0;
  const parsed = Number.parseInt(input, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseSponsorSessionMetadata(
  metadata: Stripe.Metadata | null | undefined,
): SponsorSessionMetadata | null {
  if (metadata?.sponsorFlow !== "1") {
    return null;
  }

  const sponsorUserId = metadata.sponsorUserId ?? "";
  const sponsorTemplateId = metadata.sponsorTemplateId ?? "";
  const sponsorSnapshotBookId = metadata.sponsorSnapshotBookId ?? "";
  const sponsorPromotionCodeId = metadata.sponsorPromotionCodeId ?? "";
  const sponsorStripeAccountId = metadata.sponsorStripeAccountId ?? "";

  if (
    !sponsorUserId ||
    !sponsorTemplateId ||
    !sponsorSnapshotBookId ||
    !sponsorPromotionCodeId ||
    !sponsorStripeAccountId
  ) {
    return null;
  }

  return {
    sponsorUserId,
    sponsorTemplateId,
    sponsorSnapshotBookId,
    sponsorPromotionCodeId,
    sponsorStripeAccountId,
    sponsorBaseUnitAmount: toInt(metadata.sponsorBaseUnitAmount),
    sponsorBaseTotalAmount: toInt(metadata.sponsorBaseTotalAmount),
  };
}

export function toAddressParam(
  address: Stripe.Address | null | undefined,
): Stripe.AddressParam | undefined {
  if (!address) return undefined;
  return {
    city: address.city ?? undefined,
    country: address.country ?? undefined,
    line1: address.line1 ?? undefined,
    line2: address.line2 ?? undefined,
    postal_code: address.postal_code ?? undefined,
    state: address.state ?? undefined,
  };
}

async function findOrCreateCustomerOnPlatform(params: {
  email: string;
  name?: string;
  metadata?: Stripe.MetadataParam;
}) {
  const listed = await stripeClient.customers.list({
    email: params.email,
    limit: 1,
  });

  if (listed.data[0]) {
    return stripeClient.customers.update(listed.data[0].id, {
      preferred_locales: [STRIPE_GERMAN_LOCALE],
    });
  }

  return stripeClient.customers.create({
    email: params.email,
    name: params.name,
    preferred_locales: [STRIPE_GERMAN_LOCALE],
    metadata: params.metadata,
  });
}

async function findOrCreateCustomerOnConnectedAccount(params: {
  connectedAccountId: string;
  email: string;
  name?: string;
  address?: Stripe.AddressParam;
  phone?: string;
}) {
  const listed = await stripeClient.customers.list(
    {
      email: params.email,
      limit: 1,
    },
    { stripeAccount: params.connectedAccountId },
  );

  if (listed.data[0]) {
    return stripeClient.customers.update(
      listed.data[0].id,
      {
        preferred_locales: [STRIPE_GERMAN_LOCALE],
      },
      { stripeAccount: params.connectedAccountId },
    );
  }

  return stripeClient.customers.create(
    {
      email: params.email,
      name: params.name,
      address: params.address,
      phone: params.phone,
      preferred_locales: [STRIPE_GERMAN_LOCALE],
    },
    { stripeAccount: params.connectedAccountId },
  );
}

export async function createSponsorInvoicesForRedemption(
  input: SponsorInvoiceInput,
): Promise<SponsorInvoiceResult> {
  const { db, sponsor, school } = input;
  const safeReference = normalizeReference(input.referenceId);
  if (!sponsor.sponsorStripeAccountId.startsWith("acct_")) {
    throw new Error("Invalid sponsor connected account ID for proof invoice");
  }
  const sponsorProofDescription = buildSponsorProofDescription(input);

  const sponsorUser = await db.user.findUnique({
    where: {
      id: sponsor.sponsorUserId,
    },
    select: {
      email: true,
      name: true,
    },
  });

  if (!sponsorUser?.email) {
    throw new Error("Sponsor email not available for sponsor invoice");
  }

  const sponsorCustomer = await findOrCreateCustomerOnPlatform({
    email: sponsorUser.email,
    name: sponsorUser.name ?? undefined,
    metadata: {
      sponsorUserId: sponsor.sponsorUserId,
    },
  });

  let sponsorInvoiceId: string | undefined;
  if (sponsor.sponsorBaseTotalAmount > 0) {
    await stripeClient.invoiceItems.create(
      {
        customer: sponsorCustomer.id,
        currency: "eur",
        amount: sponsor.sponsorBaseTotalAmount,
        description: "Sponsoring-Grundplaner",
        metadata: {
          invoiceType: "SPONSOR_BASE_CHARGE",
          sponsorUserId: sponsor.sponsorUserId,
          sponsorTemplateId: sponsor.sponsorTemplateId,
          sponsorSnapshotBookId: sponsor.sponsorSnapshotBookId,
          sponsorPromotionCodeId: sponsor.sponsorPromotionCodeId,
          workflowRef: safeReference,
        },
      },
      {
        idempotencyKey: `sponsor_base_item_${safeReference}`,
      },
    );

    const sponsorInvoice = await stripeClient.invoices.create(
      {
        customer: sponsorCustomer.id,
        auto_advance: true,
        collection_method: "send_invoice",
        days_until_due: 14,
        metadata: {
          invoiceType: "SPONSOR_BASE_CHARGE",
          sponsorUserId: sponsor.sponsorUserId,
          sponsorTemplateId: sponsor.sponsorTemplateId,
          sponsorSnapshotBookId: sponsor.sponsorSnapshotBookId,
          sponsorPromotionCodeId: sponsor.sponsorPromotionCodeId,
          workflowRef: safeReference,
        },
      },
      {
        idempotencyKey: `sponsor_base_invoice_${safeReference}`,
      },
    );

    if (!sponsorInvoice.id) {
      throw new Error("Failed to create sponsor invoice");
    }

    sponsorInvoiceId = sponsorInvoice.id;
    await stripeClient.invoices.sendInvoice(sponsorInvoiceId);
  }

  const schoolCustomer = await findOrCreateCustomerOnConnectedAccount({
    connectedAccountId: sponsor.sponsorStripeAccountId,
    email: school.email,
    name: school.name,
    address: school.address,
    phone: school.phone,
  });

  await stripeClient.invoiceItems.create(
    {
      customer: schoolCustomer.id,
      currency: "eur",
      amount: 0,
      description: sponsorProofDescription,
      metadata: {
        invoiceType: "SPONSOR_PROOF_ZERO",
        sponsorUserId: sponsor.sponsorUserId,
        sponsorTemplateId: sponsor.sponsorTemplateId,
        sponsorSnapshotBookId: sponsor.sponsorSnapshotBookId,
        sponsorPromotionCodeId: sponsor.sponsorPromotionCodeId,
        sponsorProofDescription,
        sponsorProofQuantity: String(getEffectiveQuantity(input)),
        workflowRef: safeReference,
      },
    },
    {
      stripeAccount: sponsor.sponsorStripeAccountId,
      idempotencyKey: `sponsor_proof_item_${safeReference}`,
    },
  );

  const proofInvoice = await stripeClient.invoices.create(
    {
      customer: schoolCustomer.id,
      auto_advance: true,
      collection_method: "send_invoice",
      days_until_due: 1,
      metadata: {
        invoiceType: "SPONSOR_PROOF_ZERO",
        sponsorUserId: sponsor.sponsorUserId,
        sponsorTemplateId: sponsor.sponsorTemplateId,
        sponsorSnapshotBookId: sponsor.sponsorSnapshotBookId,
        sponsorPromotionCodeId: sponsor.sponsorPromotionCodeId,
        sponsorProofDescription,
        sponsorProofQuantity: String(getEffectiveQuantity(input)),
        workflowRef: safeReference,
      },
    },
    {
      stripeAccount: sponsor.sponsorStripeAccountId,
      idempotencyKey: `sponsor_proof_invoice_${safeReference}`,
    },
  );

  if (!proofInvoice.id) {
    throw new Error("Failed to create sponsor proof invoice");
  }

  await stripeClient.invoices.sendInvoice(
    proofInvoice.id,
    {},
    {
      stripeAccount: sponsor.sponsorStripeAccountId,
    },
  );

  return {
    sponsorInvoiceId,
    proofInvoiceId: proofInvoice.id,
  };
}

export function retrySponsorProofInvoiceAsync(params: SponsorInvoiceInput) {
  void (async () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await createSponsorInvoicesForRedemption(params);
        return;
      } catch (error) {
        logger.error("sponsor_proof_invoice_retry_failed", {
          attempt,
          referenceId: params.referenceId,
          error,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  })();
}
