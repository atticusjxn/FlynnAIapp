/* Flynn demo client — HANDS-FREE for driving.
 *
 * Tap START (or SPACE) once to begin a conversation. From then on it's a loop,
 * no touching the Mac:
 *   listening -> you talk, a silence gap ends your turn and submits
 *   thinking  -> POST /turn (with a deliberate "thinking" beat)
 *   speaking  -> Flynn's Aussie voice plays, MIC IS OFF (no echo / self-hear)
 *   cooldown  -> wait the mic-delay (Bluetooth lag) so it doesn't catch Flynn's
 *                audio tail or the end of your own speech, then re-opens the mic
 * Tap again (or SPACE) to stop the session.
 */

const els = {
  chat: document.getElementById('chat'),
  state: document.getElementById('state'),
  heard: document.getElementById('heard'),
  voice: document.getElementById('voice'),
  think: document.getElementById('think'),
  thinkval: document.getElementById('thinkval'),
  micdelay: document.getElementById('micdelay'),
  micdelayval: document.getElementById('micdelayval'),
  warm: document.getElementById('warm'),
  copytx: document.getElementById('copytx'),
  pace: document.getElementById('pace'),
  paceval: document.getElementById('paceval'),
  typed: document.getElementById('typed'),
  send: document.getElementById('send'),
  cues: document.getElementById('cues'),
  ptt: document.getElementById('ptt'),
  player: document.getElementById('player'),
};

// Timed transcript: every message logged with its offset (seconds from the
// first message), so the iMessage-replay skill can reproduce the exact rhythm.
const convo = [];
let convoT0 = null;
function logMsg(from, text) {
  const now = performance.now();
  if (convoT0 == null) convoT0 = now;
  convo.push({ at: Math.round((now - convoT0) / 100) / 10, from, text });
}

// session = hands-free conversation is on. phase = current step of the loop.
let session = false;
let phase = 'idle'; // idle | listening | thinking | speaking | cooldown
let wantMic = false; // we intend the recogniser to be running (vs an auto-stop)
let transcript = '';
let silenceTimer = null;

const ENDPOINT_MS = 1300; // silence after speech that ends your turn

function setState(s, label) {
  els.state.className = 'state ' + s;
  els.state.textContent = (label || s).toUpperCase();
}

function addBubble(who, text) {
  const b = document.createElement('div');
  b.className = 'bubble ' + who;
  b.textContent = text;
  els.chat.appendChild(b);
  els.chat.scrollTop = els.chat.scrollHeight;
  return b;
}

function addTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'bubble flynn typing';
  wrap.innerHTML = '<span></span><span></span><span></span>';
  els.chat.appendChild(wrap);
  els.chat.scrollTop = els.chat.scrollHeight;
  return wrap;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const micDelayMs = () => parseInt(els.micdelay.value, 10) || 0;

// ---- Web Speech API (Chrome) ----
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null;
if (SpeechRecognition) {
  recog = new SpeechRecognition();
  recog.lang = 'en-AU';
  recog.interimResults = true;
  recog.continuous = true;

  recog.onresult = (e) => {
    if (phase !== 'listening') return; // ignore anything that isn't our turn
    let finalT = '';
    let interim = '';
    for (let i = 0; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalT += t;
      else interim += t;
    }
    transcript = (finalT + ' ' + interim).trim();
    els.heard.textContent = transcript || 'listening...';
    if (transcript) armSilence(); // start/extend the end-of-turn timer once there's speech
  };

  recog.onerror = (e) => {
    // 'no-speech'/'aborted' are normal during a long hands-free session; just let
    // onend restart us. Surface anything genuinely broken.
    if (e.error !== 'no-speech' && e.error !== 'aborted') {
      els.heard.textContent = 'mic error: ' + e.error;
    }
  };

  // Chrome stops continuous recognition periodically — if we still want the mic,
  // restart it so listening feels uninterrupted.
  recog.onend = () => {
    if (wantMic && session && phase === 'listening') {
      try { recog.start(); } catch (_) {}
    }
  };
} else {
  els.heard.textContent = 'Web Speech API not available — use Chrome.';
}

function armSilence() {
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(endpoint, ENDPOINT_MS);
}

// End of the user's turn: stop the mic and submit what we heard.
function endpoint() {
  if (phase !== 'listening') return;
  const text = (transcript || '').trim();
  if (!text || text === 'listening...') return; // nothing to send, keep listening
  wantMic = false;
  try { recog.stop(); } catch (_) {}
  submit(text);
}

function enterListening() {
  if (!session) return;
  phase = 'listening';
  transcript = '';
  wantMic = true;
  setState('listening');
  els.heard.textContent = 'listening...';
  try { recog.start(); } catch (_) { /* already running */ }
}

async function afterSpeak() {
  if (!session) { phase = 'idle'; setState('idle'); return; }
  phase = 'cooldown';
  setState('cooldown', 'mic in ' + (micDelayMs() / 1000).toFixed(1) + 's');
  await sleep(micDelayMs()); // Bluetooth-lag guard: don't catch Flynn's audio tail
  if (session) enterListening();
}

