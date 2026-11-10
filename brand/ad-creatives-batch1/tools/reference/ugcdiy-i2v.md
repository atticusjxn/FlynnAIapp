# UGC video (image-to-video) — Veo 3 Fast prompt formula

Goal: animate the approved still into ~8s of authentic UGC with the AI person speaking the user's script. The model generates speech from the prompt — you do not upload audio.

## Endpoint

`POST https://queue.fal.run/fal-ai/veo3/fast/image-to-video`

Body:

```json
{
  "prompt": "...",
  "image_url": "<the approved still URL from the Nano Banana step>",
  "duration": "8s"
}
```

Duration enum: `"4s"`, `"6s"`, `"8s"` (string with `s` suffix). Pick from script length (~2.5 words/sec, round up).

## The 5-block formula

One paragraph, this order:

1. **Format anchor** — same as the still.
   - "Vertical 9:16 iPhone selfie video. The shot continues from the input still."
2. **Motion cues block** (mandatory — 3–4 cues) — fights frozen-mannequin output.
   - "She breaks eye contact briefly toward her left, tilts her head, shifts her weight, then looks back into the lens. Small unconscious adjustments to her grip on the can."
3. **Dialog block** — the exact spoken line, in quotes.
   - `She says: "You guys, I literally cannot get over this — like, where has this been my whole life?"`
4. **Audio environment** — what else can be heard.
   - "Casual indoor room tone, faint kitchen ambience, no background music."
5. **Negative tail** (mandatory).
   - "No subtitles, no captions, no text overlays, no on-screen text, no watermarks."

## Worked example

**Approved still URL:** `https://v3.fal.media/files/.../sofia-cola-still-v1.jpg`  
**Script (from user):** "You guys, I literally cannot get over this — like, where has this been my whole life?" (~17 words)  
**Duration:** `8s` (15–20 word band)

**Prompt:**

> Vertical 9:16 iPhone selfie video. The shot continues from the input still — Sofia in the sunlit kitchen, holding the red cola can. She breaks eye contact briefly toward her left, tilts her head with a small smile, shifts her weight, then looks back into the lens, small unconscious adjustment to her grip on the can. She says: "You guys, I literally cannot get over this — like, where has this been my whole life?" Casual indoor room tone, faint kitchen ambience, no background music. No subtitles, no captions, no text overlays, no on-screen text, no watermarks.

**Body:**

```json
{
  "prompt": "Vertical 9:16 iPhone selfie video. ... no on-screen text, no watermarks.",
  "image_url": "https://v3.fal.media/files/.../sofia-cola-still-v1.jpg",
  "duration": "8s"
}
```

## Dialog tactics

- **Use natural-talk markers.** Filler words like "honestly", "wait", "ok so", "literally" ground the speech in real UGC tone. Don't sanitize them out — they're the point.
- **One thought per beat.** A 4-beat structure (HOOK → SHOW → DEMO → VERDICT) gives Veo natural pause points.
- **Avoid product names that sound like other words.** Veo's TTS will phoneme-substitute. If the brand is "Stapla", consider spelling cue: `(pronounced "stah-plah")` in the prompt context (not in the spoken line).
- **Caps for emphasis** in the spoken line: `"This is INSANE."` — Veo respects it as stress.

## Switching models

| User wants | Endpoint | Same body? |
|------------|----------|------------|
| Premium quality | `fal-ai/veo3.1/image-to-video` | Yes |
| Cheaper, **silent** (no dialog) | `fal-ai/kling-video/v2.5-turbo/standard/image-to-video` | Use `duration: "5"` (string, no `s` suffix on Kling). Drop the dialog block. |

For Kling silent variant, the prompt becomes a pure motion description:

> Vertical 9:16 iPhone selfie video continuing from the input still. Sofia tilts the can up to read the label, breaks eye contact toward the window, shifts her weight, looks back to camera with a soft smile. Casual handheld, slight wobble, natural framing.

## When the video comes back wrong

| Problem | Add to prompt |
|---------|---------------|
| Subtitles burned in | Strengthen the negative tail; move it to the end; add "absolutely no on-screen text of any kind." |
| Voice doesn't match the character | Add a voice descriptor to the dialog block: "She says, in a warm Gen-Z American voice with slight vocal fry: '...'" |
| Static / mannequin look | Add 1–2 more motion cues; specify which body part moves when. |
| Speaks too fast / too slow | Trim or pad the dialog by 2–3 words; Veo paces against the duration. |
| Dialog gets cut off | Use the next duration up; check word count vs ~2.5 words/sec. |

Each retry is a full billed generation — there is no "fix the previous output" mode. Stills are cheap, video is not. Always lock the still first.

## What NOT to write

- ❌ Camera moves Veo can't do reliably (complex tracking, drone shots) — keep it handheld.
- ❌ Multiple characters in one video — Veo i2v animates the input still; if there's one person in the still, ask for one person in the video.
- ❌ Music in the prompt — Veo will sometimes invent jingles. Specify "no background music" if you don't want it.
- ❌ More than ~22 spoken words at 8s — they will be rushed or truncated. Split or use 6s/4s with a shorter line.
