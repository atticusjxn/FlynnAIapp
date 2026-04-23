# Flynn — remaining manual setup

The automated setup (via the Supabase MCP, Chrome MCP, and local scripts) has
taken you as far as it can. The steps below are the ones I couldn't finish
from my side — either because they needed a Chrome profile I couldn't reach
(**admin@mates-rates.app** in "Mates Rates") or because they involve uploading
audio.

When each step is done, paste the values into `.env` at repo root (already
gitignored). I'll pick them up next session.

---

## 1. Telnyx — buy an AU local number

**Why this matters:** this is the number callers will be forwarded to. Without
it, inbound calls go nowhere.

1. In the **Mates Rates** Chrome profile → open <https://portal.telnyx.com/#/numbers/my-numbers/buy>
2. Set **Country → Australia +61**, leave other filters default, click **Search Numbers**
3. Pick any **Local** number (not toll-free). Confirm price ≤ **US$0.0075/min** inbound
4. During purchase, attach it to the **"Flynn AU SMS"** Messaging Profile
   (already exists — id `40019db3-4d1f-49f8-bf8a-785c40ed46d5`)
5. Copy the E.164 number (e.g. `+61280044455`) and paste into `.env`:
   ```
   TELNYX_PHONE_NUMBER=+61280044455
   ```

## 2. Telnyx — create a Voice (Call Control) Application

**Why this matters:** this is what routes inbound calls on the AU number into
our webhook so our IVR + AI receptionist can answer.

1. In Mates Rates → <https://portal.telnyx.com/#/voice/call-control>
2. **Create Application** → Name: `Flynn Voice Agent`
3. Leave the webhook URL blank for now (we'll fill it in when the backend is
   deployed — probably `https://<your-domain>/webhooks/telnyx/voice`)
4. Save. Copy the **Application ID** (also called Connection ID — a UUID) into
   `.env`:
   ```
   TELNYX_CONNECTION_ID=<application-id>
   ```
5. Go back to your AU number in **Numbers** → edit → **Voice settings** →
   attach to the `Flynn Voice Agent` application. Save.

## 3. Telnyx — copy the webhook signing secret

1. Mates Rates → Account Settings → Security → **Public Key**
2. Copy the base64 public key (starts with `-----BEGIN PUBLIC KEY-----` on the
   export, but copy the raw base64 body) into `.env`:
   ```
   TELNYX_WEBHOOK_SIGNING_SECRET=<base64 body>
   ```

## 4. Cartesia — clone an Australian male voice

Cartesia's public library currently has **one** AU voice — Grace (female).
Cloning your own AU male unlocks Mode B for any business that wants a male
receptionist.

1. Record ~55 seconds of yourself reading the script below. Use a quiet room,
   a decent mic (headset mic is fine), no background music.
2. Go to <https://play.cartesia.ai/instant-clone>
3. Name it `Flynn AU Male` → upload the recording → **Clone**
4. Open the cloned voice → copy its UUID → paste into `.env`:
   ```
   CARTESIA_VOICE_AU_MALE=<uuid>
   ```
5. Then run (I can do this once you paste the UUID):
   ```sql
   update public.voice_profiles
   set provider_voice_id = '<uuid>',
       display_name = 'Flynn — Australian Male (Cloned)',
       is_preset = true
   where slug = 'au_male_default';
   ```

### Voice-clone script (read this aloud, ~55 seconds)

Speak naturally — slightly slower than your usual cadence, clear but not
stilted. Mix statement and question intonation so the clone picks up rising
Australian inflection. No need to act; just be yourself.

> G'day, thanks for calling. You've reached Flynn's — I'm probably on the tools
> right now, so I can't come to the phone.
>
> I'll keep this short. If you want to book a job, I can text you a booking
> link and you can pick a time that suits. If you're after a quote, I'll send
> through a quick form where you can drop in the details and a couple of
> photos, and I'll get back to you by end of day.
>
> The most common jobs we take on are hot water repairs, blocked drains,
> bathroom refits, and after-hours emergencies. Standard call-outs are around
> one-ten, and we service the inner city plus the eastern suburbs.
>
> Alright, talk soon — cheers.

**Why these choices:** includes long AU vowels ("short", "tools", "form"),
contractions ("G'day", "you're"), rising-terminal questions, tradie-specific
vocabulary ("call-outs", "refits"), and place references ("eastern suburbs")
that Cartesia's clone engine latches onto for accent. ~130 words / 55s at
natural speed.

---

## 5. Supabase service role key

