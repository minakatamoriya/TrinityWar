export function readCampaignIdFromFriendInviteUrl(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).searchParams.get('campaignId');
  } catch {
    return null;
  }
}