async function submit(text) {
  phase = 'thinking';
  clearTimeout(silenceTimer);
  addBubble('me', text);
  logMsg('me', text);
  setState('thinking');
  const typing = addTyping();
  const thinkMs = parseInt(els.think.value, 10) || 0;

  try {
    const reqP = fetch('/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: els.voice.value }),
    }).then((r) => r.json());

    const [data] = await Promise.all([reqP, sleep(thinkMs)]);
    typing.remove();

    if (data.error) {
      addBubble('flynn', '(error: ' + data.error + ')');
      return afterSpeak();
    }

    addBubble('flynn', data.replyText);
    logMsg('flynn', data.replyText);
    setState('speaking');
    phase = 'speaking';
    if (data.audio) {
      els.player.src = data.audio;
      // Faster + a touch higher pitch so the deep steady voice sounds livelier,
      // not slow/flat. preservesPitch=false lets the speed-up lift the pitch.
      els.player.preservesPitch = false;
      els.player.playbackRate = parseFloat(els.pace.value) || 1;
      els.player.onended = () => { afterSpeak(); };
      els.player.onerror = () => { afterSpeak(); };
      await els.player.play().catch(() => { afterSpeak(); });
    } else {
      afterSpeak();
    }
  } catch (err) {
    typing.remove();
    addBubble('flynn', '(network error)');
    afterSpeak();
  }
}

// ---- Session toggle (tap once to start, again to stop) ----
function startSession() {
  if (session) return;
  if (!recog) { els.heard.textContent = 'Web Speech API not available — use Chrome.'; return; }
  session = true;
  els.ptt.textContent = 'STOP';
  els.ptt.classList.add('active');
  enterListening();
}

function stopSession() {
  session = false;
  wantMic = false;
  clearTimeout(silenceTimer);
  try { recog.stop(); } catch (_) {}
  try { els.player.pause(); } catch (_) {}
  phase = 'idle';
  els.ptt.textContent = 'START';
  els.ptt.classList.remove('active');
  setState('idle');
  els.heard.textContent = 'tapped out — tap START to go again';
}

function toggleSession() { session ? stopSession() : startSession(); }

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat && e.target.tagName !== 'INPUT'
      && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    toggleSession();
  }
});
els.ptt.addEventListener('click', toggleSession);

// ---- Sliders ----
els.think.addEventListener('input', () => {
  els.thinkval.textContent = (els.think.value / 1000).toFixed(1) + 's';
});
els.micdelay.addEventListener('input', () => {
  els.micdelayval.textContent = (els.micdelay.value / 1000).toFixed(1) + 's';
});
els.pace.addEventListener('input', () => {
  els.paceval.textContent = parseFloat(els.pace.value).toFixed(2) + 'x';
});

// Type / paste a line as the operator -> Flynn types and replies (same path as
// a spoken turn). Lets you drive the on-screen iMessage chat for recording.
function sendTyped() {
  const t = els.typed.value.trim();
  if (!t) return;
  els.typed.value = '';
  injectLine(t);
}
els.send.addEventListener('click', sendTyped);
els.typed.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); sendTyped(); }
});

els.copytx.addEventListener('click', async () => {
  if (!convo.length) { els.copytx.textContent = 'nothing yet'; setTimeout(() => els.copytx.textContent = 'copy transcript', 1200); return; }
  const json = JSON.stringify(convo, null, 2);
  try { await navigator.clipboard.writeText(json); els.copytx.textContent = 'copied ' + convo.length + ' msgs'; }
  catch (_) { console.log(json); els.copytx.textContent = 'see console'; }
  setTimeout(() => els.copytx.textContent = 'copy transcript', 1600);
});

els.warm.addEventListener('click', async () => {
  els.warm.textContent = 'warming...';
  await fetch('/warm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice: els.voice.value }),
  });
  els.warm.textContent = 're-warm';
});
els.voice.addEventListener('change', () => els.warm.click());

// ---- Scripted lines: inject into the loop as if spoken ----
function injectLine(cue) {
  if (phase === 'thinking' || phase === 'speaking') return; // wait your turn
  clearTimeout(silenceTimer);
  wantMic = false;
  try { recog.stop(); } catch (_) {}
  submit(cue);
}

// ---- Load scenarios + voices ----
(async () => {
  const res = await fetch('/scenarios');
  const data = await res.json();

  for (const v of data.voices) {
    const opt = document.createElement('option');
    opt.value = v.key;
    opt.textContent = v.label;
    if (v.key === data.defaultVoice) opt.selected = true;
    els.voice.appendChild(opt);
  }

  for (const s of data.scenarios) {
    const btn = document.createElement('button');
    btn.className = 'cue';
    btn.innerHTML = '<b>' + s.label + '</b><br>' + s.cue;
    btn.addEventListener('click', () => injectLine(s.cue));
    els.cues.appendChild(btn);
  }
})();
