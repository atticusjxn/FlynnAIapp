# Integrations

## Goal
A consistent, on-brand page (web + app) where users connect, manage, and disconnect integrations. OAuth flows all route through the same web surface. Every integration uses real brand SVGs.

## Integration Catalogue

### Tier 1 — High leverage, suggest to everyone
| Integration | Auth type | Value |
|---|---|---|
| Google Calendar | OAuth | Book jobs, check availability, propose slots |
| Apple Calendar | EventKit (iOS) | Same as above for Apple users |
| Gmail | OAuth | Draft email replies, flag important leads |

### Tier 2 — Suggest based on vertical
| Integration | Auth type | Vertical |
|---|---|---|
| Xero | OAuth | Invoicing (tradies, freelancers) |
| MYOB | OAuth | Invoicing (AU/NZ alternative) |
| Reece | Credentials | Parts ordering (plumbers) |
| Tradelink | Credentials | Parts ordering (electricians) |
| Stripe | OAuth | Payment links, invoice collection |
| Jobber | OAuth | Job management |
| ServiceM8 | OAuth | Job management (AU tradies) |

### Tier 3 — Power users / later
| Integration | Auth type | Value |
|---|---|---|
| Instagram | OAuth | Turn job photos into posts |
| Dropbox/Google Drive | OAuth | Store quotes, job docs |
| ATO / Xero Tax | OAuth | Tax-ready expense tracking |

## Web Dashboard — /dashboard/integrations

Clean card grid. Each integration card shows:
- Real brand SVG logo (sourced from official brand kits or SVGRepo)
- Status: Connected (green) / Not connected (grey) / Error (red)
- Connected account name/email when active
- Connect / Disconnect button
- Brief one-line value description ("Books jobs into your calendar")

On "Connect": opens OAuth flow in same tab (no popup) → redirects back to dashboard on success.
On "Disconnect": confirmation inline, no modal.

### Routes
```
GET  /dashboard/integrations          — main grid
GET  /auth/google/calendar            — OAuth start
GET  /auth/google/calendar/callback   — OAuth callback
GET  /auth/google/gmail               — OAuth start
GET  /auth/google/gmail/callback
GET  /auth/xero                       — OAuth start
GET  /auth/xero/callback
POST /auth/credentials/reece          — save encrypted credentials
```

All OAuth tokens stored in `user_integrations` table, encrypted at rest.

## iOS App — Integrations tab

Same integration cards, native SwiftUI. Tapping "Connect" opens `ASWebAuthenticationSession` for OAuth flows (keeps user in app). Apple Calendar uses EventKit directly — no OAuth, just a permission prompt.

## SMS-driven connection flow

When Flynn detects a needed integration mid-conversation:
> "to do that i need your google calendar. connect it here: flynnai.app/auth/google/calendar?token=xyz"

Token is a short-lived signed JWT that pre-identifies the user so they don't need to log in. On callback: save token, text them:
> "calendar connected. give me a sec..."
> "you've got henderson on thursday 2pm and a gap friday morning — want me to offer that to your next lead?"

## Brand SVG sources
- Google: official Google Brand Resource Centre
- Apple: SF Symbols / Apple HIG assets
- Xero: Xero Brand Hub (xero.com/us/resources/xero-brand-hub)
- Stripe: stripe.com/newsroom/brand-assets
- Jobber: getjobber.com/press
- Others: SVGRepo / Clearbit Logo API as fallback

No icon fonts, no raster logos — SVG only, so they scale cleanly on all surfaces.
