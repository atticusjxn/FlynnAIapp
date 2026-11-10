# AI influencer character sheet — 10-image generation

Goal: a fresh, consistent AI character with 10 reference angles, ready to be re-used across UGC ads. The hero image (`01-hero-front.jpg`) becomes the anchor for all future selfie stills.

## Two-pass workflow

### Pass 1 — hero portrait (text-to-image)

Generate the **hero front-facing portrait** first. Get user approval. Don't move on until they say yes — every other angle is a re-render of this face.

**Endpoint:** `POST https://queue.fal.run/fal-ai/nano-banana`

**Body:**

```json
{
  "prompt": "Full-body front-facing portrait, soft studio lighting, neutral gray backdrop, 9:16 vertical. <CHARACTER DESCRIPTION>. Photoreal, natural skin (visible pores, slight unevenness, faint undereye shadows). Eyes locked to camera, neutral relaxed expression. No text, no watermark.",
  "num_images": 1,
  "aspect_ratio": "9:16"
}
```

**Character description tips** — pack 5 specific traits in this order so the folder name can mirror them later:

1. **Hair color** — "redhead", "blonde", "brunette", "black-hair", "silver-hair"
2. **Hair style** — "wavy", "straight", "curly", "pixie cut", "braided"
3. **Distinguishing feature** — "freckles", "dimples", "sharp jaw", "high cheekbones", "small beauty mark"
4. **Eye color** — "green eyes", "blue eyes", "brown eyes", "hazel eyes"
5. **Skin tone** — "fair", "olive", "tan", "deep", "medium"

**Example character description:**

> A 24-year-old woman, redhead with wavy shoulder-length hair, light freckles across her nose and cheeks, green eyes, fair skin. Wearing a plain white t-shirt. Approachable, slightly amused expression.

### Pass 2 — 9 additional angles (image edit with hero as ref)

After approval, save the hero as `01-hero-front.jpg`, then fire **9 separate edit calls** (in parallel) using the hero in `image_urls[0]`. Each call asks for one specific angle.

**Endpoint:** `POST https://queue.fal.run/fal-ai/nano-banana/edit`

**Body template:**

```json
{
  "prompt": "<ANGLE-SPECIFIC PROMPT — see table below>. Same person as reference image 1, identical face, hair, freckles, eye color, skin tone. Soft studio lighting, neutral gray backdrop, 9:16 vertical. Photoreal, natural skin. No text, no watermark.",
  "image_urls": ["<hero URL>"],
  "aspect_ratio": "9:16"
}
```

| File name | Angle prompt |
|-----------|--------------|
| `02-3q-left.jpg` | Three-quarter view from her left side, head turned slightly toward camera, full body. |
| `03-3q-right.jpg` | Three-quarter view from her right side, head turned slightly toward camera, full body. |
| `04-profile-left.jpg` | Strict left profile, looking forward (not at camera), full body. |
| `05-profile-right.jpg` | Strict right profile, looking forward (not at camera), full body. |
| `06-face-closeup.jpg` | Tight portrait crop from collarbone up, looking directly at camera, soft natural light. |
| `07-back-shoulder.jpg` | View from behind over the right shoulder, head turned three-quarter toward camera, upper body. |
| `08-medium-portrait.jpg` | Medium shot from waist up, hands relaxed at sides, looking at camera. |
| `09-full-body-3q.jpg` | Full body in a slight three-quarter pose, weight on one leg, casual stance. |
| `10-above-angle.jpg` | Slight high-angle shot looking down at her, head tilted up to camera, upper body. |

## Folder structure

```
references/influencers/<name>-<5-descriptors>/
  ├── 01-hero-front.jpg     ← anchor
  ├── 02-3q-left.jpg
  ├── 03-3q-right.jpg
  ├── 04-profile-left.jpg
  ├── 05-profile-right.jpg
  ├── 06-face-closeup.jpg
  ├── 07-back-shoulder.jpg
  ├── 08-medium-portrait.jpg
  ├── 09-full-body-3q.jpg
  └── 10-above-angle.jpg
```

**Folder naming convention:**

`{name}-{hair-color}-{hair-style}-{feature}-{eye-color}-{skin-tone}`

Examples:
- `emma-redhead-wavy-freckles-green-eyes-fair`
- `sofia-black-hair-long-straight-dimples-hazel-eyes-olive`
- `kai-blonde-curly-sharp-jaw-blue-eyes-tan`

This makes the character instantly identifiable in chat ("use Emma") and lets you grep by trait.

## Cost

- 1 hero (text-to-image) + 9 angles (image edit) = **10 generations** at ~$0.04 each = **~$0.40** per character sheet.
- QA retries on individual angles add ~$0.04 each.

## QA

After each angle generation, **verify face consistency with the hero**. The model occasionally drifts — wrong hair color, missing freckle, jaw shape changed. If drift is visible, regenerate with stronger anchoring:

> "Same person as reference image 1. Critical: identical face shape, identical eye color (green), identical freckles pattern, identical hair color (red, wavy, shoulder-length). Do not change facial features."

Up to 2 retries per angle. If the face still drifts after retries, the hero might be ambiguous — regenerate the hero with more distinctive features.

## After the sheet is done

1. Add a Changelog entry to `MASTER_CONTEXT.md`: "Created character sheet `<folder-name>` on YYYY-MM-DD."
2. If the user wants this character to be the default for future UGC sessions, update `MASTER_CONTEXT.md → Default character`.
