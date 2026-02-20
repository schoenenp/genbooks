import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Naming } from "@/util/naming";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { stripeClient } from "@/util/stripe";
import { getStripeV2CoreClient } from "@/util/stripe-connect";
import { env } from "@/env";
import {
  createCampaignLinkToken,
  createSponsoredCheckoutToken,
  type CampaignLinkClaims,
  verifySponsorToken,
} from "@/util/sponsor-link";
import { logger } from "@/util/logger";
import { enforceProcedureRateLimit } from "@/util/rate-limit";

const STRIPE_CONNECT_PROVIDER = "stripe_connect";
const STRIPE_GERMAN_LOCALE = "de";

const CAMPAIGN_KIND = "sponsor_campaign";
const CAMPAIGN_PROMO_CODE_REGEX = /^[A-Z0-9-_]{6,32}$/;
const SECONDS_IN_DAY = 24 * 60 * 60;
const SECONDS_IN_YEAR = 365 * 24 * 60 * 60;
const DEFAULT_CAMPAIGN_VALID_DAYS = 90;
const MIN_CAMPAIGN_VALID_DAYS = 1;
const MAX_CAMPAIGN_VALID_DAYS = 365;
const DEFAULT_CAMPAIGN_MAX_REDEMPTIONS = 10;
const MAX_CAMPAIGN_MAX_REDEMPTIONS = 1000;

type StripeV2Entity = Record<string, unknown>;

function normalizePromoCode(input: string): string {
  return input.trim().toUpperCase();
}

function randomPromoCode(prefix = "SP"): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random = "";
  for (let i = 0; i < 8; i++) {
    random += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return `${prefix}-${random}`;
}

function assertSponsorRole(
  role: "ADMIN" | "STAFF" | "MODERATOR" | "USER" | "SPONSOR",
) {
  if (role !== "SPONSOR" && role !== "ADMIN" && role !== "STAFF") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sponsor account required" });
  }
}

function getOnboardingUrls() {
  return {
    refresh_url: `${env.BASE_APP_URL}/dashboard?view=profil&sponsor_refresh=1`,
    return_url: `${env.BASE_APP_URL}/dashboard?view=profil&sponsor_return=1`,
  };
}

function parseCampaignClaims(token: string): CampaignLinkClaims {
  const claims = verifySponsorToken(token);
  if (claims.kind !== "campaign_link") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid campaign link token" });
  }
  return claims;
}

function getConnectCountryOrThrow(input?: string): string {
  const configured = (input ?? env.STRIPE_CONNECT_COUNTRY ?? "AT")
    .trim()
    .toLowerCase();
  if (!/^[a-z]{2}$/.test(configured)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Invalid STRIPE_CONNECT_COUNTRY. Use a two-letter ISO country code like 'at'.",
    });
  }
  return configured;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function getCardPaymentsCapabilityStatus(
  account: StripeV2Entity,
): string | undefined {
  return asString(
    asObject(
      asObject(
        asObject(asObject(account.configuration)?.merchant)?.capabilities,
      )?.card_payments,
    )?.status,
  );
}

function getRequirementsStatus(account: StripeV2Entity): string | undefined {
  return asString(
    asObject(
      asObject(asObject(account.requirements)?.summary)?.minimum_deadline,
    )?.status,
  );
}

function getV2EntityId(entity: StripeV2Entity): string | undefined {
  return asString(entity.id);
}

function getV2LinkUrl(entity: StripeV2Entity): string | undefined {
  return asString(entity.url);
}

function getV2LinkExpiresAt(entity: StripeV2Entity): number | undefined {
  return asNumber(entity.expires_at);
}

function isSponsorCampaignForUser(
  campaign: { metadata: Record<string, string> | null | undefined },
  userId: string,
): boolean {
  const metadata = campaign.metadata ?? {};
  return (
    (metadata.kind ?? "") === CAMPAIGN_KIND &&
    (metadata.sponsorUserId ?? "") === userId
  );
}

