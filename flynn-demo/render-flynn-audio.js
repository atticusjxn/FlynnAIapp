/**
 * Render Flynn's lines from a demo transcript to drop-in MP3s (Deepgram Hyperion,
 * sped/pitched to match the demo's "pace" so it sounds the same as in the browser).
 *
 *   node flynn-demo/render-flynn-audio.js [transcript.json] [pace] [outDir]
 *
 * transcript.json: the array from the demo's "copy transcript" button.
 * pace: playback multiplier baked in (default 1.1 — matches the demo slider).
 * outDir: default ~/Desktop/flynn-reel
 *
 * Outputs per-line clips (flynn_1.mp3 ...) plus flynn_full.mp3 (each line placed
 * at its transcript offset on a silent bed, so it lines up if dropped at t=0).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const KEY = process.env.DEEPGRAM_API_KEY;
const MODEL = 'aura-2-hyperion-en';

const transcriptPath = process.argv[2] || path.join(__dirname, 'last-reel.json');
const PACE = parseFloat(process.argv[3] || '1.1') || 1.1;
const outDir = process.argv[4] || path.join(os.homedir(), 'Desktop', 'flynn-reel');

if (!KEY) { console.error('DEEPGRAM_API_KEY not set'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

async function tts(text, file) {
  const res = await fetch(`https://api.deepgram.com/v1/speak?model=${MODEL}&encoding=mp3`, {
    method: 'POST',
    headers: { Authorization: `Token ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Deepgram ${res.status}: ${(await res.text()).slice(0, 200)}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

function sampleRate(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', file]).toString().trim();
  return parseInt(out, 10) || 44100;
}

// Match the demo: playbackRate without pitch preservation = asetrate (speed+pitch up).
function applyPace(inF, outF) {
  if (PACE === 1) { fs.copyFileSync(inF, outF); return; }
  const r = sampleRate(inF);
  execFileSync('ffmpeg', ['-y', '-i', inF, '-af',
    `asetrate=${Math.round(r * PACE)},aresample=${r}`, outF], { stdio: 'ignore' });
}

(async () => {
  const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
  const flynn = transcript.filter((m) => m.from === 'flynn' && (m.text || '').trim());
  if (!flynn.length) { console.error('no flynn lines in transcript'); process.exit(1); }

  console.log(`Rendering ${flynn.length} Flynn lines at ${PACE}x -> ${outDir}\n`);
  const paced = [];
  for (let i = 0; i < flynn.length; i++) {
    const raw = path.join(outDir, `_raw_${i + 1}.mp3`);
    const out = path.join(outDir, `flynn_${i + 1}.mp3`);
    await tts(flynn[i].text, raw);
    applyPace(raw, out);
    fs.unlinkSync(raw);
    paced.push({ file: out, atMs: Math.round((flynn[i].at || 0) * 1000) });
    console.log(`  flynn_${i + 1}.mp3  @${flynn[i].at}s  "${flynn[i].text.slice(0, 60)}..."`);
  }

  // Combined: each clip delayed to its transcript offset on a single bed.
  const args = ['-y'];
  paced.forEach((p) => args.push('-i', p.file));
  const delays = paced.map((p, i) => `[${i}]adelay=${p.atMs}|${p.atMs}[a${i}]`).join(';');
  const mix = paced.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${paced.length}:normalize=0[out]`;
  args.push('-filter_complex', `${delays};${mix}`, '-map', '[out]', path.join(outDir, 'flynn_full.mp3'));
  execFileSync('ffmpeg', args, { stdio: 'ignore' });
  console.log(`  flynn_full.mp3  (all lines at their offsets)\n\nDone. Files in: ${outDir}`);
})().catch((e) => { console.error('failed:', e.message); process.exit(1); });
