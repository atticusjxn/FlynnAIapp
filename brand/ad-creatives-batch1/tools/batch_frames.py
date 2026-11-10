#!/usr/bin/env python3
"""Submit all start-frame generations (2 variants each), poll, download."""
import json, os, sys, time
import kie

PROMPTS = {
 "S1": 'Vertical phone photo taken one-handed by a tradie: his mate in navy work shirt and hi-vis on his back half under a laundry sink, work boots toward camera, a phone face-up on a red toolbox nearby, cleaning products and a bucket cluttering the floor. Slightly tilted framing, ordinary indoor light, unedited, no color grading, the kind of photo posted straight to a story.',
 "S2": "Vertical phone photo shot close and one-handed: weathered tradesman's hands tightening a PVC pipe fitting with a wrench under a sink, hi-vis sleeve, teflon tape and offcuts scattered around, visible skin texture. Slightly awkward angle, ordinary indoor light, unedited, like a progress pic sent to a group chat.",
 "S3": 'Vertical phone photo from a front porch: a tradie in hi-vis and shorts carrying a toolbox toward his white dual-cab ute parked on a quiet suburban Australian street, weatherboard house edge in frame, bins on the kerb. Slightly tilted, late afternoon light, unedited, ordinary.',
 "S4": 'Vertical phone photo taken from beside him: a tradie sitting on his ute tray at dusk looking at his phone, screen just a soft unreadable glow, esky beside him, street lights coming on behind. A little underexposed, grainy, flash off, unedited, candid.',
 "S5": 'Vertical phone photo shot close: a phone face-down on sawdusty timber beside a circular saw on a cluttered workbench, single harsh work-lamp, offcuts and a tape measure in frame. Ordinary, unedited, slightly out of focus at the edges.',
 "S6": 'Vertical phone video still shot from the passenger seat of a ute driving a suburban Australian street, dashboard and windscreen edge in frame, morning sun glare on the glass, slightly shaky, unedited.',
 "S7": "POV photo from a tradie's own eyes shot on an iPhone 0.5x ultra-wide lens: his own dusty gloved hands braced on the dirt as he crawls under a low timber house floor, bearers and old pipes ahead, headlamp glow, strong ultra-wide fisheye distortion at the edges, grainy, unedited.",
}

FRAMES = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frames"))
os.makedirs(FRAMES, exist_ok=True)

def main():
    only = sys.argv[1:] or list(PROMPTS)
    variants = ["a", "b"]
    tasks = []  # (name, taskId)
    for shot in only:
        for v in variants:
            out = os.path.join(FRAMES, f"{shot}-{v}.png")
            if os.path.exists(out):
                print(f"skip {shot}-{v} (exists)"); continue
            tid = kie.submit("nano-banana-pro", {
                "prompt": PROMPTS[shot], "aspect_ratio": "9:16",
                "resolution": "1K", "output_format": "png"})
            print(f"submitted {shot}-{v}: {tid}")
            tasks.append((f"{shot}-{v}", tid))
            time.sleep(1)
    for name, tid in tasks:
        try:
            kie.wait(tid, os.path.join(FRAMES, f"{name}.png"), timeout=600)
        except SystemExit as e:
            print(f"FAILED {name}: {e}")

if __name__ == "__main__":
    main()