async function getConnectAccountStatus(stripeAccountId: string) {
  // Always fetch account status directly from Stripe API for current truth.
  const v2Core = getStripeV2CoreClient();
  const account = await v2Core.accounts.retrieve(stripeAccountId, {
    include: ["configuration.merchant", "requirements"],
  });
  const readyToProcessPayments =
    getCardPaymentsCapabilityStatus(account) === "active";
  const requirementsStatus = getRequirementsStatus(account);

  const onboardingComplete =
    requirementsStatus !== "currently_due" && requirementsStatus !== "past_due";

  return {
    account,
    readyToProcessPayments,
    onboardingComplete,
    requirementsStatus,
  };
}

export const sponsorRouter = createTRPCRouter({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        role: true,
        accounts: {
          where: { provider: STRIPE_CONNECT_PROVIDER },
          select: { providerAccountId: true },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    let effectiveRole = user.role;
    const mappedAccountId = user.accounts[0]?.providerAccountId;
    let stripeAccount:
      | {
          id: string;
          readyToProcessPayments: boolean;
          onboardingComplete: boolean;
          requirementsStatus?: string;
          capabilitiesStatus?: string;
        }
      | undefined;

    if (mappedAccountId) {
      const status = await getConnectAccountStatus(mappedAccountId);
      const capabilitiesStatus =
        getCardPaymentsCapabilityStatus(status.account) ?? "unknown";

      stripeAccount = {
        id: getV2EntityId(status.account) ?? mappedAccountId,
        readyToProcessPayments: status.readyToProcessPayments,
        onboardingComplete: status.onboardingComplete,
        requirementsStatus: status.requirementsStatus,
        capabilitiesStatus,
      };

      if (status.onboardingComplete && effectiveRole !== "SPONSOR") {
        await ctx.db.user.update({
          where: { id: user.id },
          data: { role: "SPONSOR" },
        });
        effectiveRole = "SPONSOR";
      }
    }

    return {
      role: effectiveRole,
      isSponsor: effectiveRole === "SPONSOR",
      hasConnectAccount: Boolean(mappedAccountId),
      onboardingComplete: stripeAccount?.onboardingComplete ?? false,
      readyToProcessPayments: stripeAccount?.readyToProcessPayments ?? false,
      stripeAccount,
    };
  }),

  startConnectOnboarding: protectedProcedure
    .input(
      z.object({
        country: z.string().trim().toUpperCase().length(2).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        include: {
          accounts: {
            where: { provider: STRIPE_CONNECT_PROVIDER },
            take: 1,
          },
        },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      let stripeAccountId = user.accounts[0]?.providerAccountId;
      const v2Core = getStripeV2CoreClient();
      const requestedCountry = getConnectCountryOrThrow(input.country);

      if (!stripeAccountId) {
        if (!user.email) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Missing user email. A contact email is required before creating a connected account.",
          });
        }

        // V2 Connected Account creation with the exact required properties.
        const account = await v2Core.accounts.create({
          display_name: user.name ?? `Sponsor ${user.id}`,
          contact_email: user.email,
          identity: {
            country: requestedCountry,
          },
          dashboard: "full",
          defaults: {
            locales: [STRIPE_GERMAN_LOCALE],
            responsibilities: {
              fees_collector: "stripe",
              losses_collector: "stripe",
            },
          },
          configuration: {
            customer: {},
            merchant: {
              capabilities: {
                card_payments: {
                  requested: true,
                },
              },
            },
          },
        });

        stripeAccountId = getV2EntityId(account) ?? "";
        if (!stripeAccountId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Stripe did not return a connected account ID.",
          });
        }

        await ctx.db.account.create({
          data: {
            userId: user.id,
            type: "oauth",
            provider: STRIPE_CONNECT_PROVIDER,
            providerAccountId: stripeAccountId,
          },
        });
      }

      if (!stripeAccountId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Stripe did not return a connected account ID.",
        });
      }

      await v2Core.accounts.update(stripeAccountId, {
        defaults: {
          locales: [STRIPE_GERMAN_LOCALE],
        },
      });

      // V2 account links API for onboarding.
      const accountLink = await v2Core.accountLinks.create({
        account: stripeAccountId,
        use_case: {
          type: "account_onboarding",
          account_onboarding: {
            configurations: ["merchant", "customer"],
            ...getOnboardingUrls(),
          },
        },
      });

      const onboardingUrl = getV2LinkUrl(accountLink) ?? "";
      if (!onboardingUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Stripe did not return an onboarding URL.",
        });
      }

      const expiresAt = getV2LinkExpiresAt(accountLink);

      return {
        onboardingUrl,
        expiresAt,
      };
    }),

  finalizeConnectOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        role: true,
        accounts: {
          where: { provider: STRIPE_CONNECT_PROVIDER },
          select: { providerAccountId: true },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    const stripeAccountId = user.accounts[0]?.providerAccountId;
    if (!stripeAccountId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No Stripe Connect account linked",
      });
    }

    const status = await getConnectAccountStatus(stripeAccountId);

    if (status.onboardingComplete && user.role !== "SPONSOR") {
      await ctx.db.user.update({
        where: { id: user.id },
        data: { role: "SPONSOR" },
      });
    }

    return {
      onboardingComplete: status.onboardingComplete,
      readyToProcessPayments: status.readyToProcessPayments,
      requirementsStatus: status.requirementsStatus,
      role: status.onboardingComplete ? "SPONSOR" : user.role,
      stripeAccountId: getV2EntityId(status.account) ?? stripeAccountId,
    };
  }),

  createCampaign: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        promoCode: z.string().optional(),
        maxRedemptions: z
          .number()
          .int()
          .min(1)
          .max(MAX_CAMPAIGN_MAX_REDEMPTIONS)
          .default(DEFAULT_CAMPAIGN_MAX_REDEMPTIONS),
        validForDays: z
          .number()
          .int()
          .min(MIN_CAMPAIGN_VALID_DAYS)
          .max(MAX_CAMPAIGN_VALID_DAYS)
          .default(DEFAULT_CAMPAIGN_VALID_DAYS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        include: {
          accounts: {
            where: { provider: STRIPE_CONNECT_PROVIDER },
            take: 1,
          },
        },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      assertSponsorRole(user.role);

      const stripeAccountId = user.accounts[0]?.providerAccountId;
      if (!stripeAccountId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Complete Stripe Connect onboarding first",
        });
      }

      const status = await getConnectAccountStatus(stripeAccountId);
      if (!status.onboardingComplete || !status.readyToProcessPayments) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Stripe Connect onboarding is incomplete",
        });
      }

      const template = await ctx.db.book.findFirst({
        where: {
          id: input.templateId,
          createdById: user.id,
          isTemplate: true,
          deletedAt: null,
        },
        include: {
          modules: true,
        },
      });

      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      const snapshot = await ctx.db.book.create({
        data: {
          name: `sponsor-snapshot-${Date.now()}`,
          bookTitle: template.bookTitle,
          subTitle: template.subTitle,
          format: template.format,
          region: template.region,
          planStart: template.planStart,
          planEnd: template.planEnd,
          country: template.country,
          createdById: user.id,
          copyFromId: template.id,
          modules: {
            create: template.modules.map((moduleItem) => ({
              idx: moduleItem.idx,
              moduleId: moduleItem.moduleId,
              colorCode: moduleItem.colorCode,
            })),
          },
        },
      });

      const nowUnix = Math.floor(Date.now() / 1000);
      const expiresAt = nowUnix + input.validForDays * SECONDS_IN_DAY;
      const maxRedemptions = input.maxRedemptions;

      const codeFromInput = input.promoCode
        ? normalizePromoCode(input.promoCode)
        : undefined;
      let promoCode = codeFromInput ?? randomPromoCode();

      if (!CAMPAIGN_PROMO_CODE_REGEX.test(promoCode)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Promo code format is invalid",
        });
      }

      let attempts = 0;
      while (attempts < 5) {
        const existingPromotionCodes = await stripeClient.promotionCodes.list({
          code: promoCode,
          active: true,
          limit: 1,
        });

        if (existingPromotionCodes.data.length === 0) {
          break;
        }

        if (codeFromInput) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Promo code already exists",
          });
        }

        promoCode = randomPromoCode();
        attempts += 1;
      }

      if (attempts >= 5) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not generate a unique promo code",
        });
      }

      const coupon = await stripeClient.coupons.create({
        duration: "once",
        percent_off: 100,
        max_redemptions: maxRedemptions,
        redeem_by: expiresAt,
        metadata: {
          kind: CAMPAIGN_KIND,
          sponsorUserId: user.id,
          templateId: template.id,
          snapshotBookId: snapshot.id,
          sponsorAccountId: stripeAccountId,
        },
      });

      const promotion = await stripeClient.promotionCodes.create({
        promotion: {
          type: "coupon",
          coupon: coupon.id,
        },
        code: promoCode,
        max_redemptions: maxRedemptions,
        expires_at: expiresAt,
        metadata: {
          kind: CAMPAIGN_KIND,
          sponsorUserId: user.id,
          templateId: template.id,
          snapshotBookId: snapshot.id,
          sponsorAccountId: stripeAccountId,
        },
      });

      await ctx.db.campaign.create({
        data: {
          sponsorUserId: user.id,
          templateId: template.id,
          snapshotBookId: snapshot.id,
          promotionCodeId: promotion.id,
          maxRedemptions: maxRedemptions,
          expiresAt: expiresAt ? new Date(expiresAt * 1000) : null,
        },
      });

      const token = createCampaignLinkToken({
        sponsorUserId: user.id,
        templateId: template.id,
        snapshotBookId: snapshot.id,
        promotionCodeId: promotion.id,
        exp: expiresAt,
      });

      return {
        campaignId: promotion.id,
        promoCode: promotion.code,
        expiresAt,
        maxRedemptions,
        templateId: template.id,
        snapshotBookId: snapshot.id,
        token,
      };
    }),

  listCampaigns: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { role: true },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    assertSponsorRole(user.role);

    const dbCampaigns = await ctx.db.campaign.findMany({
      where: { sponsorUserId: ctx.session.user.id },
    });
    const dbCampaignMap = new Map(
      dbCampaigns.map((c) => [c.promotionCodeId, c]),
    );

    const campaigns = await stripeClient.promotionCodes.list({ limit: 100 });

    const filtered = campaigns.data.filter((campaign) =>
      isSponsorCampaignForUser(campaign, ctx.session.user.id),
    );

    return filtered.map((campaign) => {
      const metadata = campaign.metadata ?? {};
      const expiresAt = campaign.expires_at ?? undefined;
      const token = createCampaignLinkToken({
        sponsorUserId: metadata.sponsorUserId ?? "",
        templateId: metadata.templateId ?? "",
        snapshotBookId: metadata.snapshotBookId ?? "",
        promotionCodeId: campaign.id,
        exp: expiresAt,
      });

      const dbCampaign = dbCampaignMap.get(campaign.id);

      return {
        id: campaign.id,
        code: campaign.code,
        active: campaign.active,
        timesRedeemed: dbCampaign?.timesRedeemed ?? 0,
        maxRedemptions: campaign.max_redemptions,
        expiresAt,
        templateId: metadata.templateId ?? "",
        snapshotBookId: metadata.snapshotBookId ?? "",
        token,
      };
    });
  }),

  updateCampaign: protectedProcedure
    .input(
      z
        .object({
          campaignId: z.string().min(1),
          active: z.boolean().optional(),
          maxRedemptions: z
            .number()
            .int()
            .min(1)
            .max(MAX_CAMPAIGN_MAX_REDEMPTIONS)
            .optional(),
          validForDays: z
            .number()
            .int()
            .min(MIN_CAMPAIGN_VALID_DAYS)
            .max(MAX_CAMPAIGN_VALID_DAYS)
            .optional(),
        })
        .refine(
          (value) =>
            value.active !== undefined ||
            value.maxRedemptions !== undefined ||
            value.validForDays !== undefined,
          "No campaign updates provided",
        ),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { role: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      assertSponsorRole(user.role);

      const campaign = await stripeClient.promotionCodes.retrieve(
        input.campaignId,
      );
      if (!isSponsorCampaignForUser(campaign, ctx.session.user.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      const nextExpiresAt =
        input.validForDays !== undefined
          ? Math.floor(Date.now() / 1000) + input.validForDays * SECONDS_IN_DAY
          : undefined;

      // Stripe does not allow changing max redemptions/expires_at on existing promotion codes.
      // When either setting changes we rotate the campaign: deactivate old and create a new one.
      let updatedCampaign = campaign;
      if (input.maxRedemptions === undefined && nextExpiresAt === undefined) {
        updatedCampaign = await stripeClient.promotionCodes.update(
          input.campaignId,
          {
            active: input.active,
          },
        );
      } else {
        const metadata = campaign.metadata ?? {};
        const sponsorUserId = metadata.sponsorUserId ?? "";
        const templateId = metadata.templateId ?? "";
        const snapshotBookId = metadata.snapshotBookId ?? "";
        const sponsorAccountId = metadata.sponsorAccountId ?? "";

        if (
          !sponsorUserId ||
          !templateId ||
          !snapshotBookId ||
          !sponsorAccountId
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Campaign metadata is incomplete",
          });
        }

        const desiredMaxRedemptions =
          input.maxRedemptions ??
          campaign.max_redemptions ??
          DEFAULT_CAMPAIGN_MAX_REDEMPTIONS;
        const desiredExpiresAt =
          nextExpiresAt ??
          campaign.expires_at ??
          Math.floor(Date.now() / 1000) +
            DEFAULT_CAMPAIGN_VALID_DAYS * SECONDS_IN_DAY;

        const wasActive = campaign.active;
        if (campaign.active) {
          await stripeClient.promotionCodes.update(campaign.id, {
            active: false,
          });
        }

        try {
          const coupon = await stripeClient.coupons.create({
            duration: "once",
            percent_off: 100,
            max_redemptions: desiredMaxRedemptions,
            redeem_by: desiredExpiresAt,
            metadata: {
              kind: CAMPAIGN_KIND,
              sponsorUserId,
              templateId,
              snapshotBookId,
              sponsorAccountId,
            },
          });

          updatedCampaign = await stripeClient.promotionCodes.create({
            promotion: {
              type: "coupon",
              coupon: coupon.id,
            },
            code: campaign.code,
            max_redemptions: desiredMaxRedemptions,
            expires_at: desiredExpiresAt,
            metadata: {
              kind: CAMPAIGN_KIND,
              sponsorUserId,
              templateId,
              snapshotBookId,
              sponsorAccountId,
            },
          });

          if (input.active === false) {
            updatedCampaign = await stripeClient.promotionCodes.update(
              updatedCampaign.id,
              {
                active: false,
              },
            );
          }
        } catch (error) {
          if (wasActive) {
            try {
              await stripeClient.promotionCodes.update(campaign.id, {
                active: true,
              });
            } catch (reactivateError) {
              logger.error("failed_to_reactivate_replaced_campaign", {
                campaignId: campaign.id,
                error: reactivateError,
              });
            }
          }
          throw error;
        }
      }

      const metadata = updatedCampaign.metadata ?? {};
      const expiresAt = updatedCampaign.expires_at ?? undefined;
      const token = createCampaignLinkToken({
        sponsorUserId: metadata.sponsorUserId ?? "",
        templateId: metadata.templateId ?? "",
        snapshotBookId: metadata.snapshotBookId ?? "",
        promotionCodeId: updatedCampaign.id,
        exp: expiresAt,
      });

      return {
        id: updatedCampaign.id,
        code: updatedCampaign.code,
        active: updatedCampaign.active,
        timesRedeemed: updatedCampaign.times_redeemed,
        maxRedemptions: updatedCampaign.max_redemptions,
        expiresAt,
        token,
      };
    }),

  getSalesOverview: protectedProcedure.query(async ({ ctx }) => {
    try {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { role: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      assertSponsorRole(user.role);

      const dbCampaigns = await ctx.db.campaign.findMany({
        where: { sponsorUserId: ctx.session.user.id },
      });

      const campaigns = await stripeClient.promotionCodes.list({ limit: 100 });
      const ownCampaigns = campaigns.data.filter((campaign) =>
        isSponsorCampaignForUser(campaign, ctx.session.user.id),
      );

      const activeCampaignCount = ownCampaigns.filter(
        (campaign) => campaign.active,
      ).length;

      const totalRedemptions = dbCampaigns.reduce(
        (sum, campaign) => sum + campaign.timesRedeemed,
        0,
      );

      const remainingRedemptions = dbCampaigns.reduce((sum, campaign) => {
        return (
          sum + Math.max(campaign.maxRedemptions - campaign.timesRedeemed, 0)
        );
      }, 0);

      const platformInvoices = await stripeClient.invoices.list({ limit: 100 });
      const sponsorInvoices = platformInvoices.data.filter(
        (invoice) =>
          (invoice.metadata?.invoiceType ?? "") === "SPONSOR_BASE_CHARGE" &&
          (invoice.metadata?.sponsorUserId ?? "") === ctx.session.user.id,
      );

      const billedSponsorAmountCents = sponsorInvoices.reduce(
        (sum, invoice) =>
          sum + (invoice.amount_paid || invoice.amount_due || 0),
        0,
      );

      const sponsoredSessions = await stripeClient.checkout.sessions.list({
        limit: 100,
      });
      const ownSponsoredSessions = sponsoredSessions.data.filter(
        (session) =>
          (session.metadata?.sponsorFlow ?? "") === "1" &&
          (session.metadata?.sponsorUserId ?? "") === ctx.session.user.id,
      );

      const addOnRevenueCents = ownSponsoredSessions.reduce(
        (sum, session) => sum + (session.amount_total ?? 0),
        0,
      );
      const addOnOrderCount = ownSponsoredSessions.filter(
        (session) => (session.amount_total ?? 0) > 0,
      ).length;

      return {
        campaignCount: ownCampaigns.length,
        activeCampaignCount,
        totalRedemptions,
        remainingRedemptions,
        sponsorInvoiceCount: sponsorInvoices.length,
        billedSponsorAmountCents,
        sponsoredCheckoutCount: ownSponsoredSessions.length,
        addOnOrderCount,
        addOnRevenueCents,
      };
    } catch (e) {
      logger.error("get_sales_overview_error", {
        userId: ctx.session.user.id,
        error: e,
      });
      throw e;
    }
  }),

  getCampaignTemplate: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const claims = parseCampaignClaims(input.token);

      const campaign = await stripeClient.promotionCodes.retrieve(
        claims.promotionCodeId,
      );
      const metadata = campaign.metadata ?? {};

      if (metadata.kind !== CAMPAIGN_KIND) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      if (
        metadata.sponsorUserId !== claims.sponsorUserId ||
        metadata.templateId !== claims.templateId ||
        metadata.snapshotBookId !== claims.snapshotBookId
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Campaign metadata mismatch",
        });
      }

      const template = await ctx.db.book.findFirst({
        where: {
          id: claims.snapshotBookId,
          deletedAt: null,
        },
        include: {
          modules: {
            include: {
              module: {
                include: {
                  files: true,
                },
              },
            },
          },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign template no longer exists",
        });
      }

      return {
        template,
        campaign: {
          promotionCodeId: campaign.id,
          expiresAt: campaign.expires_at,
          active: campaign.active,
        },
      };
    }),

  redeemCampaign: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        promoCode: z.string().min(1),
        email: z.string().email().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      enforceProcedureRateLimit(ctx, {
        scope: "sponsor.redeemCampaign",
        maxRequests: 10,
        windowMs: 10 * 60 * 1000,
      });

      const claims = parseCampaignClaims(input.token);
      const normalizedCode = normalizePromoCode(input.promoCode);

      const sessionEmail = ctx.session?.user?.email ?? null;
      const userProvidedEmail = input.email?.trim().toLowerCase();

      const resolvedEmail = sessionEmail ?? userProvidedEmail;
      if (!resolvedEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "E-Mail-Adresse ist erforderlich",
        });
      }

      const user = ctx.session?.user
        ? await ctx.db.user.findUnique({
            where: { id: ctx.session.user.id },
          })
        : await ctx.db.user.upsert({
            where: { email: resolvedEmail },
            create: { email: resolvedEmail },
            update: {},
          });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (user.id === claims.sponsorUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Sie können diesen Code nicht selbst einlösen",
        });
      }

      const campaign = await stripeClient.promotionCodes.retrieve(
        claims.promotionCodeId,
      );
      const metadata = campaign.metadata ?? {};

      if (metadata.kind !== CAMPAIGN_KIND) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      if (!campaign.active) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Promo code is no longer active",
        });
      }

      if (normalizePromoCode(campaign.code) !== normalizedCode) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Promo code is invalid" });
      }

      if (
        campaign.expires_at &&
        campaign.expires_at < Math.floor(Date.now() / 1000)
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Promo code has expired" });
      }

      if (
        campaign.max_redemptions &&
        campaign.times_redeemed >= campaign.max_redemptions
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Promo code has already been used",
        });
      }

      if (
        metadata.sponsorUserId !== claims.sponsorUserId ||
        metadata.templateId !== claims.templateId ||
        metadata.snapshotBookId !== claims.snapshotBookId
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Promo campaign mismatch",
        });
      }
      const clonedBook = await ctx.db.$transaction(async (tx) => {
        const dbCampaign = await tx.campaign.findUnique({
          where: { promotionCodeId: claims.promotionCodeId },
        });
        if (!dbCampaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campaign not found",
          });
        }
        if (
          dbCampaign.expiresAt &&
          dbCampaign.expiresAt.getTime() < Date.now()
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Promo code has expired",
          });
        }
        const incremented = await tx.campaign.updateMany({
          where: {
            promotionCodeId: claims.promotionCodeId,
            timesRedeemed: {
              lt: dbCampaign.maxRedemptions,
            },
          },
          data: {
            timesRedeemed: {
              increment: 1,
            },
          },
        });
        if (incremented.count !== 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Promo code has already been used",
          });
        }

        const snapshotTemplate = await tx.book.findFirst({
          where: {
            id: claims.snapshotBookId,
            deletedAt: null,
          },
          include: {
            modules: true,
          },
        });

        if (!snapshotTemplate) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campaign template no longer exists",
          });
        }

        return tx.book.create({
          data: {
            name: Naming.sponsor(snapshotTemplate.name),
            bookTitle: snapshotTemplate.bookTitle,
            subTitle: snapshotTemplate.subTitle,
            format: snapshotTemplate.format,
            region: snapshotTemplate.region,
            planStart: snapshotTemplate.planStart,
            planEnd: snapshotTemplate.planEnd,
            country: snapshotTemplate.country,
            copyFromId: snapshotTemplate.id,
            createdById: user.id,
            modules: {
              create: snapshotTemplate.modules.map((moduleItem) => ({
                idx: moduleItem.idx,
                moduleId: moduleItem.moduleId,
                colorCode: moduleItem.colorCode,
              })),
            },
          },
        });
      });

      const sponsoredCheckoutToken = createSponsoredCheckoutToken({
        sponsorUserId: claims.sponsorUserId,
        templateId: claims.templateId,
        snapshotBookId: claims.snapshotBookId,
        promotionCodeId: claims.promotionCodeId,
        promotionCode: campaign.code,
        exp: Math.min(
          campaign.expires_at ??
            Math.floor(Date.now() / 1000) + SECONDS_IN_YEAR,
          Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
        ),
      });

      return {
        bookId: clonedBook.id,
        sponsorCheckoutToken: sponsoredCheckoutToken,
      };
    }),
});
