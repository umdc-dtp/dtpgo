import { createManualInvitation } from './manual-invitation'

describe('createManualInvitation', () => {
  it('returns a shareable organizer acceptance link without email delivery metadata', () => {
    expect(createManualInvitation('https://dtp.example.edu', 'token/value')).toEqual({
      delivery: 'manual',
      inviteLink: 'https://dtp.example.edu/organizer/accept?token=token%2Fvalue',
    })
  })

  it('removes a trailing slash from the application origin', () => {
    expect(createManualInvitation('https://dtp.example.edu/', 'token').inviteLink).toBe(
      'https://dtp.example.edu/organizer/accept?token=token'
    )
  })
})