Backend writes subscription rows + pushes with admin privileges.

1. Supabase dashboard → Project Settings → API → **service_role** key
2. Paste into `.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=<key>
   ```

## 6. App Store Connect — subscription products

Flynn ships 3 auto-renewable subscriptions via Apple IAP with a 14-day free
trial. You need a paid Apple Developer account to set these up. Everything
below is manual in App Store Connect; once done, the iOS app picks the
products up automatically via StoreKit 2.

1. **Paid Apps Agreement** → Apple Developer → Agreements, Tax & Banking.
   Accept the Paid Apps agreement, add banking + tax info. Without this,
   products won't be purchasable even in sandbox.
2. **App Store Connect → My Apps → FlynnAI → Monetization → Subscriptions**
   → Create a **Subscription Group** called `Flynn Subscription`.
3. In that group, add three auto-renewable subscriptions:

   | Reference name | Product ID (must match!) | Price (AUD) | Duration |
   |---|---|---|---|
   | Flynn Starter Monthly | `com.flynnai.starter.monthly` | $29 | 1 month |
   | Flynn Growth Monthly  | `com.flynnai.growth.monthly`  | $79 | 1 month |
   | Flynn Pro Monthly     | `com.flynnai.pro.monthly`     | $179 | 1 month |

4. On each subscription: **Subscription Prices** → set the **Australian**
   price tier (AUD) matching the table above. Apple will auto-convert for
   other territories — that's fine for launch.
5. On each subscription: **Introductory Offers** → **Create Introductory
   Offer** → type **Free**, duration **2 weeks**, country **Australia** (or
   All). "Available to: New subscribers" only.
6. On each subscription: **Localizations** → add AU English copy. Display
   name matches the Flynn-side `plans.display_name`.
7. **Sandbox Testers** → Users and Access → Sandbox → add at least one
   tester Apple ID (not your real one) so you can trial the purchase flow
   without being charged.
8. **App Store Connect API** (needed by the backend verifier):
   - Users and Access → Integrations → App Store Connect API → Generate Key
     with role **Admin** or **App Manager**.
   - Download the `.p8` key ONCE (can't be re-downloaded).
   - Capture **Key ID** (10 chars), **Issuer ID** (UUID) and paste into `.env`:
     ```
     APPSTORE_ISSUER_ID=<uuid>
     APPSTORE_KEY_ID=<10-char>
     APPSTORE_PRIVATE_KEY_PATH=/absolute/path/to/AuthKey_XXXXXXXXXX.p8
     APPSTORE_BUNDLE_ID=com.flynnai.app.native
     ```
9. **App Store Server Notifications v2**: App Information → App Store Server
   Notifications → Production Server URL + Sandbox Server URL →
   `https://flynnai.app/webhooks/appstore`. Save. Apple will send test pings.

Once 1–9 are done, tell me "App Store products live" and I'll run the
Supabase seed confirming `plans.apple_product_id` matches the IDs above,
then deploy the backend verifier.

## 7. APNs Auth Key

For push notifications (new call captured, usage warnings, trial ending).

1. Apple Developer → Certificates, Identifiers & Profiles → **Keys** → **+**
2. Name it `Flynn APNs`, tick **Apple Push Notifications service (APNs)**,
   Continue, Register, Download the `.p8`.
3. Capture the **Key ID** (10 chars) and note your **Team ID** (top-right of
   the portal).
4. Paste into `.env`:
   ```
   APNS_AUTH_KEY_PATH=/absolute/path/to/AuthKey_XXXXXXXXXX.p8
   APNS_KEY_ID=<10-char>
   APNS_TEAM_ID=<team-id>
   APNS_BUNDLE_ID=com.flynnai.app.native
   APNS_PRODUCTION=0   # flip to 1 when shipping via TestFlight/App Store
   ```
5. Apple Developer → Identifiers → `com.flynnai.app.native` → edit →
   enable **Push Notifications** capability. Save.
6. In Xcode (after xcodegen): Signing & Capabilities → + Capability →
   Push Notifications. Also add Background Modes → Remote notifications.

On-device testing requires a real iPhone (not the Simulator — APNs pushes
don't reach simulators). TestFlight build is easiest.

---

## What happens after you paste these in

When 1–5 are done you can ship Mode A (SMS links) end-to-end.
When 6–7 are done you can ship Mode B (AI receptionist) with subscriptions
and push notifications.

Cartesia AU male clone (§4) is independent — the app gracefully falls back
to Grace (female) until you clone.
