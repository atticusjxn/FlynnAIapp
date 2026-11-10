# Batch 1 — AI b-roll shot list (kie.ai API)

Pipeline per shot: **nano-banana-pro** start frame (18 cr) → **bytedance/seedance-2-5**
image-to-video via `first_frame_url`, 5s @720p, `generate_audio: true` where sound
matters. Driver: `tools/kie.py` + `tools/batch_frames.py`. Generate 2 takes per shot,
keep the better.

**FORMAT RULE: everything is 9:16 vertical.** No 16:9, no stacking-panel generation in
batch 1 — full-frame feed-native vertical only.

**FEED-NATIVE RULE (learned from S1 test, 13 Aug):** the first "35mm film still / wide
shot" take came out cinematic — an ad, not a post. Banned cues: *35mm, film still,
wide shot, cinematic, drone footage, golden-hour flare, documentary*. Every start-frame
prompt is written as a **phone photo a tradie took**: "vertical phone photo taken
one-handed", slightly tilted, cluttered real environment, ordinary/ugly light,
"unedited, no color grading, the kind of photo posted straight to a story."

## Prompt doctrine v2 (practitioner frameworks — see tools/reference/, 13 Aug)

Sources: michaelczesun/claude-ai-ugc-diy (7-block UGC formula), smixs/visual-skills
(Seedance 2.5 deep reference), Creatify ai-ad-prompt-guide. Copies in `tools/reference/`.

**Still image = one prose paragraph, 7 blocks in order:**
1. *Format anchor* — "iPhone rear-camera photo taken by a workmate, vertical 9:16
   frame grab, casual handheld"
