# Stripe Connect Sponsoring Rollout

This project now supports:
- Sponsor onboarding via Stripe Connect.
- Sponsored template campaigns (`/template` link + promo code).
- School checkout charging only add-on modules.
- Sponsor base invoice plus commercial 0.00 proof invoice (Invoice C).

## Environment

Set these variables before production rollout:

```env
# Existing
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
BASE_APP_URL=https://your-platform.example

# Connect thin webhook
STRIPE_CONNECT_THIN_WEBHOOK_SECRET=whsec_xxx

# Subscription webhook
STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_xxx

# Connect subscription UI
STRIPE_CONNECT_SUBSCRIPTION_PRICE_ID=price_xxx

# Optional platform fee for direct charges (in cents)
STRIPE_CONNECT_APPLICATION_FEE_CENTS=123

# Optional, defaults to AT
STRIPE_CONNECT_COUNTRY=AT
```

## Webhook Endpoints To Configure

You need **three** webhook destinations in Stripe Dashboard.

### 1) Platform checkout webhook
- URL: `https://<your-domain>/api/stripe/webhook`
- Payload style: standard (not thin)
- Events:
- `checkout.session.completed`

Purpose:
- Backstop invoice creation for sponsored orders after checkout completion.

### 2) Connect thin requirements webhook
- URL: `https://<your-domain>/api/stripe/connect-thin-webhook`
- Events from: Connected accounts
- Payload style: Thin
- Events:
- `v2.core.account[requirements].updated`
- `v2.core.account[configuration.merchant].capability_status_updated`
- `v2.core.account[configuration.customer].capability_status_updated`
- `v2.core.account[.recipient].capability_status_updated`

Purpose:
- Keep requirement/capability status current for sponsor accounts.

### 3) Subscription/billing webhook
- URL: `https://<your-domain>/api/stripe/subscription-webhook`
- Payload style: standard (not thin)
- Events:
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `payment_method.attached`
- `payment_method.detached`
- `customer.updated`
- `customer.tax_id.created`
- `customer.tax_id.deleted`
- `customer.tax_id.updated`
- `billing_portal.configuration.created`
- `billing_portal.configuration.updated`
- `billing_portal.session.created`
- `invoice.paid`

Purpose:
- Persist latest subscription state for connected account dashboards.

## Localhost Setup

Yes, set up localhost separately for development and testing.

Use Stripe CLI listeners and copy generated secrets into `.env`:

```bash
# Platform checkout webhook (standard events)
stripe listen \
  --events checkout.session.completed \
  --forward-to http://localhost:3000/api/stripe/webhook
```

```bash
# Thin events for Connect v2 requirements/capabilities
stripe listen \
  --thin-events 'v2.core.account[requirements].updated,v2.core.account[.recipient].capability_status_updated,v2.core.account[configuration.merchant].capability_status_updated,v2.core.account[configuration.customer].capability_status_updated' \
  --forward-thin-to http://localhost:3000/api/stripe/connect-thin-webhook
```

```bash
# Subscription and billing events
stripe listen \
  --events customer.subscription.updated,customer.subscription.deleted,payment_method.attached,payment_method.detached,customer.updated,customer.tax_id.created,customer.tax_id.deleted,customer.tax_id.updated,billing_portal.configuration.created,billing_portal.configuration.updated,billing_portal.session.created,invoice.paid \
  --forward-to http://localhost:3000/api/stripe/subscription-webhook
```

## Multiple Domains

Stripe webhook destination URLs are single-URL entries.

If your platform runs on multiple domains, choose one of these:
- Use one canonical backend domain for all Stripe webhooks (recommended).
- Create separate webhook destinations per domain.

For reliability and simpler operations, prefer one canonical webhook domain.

## End-to-End Dry Run Checklist

1. Create/confirm sponsor user and click `Sponsor werden`.
2. Complete Connect onboarding and confirm role becomes `SPONSOR`.
3. Sponsor creates template and campaign, receives promo link + code.
4. School opens `/template?t=...`, enters promo code, gets cloned config.
5. School adds modules and checks out.
6. Validate pricing:
- Only module diff from base template is charged.
- Checkout line item name is `Add-on Module`.
- If no add-ons, checkout is skipped and order succeeds.
7. Validate invoices:
- Sponsor invoice for base planner amount is created/sent.
- Invoice C (0.00 commercial proof) is created/sent on connected account.
8. Validate webhook backstops:
- `checkout.session.completed` triggers sponsor invoice backstop.
- Thin account updates persist account requirement snapshots.
- Subscription events persist subscription status snapshots.

