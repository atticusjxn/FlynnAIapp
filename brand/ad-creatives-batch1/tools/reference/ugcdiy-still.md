# UGC selfie still — Nano Banana edit prompt formula

Goal: a frame that looks like an **iPhone selfie**, not a polished render. The model's default is too clean — every block below pushes back against that.

## Endpoint

`POST https://queue.fal.run/fal-ai/nano-banana/edit`

Pass 2–5 reference images in `image_urls`. Order matters: **character hero first**, then **product**, then **style refs** (1–3 from `references/aesthetics/ugc-selfie/`).

## The 7-block formula

Build **one paragraph** in this order. Don't bullet-list it to the model.

1. **Format anchor** — what kind of frame this is.
   - "iPhone front-camera selfie, vertical 9:16 frame grab, casual handheld."
2. **Character anchor** — who they are (lock to the reference).
   - "The young woman from reference image 1 (Sofia, black hair long straight, hazel eyes, dimples, olive skin)."
3. **Product moment** — what they're doing with the product from ref 2.
   - "She holds [Product Name] from reference image 2 close to the camera at chest height, label fully visible, light catching the edge of the bottle."
4. **Scene & lighting** — concrete location and light source.
   - "Sunlit kitchen morning, warm window light from frame-left, soft shadows on her cheek, the counter and a coffee mug slightly out of focus behind her."
5. **Camera imperfection block** (mandatory) — fights AI polish.
   - "Slight motion blur on the bottle as she lifts it, mild overexposure on her forehead, faint sensor grain, soft focus drop on the right edge of the frame, framing slightly off-center, lens distortion at the corners."
6. **Skin realism block** (mandatory) — keeps her looking real.
   - "Visible pores across her cheeks and nose, slight unevenness in skin tone around the chin, faint undereye shadows, hint of natural shine from skin oils on the forehead and nose bridge."
   - **Never use:** acne, pimples, breakouts, blemishes, redness, rashes. Goal is "real person, not retouched" — not "person with skin problems."
7. **Negative tail** (mandatory) — strip captions / text the model loves to add.
   - "No subtitles, no captions, no text overlays, no UI elements, no watermark, no logos beyond what is on the product itself."

## Worked example

**Inputs:**
- `image_urls[0]` = `references/influencers/sofia-black-hair-long-straight-dimples-hazel-eyes-olive/01-hero-front.jpg`
- `image_urls[1]` = `references/products/cola-can.jpg`
- `image_urls[2]` = `references/aesthetics/ugc-selfie/videoframe_4516.jpg`

**Prompt:**

> iPhone front-camera selfie, vertical 9:16 frame grab, casual handheld. The young woman from reference image 1 (Sofia, black hair long straight, hazel eyes, dimples, olive skin), wearing a cream oversized hoodie. She holds the red cola can from reference image 2 close to the camera at chest height, label fully visible, light catching the edge of the can. Sunlit kitchen morning, warm window light from frame-left, soft shadows on her cheek, a half-empty coffee mug and a marble counter slightly out of focus behind her. Slight motion blur on the can as she lifts it, mild overexposure on her forehead, faint sensor grain, soft focus drop on the right edge of the frame, framing slightly off-center, lens distortion at the corners. Visible pores across her cheeks and nose, slight unevenness in skin tone around the chin, faint undereye shadows, hint of natural shine from skin oils on the forehead and nose bridge. No subtitles, no captions, no text overlays, no UI elements, no watermark, no logos beyond what is on the can itself.

## Aspect ratio

Default: **`9:16`** for UGC. Use `1:1` only if the user explicitly asks for square (carousels). `16:9` is wrong for UGC.

## When the still comes back wrong

Common issues and the targeted prompt fix:

| Problem | Add to prompt |
|---------|---------------|
| Three hands / weird fingers | "Exactly two hands, five fingers each, anatomically correct arms holding the can." |
| Two faces / merged features | "Single face only, no duplicate features, clear single person in frame." |
| Product label illegible / wrong text | "Label on the can is sharp and exactly matches reference image 2, no altered text, no extra letters." |
| Looks like a render / too clean | Strengthen block 5 + 6: add "shot on iPhone 14, low-light selfie cam noise, slightly underexposed left cheek." |
| Background blown out | "Background exposure balanced with subject, not blown out, kitchen counter detail visible." |

Up to 2 retries per still (3 attempts total). Each attempt is billed.

## What NOT to write

- ❌ Bullet lists or tables in the prompt — Nano Banana ignores structure, just reads the prose.
- ❌ "Photorealistic, hyperreal, ultra-detailed, 8K, masterpiece" — keyword soup. The realism comes from blocks 5 & 6, not from adjectives.
- ❌ Naming a camera by serial number ("Sony A7R V"). "iPhone selfie" is the format anchor; that's enough.
- ❌ Fully describing the person if the reference image already shows them — let the ref do the work, just name the anchor traits.