2. *Character anchor* — SPECIFIC: age + trade + place + task ("a 38-year-old roof
   plumber on a Brisbane job"), never "a tradie"
3. *The moment* — what's happening, one beat
4. *Scene & light* — unglamorous, specific: flat overcast, harsh midday, fluoro.
   **Golden hour is an AI signature — banned.**
5. *Camera imperfection block (mandatory)* — off-center framing, slight tilt, mild
   overexposure, faint sensor grain, soft focus at one edge, motion blur on the
   moving part
6. *Skin/texture realism block (mandatory)* — visible pores, sun-weathered forearms,
   uneven skin tone, dust on the shirt (NEVER acne/blemishes)
7. *Negative tail (mandatory, at the END)* — "No subtitles, no captions, no text
   overlays, no UI elements, no watermark."

**Trigger words → artifacts (confirmed):** GoPro/action-cam/ultra-wide/0.5x →
fisheye circle · screen-recording/viewfinder/REC/camcorder/"raw unedited footage" →
fake UI + timestamps · 8K/hyperrealistic/cinematic/masterpiece → gloss · numeric
lens specs (50mm, f/2.8) → ignored by Nano Banana, use words. Describe what IS in
frame; on 2.0-class models "mentions summon" — the negative tail is reliable on
Nano Banana Pro and Seedance 2.5 only.

**Phones must read as current iPhones:** name the geometry — "current-generation
iPhone, flat matte edges, edge-to-edge display, Dynamic Island cutout, large
triple-lens camera module top-left" — or better, pass a real photo via
`image_input` as a reference. Lock the phone at the still; in the motion prompt
it is only "the phone from the input still, unchanged."

**Motion prompt (Seedance 2.5 i2v) = 5 blocks:** format anchor ("The shot continues
directly from the input still") → 3-4 body-part-specific motion cues (fights the
mannequin look) → the object beat as a CAUSE→CONSEQUENCE chain with a declared end
state ("his grip slips, the phone rotates once in the air, lands corner-first on
the concrete with <a hard plastic clack>, bounces once, settles screen-up — the
phone must not bend, morph, or clip through his fingers") → camera ("handheld with
subtle natural sway, no cuts, no zoom") + constant lighting → audio (`< >` = SFX)
and the same negative tail. One core action + one camera move per ≥3s window.
Slow everything — AI motion runs fast by default.

**2–4 usable seconds per clip is success.** Trim to the stable window; never use a
clip's warpy tail.

## Slop guards (apply to every generation)

- **No AI faces doing dialogue.** Frame hands, tools, backs, silhouettes. A face may
  appear in profile/mid-distance but must never mouth words.
- AU-specific art direction in every start frame: hi-vis workwear, weatherboard/brick
  suburban houses, Hilux/Ranger-style ute.
- Negative prompt on everything: `text, captions, watermark, logo, extra fingers,
  morphing hands, American pickup truck, US road signs, 3D, cartoon`.
- Consistency: generate S1's start frame first, then reuse the same character/wardrobe
  description verbatim in S2–S5 (or feed S1's frame as a reference image).

## Shots

**S1 — under the sink, phone rings on toolbox (hero hook)**
Start frame: "Vertical phone photo taken one-handed by a tradie: his mate in navy work
shirt and hi-vis on his back half under a laundry sink, work boots toward camera, a
phone face-up on a red toolbox nearby, cleaning products and a bucket cluttering the
floor. Slightly tilted framing, ordinary indoor light, unedited, no color grading,
the kind of photo posted straight to a story." *(= S1-feedtest.png, approved look)*
Motion (audio on): "The phone on the toolbox lights up and vibrates against the metal.
He keeps working under the sink. Handheld phone camera, small natural shake, no zoom."

**S2 — hands on the tools, mid-job (hero mid)**
Start frame: "Vertical phone photo shot close and one-handed: weathered tradesman's
hands tightening a PVC pipe fitting with a wrench under a sink, hi-vis sleeve, teflon
tape and offcuts scattered around, visible skin texture. Slightly awkward angle,
ordinary indoor light, unedited, like a progress pic sent to a group chat."
Motion (audio off): "The hands work the wrench in a steady rhythm. Handheld phone
camera held still, no zoom."

**S3 — loading the ute, knock-off (hero/money close)**
Start frame: "Vertical phone photo from a front porch: a tradie in hi-vis and shorts
carrying a toolbox toward his white dual-cab ute parked on a quiet suburban
Australian street, weatherboard house edge in frame, bins on the kerb. Slightly
tilted, late afternoon light, unedited, ordinary."
Motion (audio on): "He loads the toolbox onto the ute tray and shuts the tailgate.
Handheld phone camera with small natural shake, no zoom."

**S4 — knock-off, checking the phone (money close)**
Start frame: "Vertical phone photo taken from beside him: a tradie sitting on his ute
tray at dusk looking at his phone, screen just a soft unreadable glow, esky beside
him, street lights coming on behind. A little underexposed, grainy, flash off,
unedited, candid."
Motion (audio off): "He tilts the phone slightly and nods, relaxed. Phone camera held
still, screen stays a soft glow, no zoom." *(Nothing composited onto the screen — the
real app capture carries product truth.)*

**S5 — ringing phone in-scene, close (hero alt hook, policy-safe)**
Start frame: "Vertical phone photo shot close: a phone face-down on sawdusty timber
beside a circular saw on a cluttered workbench, single harsh work-lamp, offcuts and a
tape measure in frame. Ordinary, unedited, slightly out of focus at the edges."
Motion (audio on): "The phone vibrates against the timber, sawdust jumping with each
buzz. Phone camera held close and still, no zoom."

**RETIRED 13 Aug:** the S7 fisheye POV (0.5x = confirmed fisheye trigger, read as
slop) and the original S1 under-sink figure (uncanny body pose). Replaced by the
ladder phone-drop sequence below — a scripted beat, not ambient b-roll.

**L1 — on the ladder, phone buzzes, he reaches for it (hero hook, priority)**
Start frame (7-block): "iPhone rear-camera photo taken from the lawn by a workmate,
vertical 9:16 frame grab, casual handheld. A 38-year-old Australian roof plumber in
a faded orange hi-vis shirt and navy work shorts stands two-thirds up an aluminium
extension ladder leaning against the gutter of a single-storey brick house, both
hands on the rails, a phone outline in his hi-vis chest pocket. He is mid-job,
about to step onto the roof. Flat overcast midday light, dull pre-rain sky, a green
wheelie bin and trailer edge visible in the driveway. Framing slightly off-center
with a small tilt, mild overexposure on the hi-vis, faint sensor grain, soft focus
at the bottom edge. Sun-weathered forearms with visible skin texture, dust on the
shirt. No subtitles, no captions, no text overlays, no UI elements, no watermark."
Motion (audio on): "The shot continues directly from the input still. <A muffled
phone buzz repeats from his chest pocket.> He steadies himself on the ladder with
his left hand, glances down, pulls the phone from the chest pocket with his right
hand — the pocket flap lifts and falls back, the phone stays rigid, one continuous
object. He tilts it toward his face; his grip slips and the phone tumbles out of
his hand and falls out of the bottom of the frame. The phone must not bend, morph,
or clip through his fingers. Camera handheld with subtle natural sway, no cuts, no
zoom. Lighting constant, flat overcast. No subtitles, no captions, no on-screen
text, no watermarks."

**L2 — the phone hits the driveway (match-cut beat → founder cut-in)**
Start frame: "iPhone photo shot from knee height on a concrete driveway, vertical
9:16 frame grab, casual handheld. Bare concrete fills the lower half of frame with
the aluminium feet and bottom rungs of an extension ladder a metre away, a garden
hose and a few gum leaves nearby, the brick house wall soft in the background.
Flat overcast midday light. Framing slightly off-center, faint sensor grain, soft
focus at the top edge. No subtitles, no captions, no text overlays, no UI
elements, no watermark."
Motion (audio on): "The shot continues directly from the input still. A
current-generation iPhone falls into frame from above, rotating once, and lands
corner-first on the concrete with <a hard plastic clack>, bounces once, and
settles face-up, screen glowing with an incoming call. The phone must not bend or
morph, and the concrete stays static. Camera handheld, held low and still, no
cuts, no zoom. No subtitles, no captions, no on-screen text, no watermarks."
*(The founder cut-in lands on the clack — CapCut cut at impact.)*

**S6 — passenger-seat drive (spare / week 2)**
Start frame: "Vertical phone video still shot from the passenger seat of a ute driving
a suburban Australian street, dashboard and windscreen edge in frame, morning sun
glare on the glass, slightly shaky, unedited."
Motion (audio on): "The ute cruises down the street, houses passing, small road
vibration. Phone camera handheld, no zoom."

## Generation notes

- Ask Higgsfield MCP for available models first; if Seedance 2.5 shows up, use it for
  S1/S5 (native audio, longer takes) and keep everything else on 2.0/Kling.
- 16:9 deliberate on all shots: full-frame crops to 9:16 work for the hero cut, and the
  same clips reuse in the week-2 stacked format uncropped.
- Export originals into `brand/ad-creatives-batch1/broll/` named `S1-a.mp4`, `S1-b.mp4`, …
