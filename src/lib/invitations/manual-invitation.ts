export function createManualInvitation(origin: string, token: string) {
  const appOrigin = origin.replace(/\/$/, '')

  return {
    delivery: 'manual' as const,
    inviteLink: `${appOrigin}/organizer/accept?token=${encodeURIComponent(token)}`,
  }
}
