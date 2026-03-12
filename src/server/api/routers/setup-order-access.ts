export function canAccessBookForSetupOrder(params: {
  bookOwnerId: string | null;
  sessionUserId?: string;
  bookSourceType?: "STANDARD" | "PARTNER_TEMPLATE";
  partnerClaimUserId?: string | null;
  isPublic?: boolean;
}): boolean {
  const {
    bookOwnerId,
    sessionUserId,
    bookSourceType,
    partnerClaimUserId,
    isPublic,
  } = params;

  if (isPublic) {
    return true;
  }

  if (bookSourceType === "PARTNER_TEMPLATE") {
    if (!sessionUserId) {
      return false;
    }
    if (!partnerClaimUserId || partnerClaimUserId !== sessionUserId) {
      return false;
    }
    if (bookOwnerId && bookOwnerId !== sessionUserId) {
      return false;
    }
    return true;
  }

  if (!bookOwnerId) {
    return true;
  }
  return bookOwnerId === sessionUserId;
}
