#!/usr/bin/env python3
"""Seedance 2.5 image-to-video pass.

Usage: batch_videos.py S1-a S7-b ...   (frame names from ../frames/, no extension)
Uploads each frame, submits bytedance/seedance-2-5 i2v with the shot's motion prompt,
polls, downloads to ../broll/<name>.mp4. ~315 credits per 5s 720p clip.
"""
import json, mimetypes, os, sys, urllib.request, uuid
import kie

UPLOAD = "https://kieai.redpandaai.co/api/file-stream-upload"

# (motion prompt, generate_audio)
MOTIONS = {
 "S1": ("The phone on the toolbox lights up and vibrates against the metal. He keeps working under the sink. Handheld phone camera, small natural shake, no zoom.", True),
 "S2": ("The hands work the wrench in a steady rhythm. Handheld phone camera held still, no zoom.", False),
 "S3": ("The shot continues directly from the input still. He slides the toolbox forward onto the tray with <a metal scrape> and pushes the tailgate up until it latches. He pulls his phone from his pocket with one hand, glances at it, gives a small nod and tucks it away. Camera handheld with small natural shake, no cuts, no zoom. Lighting constant, flat grey afternoon. No subtitles, no captions, no on-screen text, no watermarks.", True),
 "S4": ("He tilts the phone slightly and nods, relaxed. Phone camera held still, screen stays a soft glow, no zoom.", False),
 "S5": ("The phone vibrates against the timber, sawdust jumping with each buzz. Phone camera held close and still, no zoom.", True),
 "S6": ("The ute cruises down the street, houses passing, small road vibration. Phone camera handheld, no zoom.", True),
 "S7": ("He crawls forward under the floor, hands moving one over the other, camera bobbing naturally with his body, ultra-wide distortion held, no cuts.", True),
 "L1": ("The shot continues directly from the input still. He raises the phone in his right hand toward his ear to answer it. Mid-lift the top of the ladder loses its grip on the gutter and starts sliding sideways along it with <a long grinding metallic scrape>, the whole ladder tipping slowly off vertical; he panics, drops everything and throws both arms around the rungs in a bear hug, the phone tumbling loose and falling out of the bottom of the frame. The ladder grinds to a stop against the gutter bracket at a visible lean, still upright, him clinging to it mid-ladder with both arms, frozen. He stays on the ladder; it does not fall over. The phone must not bend, morph, or clip through his fingers. Camera handheld with a startled jerk and a small step backward as the ladder slides, no cuts, no zoom. Lighting constant, flat overcast. No subtitles, no captions, no on-screen text, no watermarks.", True),
 "L2": ("The shot continues directly from the input still. A current-generation iPhone falls into frame from above, rotating once, and lands corner-first on the concrete with <a hard plastic clack>, bounces once, and settles face-up, screen glowing. The phone must not bend or morph, and the concrete stays static. Camera handheld, held low and still, no cuts, no zoom. No subtitles, no captions, no on-screen text, no watermarks.", True),
}

HERE = os.path.dirname(os.path.abspath(__file__))
FRAMES = os.path.join(HERE, "../frames")
BROLL = os.path.join(HERE, "../broll")
os.makedirs(BROLL, exist_ok=True)


def upload(path):
    boundary = uuid.uuid4().hex
    name = os.path.basename(path)
    ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
    with open(path, "rb") as f:
        blob = f.read()
    parts = b""
    for field, value in (("uploadPath", "images/flynn-frames"), ("fileName", name)):
        parts += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{field}\"\r\n\r\n{value}\r\n").encode()
    parts += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\n"
              f"Content-Type: {ctype}\r\n\r\n").encode() + blob + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(UPLOAD, data=parts, headers={
        "Authorization": f"Bearer {kie._key()}",
        "Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        out = json.loads(resp.read())
    url = (out.get("data") or {}).get("downloadUrl")
    if not url:
        raise SystemExit(f"upload failed: {out}")
    return url


def main():
    names = sys.argv[1:]
    if not names:
        raise SystemExit("usage: batch_videos.py S1-a S7-b ...")
    manifest = {}
    mpath = os.path.join(FRAMES, "manifest.json")
    if os.path.exists(mpath):
        manifest = json.load(open(mpath))
    tasks = []
    for name in names:
        shot = name.split("-")[0]
        motion, audio = MOTIONS[shot]
        url = manifest.get(name)
        if not url:
            url = upload(os.path.join(FRAMES, f"{name}.png"))
        print(f"frame {name}: {url}")
        tid = kie.submit("bytedance/seedance-2-5", {
            "prompt": motion,
            "first_frame_url": url,
            "resolution": "720p",
            "aspect_ratio": "adaptive",  # required with first_frame_url; inherits 9:16 from the frame
            "duration": 5,
            "generate_audio": audio,
            "output_format": "mp4",
        })
        print(f"submitted video {name}: {tid}")
        tasks.append((name, tid))
    for name, tid in tasks:
        try:
            kie.wait(tid, os.path.join(BROLL, f"{name}.mp4"), timeout=1800)
        except SystemExit as e:
            print(f"FAILED {name}: {e}")

if __name__ == "__main__":
    main()
