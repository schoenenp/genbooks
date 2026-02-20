export function canAccessBookForSetupOrder(params: {
  bookOwnerId: string | null;
  sessionUserId?: string;
}): boolean {
  const { bookOwnerId, sessionUserId } = params;
  if (!bookOwnerId) {
    return true;
  }
  return bookOwnerId === sessionUserId;
}

