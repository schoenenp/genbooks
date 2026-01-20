import Stripe from 'stripe'
import { env } from '@/env';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
});

export function toStripeAddress(address: {
  streetNr: string;
  street: string;
  optional?: string;
  state?: string;
  city: string;
  zip: string;
  country?: string;
}) {
  const { city, country, streetNr, street, optional, zip, state } = address
  return {
    city,
    country: country ?? "DE",
    line1: `${streetNr}, ${street}`,
    state,
    line2: `${optional}`,
    postal_code: zip
  }
}

