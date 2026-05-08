# Airtable Schema for Flynn GTM Ops

Create one base named **Flynn GTM**. It needs three tables.

## Table 1: `FBGroups`

| Field | Type | Notes |
|---|---|---|
| Name | Single line text | Primary field. e.g. "Plumbers Australia" |
| URL | URL | Direct link to FB group |
| MemberCount | Number | Approx. members |
| Industry | Single select | trades / beauty / hospitality / general / health |
| Region | Single select | AU / NZ / US / UK / Global |
| LastPostedAt | Date | Updated each time you post |
| LastPostType | Single select | VALUE_QUESTION / CASE_STUDY / GENUINE_HELP / NONE |
| Status | Single select | active / banned / restricted / pending-approval |
| Notes | Long text | Mod rules, posting cadence, etc. |
| Joined | Checkbox | Are you a member? |

**Filtering rule used by morning-brief**: surface 5 groups where `Joined = true`, `Status = active`, `LastPostedAt` is null OR > 7 days ago. Rotate post type so we don't post `VALUE_QUESTION` two days in a row in the same group.

## Table 2: `IGTargets`

| Field | Type | Notes |
|---|---|---|
| Handle | Single line text | Primary field. e.g. "@sparky_sister_au" |
| ProfileURL | URL | Auto-derived from handle |
| FollowerCount | Number | Approx., updated weekly |
| Industry | Single select | trades / beauty / hospitality / general |
| Persona | Single select | tradie-influencer / business-owner / industry-page / educator |
| Region | Single select | AU / NZ / US / UK / Global |
| Email | Email | If discoverable from bio |
| Status | Single select | not-contacted / dm-sent / replied / partnership-active / declined |
| LastDMAt | Date | Auto-set when surfaced (manual confirm) |
| LastDMScript | Single select | REV_SHARE / FREE_MONTH / FEEDBACK / NONE |
| ReplyAt | Date | Manual when they reply |
| Notes | Long text | Their angle, content style, etc. |

**Filtering rule used by morning-brief**: surface 18 targets where `Status = not-contacted` OR (`Status = dm-sent` AND `LastDMAt > 5 days ago` AND no reply). Mix industries: 60% trades, 25% beauty, 15% other. Rotate scripts: 50% REV_SHARE, 30% FREE_MONTH, 20% FEEDBACK.

## Table 3: `DailyLog`

| Field | Type | Notes |
|---|---|---|
| Date | Date | Primary field |
| TrialStarts | Number | From RevenueCat events |
| TrialStartsBreakdown | Long text | JSON: {coldEmail: 2, igDm: 1, organic: 1, paidAds: 0} |
| PaidConversions | Number | RevenueCat trial→paid in last 24h |
| RevenueAdded | Currency | USD or AUD, your choice |
| RunningTotal | Number | Cumulative paid customers from 8 May 2026 |
| CACBlended | Currency | (sum of paid spend last 7 days) / (paid customers last 7 days) |
| ColdEmailsSent | Number | From Instantly API |
| ColdEmailReplies | Number | From Instantly API |
| IGDMsSent | Number | Manual count from previous day |
| IGDMReplies | Number | Manual count |
| FBPostsMade | Number | Manual count |
| Notes | Long text | Anomalies, qualitative observations |

**Filled by morning-brief script before sending the email.** Populates "Yesterday" section + powers the running total.

## Optional Table 4: `LeadScrapes` (if you want history)

| Field | Type |
|---|---|
| ScrapeDate | Date |
| Industry | Single select |
| City | Single line text |
| LeadCount | Number |
| InstantlyUploadStatus | Single select: pending / success / failed |
| ApifyRunId | Single line text |

Skip this if you trust Instantly's history view.

## Setup tips

- In `IGTargets`, add a formula field: `ProfileURL = "https://instagram.com/" & SUBSTITUTE(Handle, "@", "")` — so the script can link directly.
- Create a view called `Today's Surface` for `IGTargets` that pre-applies the filtering rule above. The script can hit that view by name and skip filter logic.
- Same for `FBGroups`: view `Today's Groups`.

## API setup

1. Generate a personal access token at airtable.com/create/tokens with `data.records:read`, `data.records:write` scope on this base.
2. Note the base ID (starts with `app...`) from the API docs page for your base.
3. Set env: `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID`.
