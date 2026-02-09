// ─── Amen Break Generator ───────────────────────────────────────────────────
// Synthesizes the classic amen break pattern with Web Audio API,
// slices it into segments, and lets you shuffle & loop them.

(function () {
  'use strict';

  // ─── Audio Context ──────────────────────────────────────────────────────────
  let ctx = null;
  let masterGain = null;
  let reverbNode = null;
  let reverbGain = null;
  let dryGain = null;
  let crushNode = null;

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.8;

      // Dry/wet routing for reverb
      dryGain = ctx.createGain();
      dryGain.gain.value = 1;
      reverbGain = ctx.createGain();
      reverbGain.gain.value = 0;
      reverbNode = createReverb();

      masterGain.connect(dryGain);
      masterGain.connect(reverbNode);
      reverbNode.connect(reverbGain);
      dryGain.connect(ctx.destination);
      reverbGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ─── Reverb (simple convolution) ───────────────────────────────────────────
  function createReverb() {
    const convolver = ctx.createConvolver();
    const rate = ctx.sampleRate;
    const length = rate * 1.5;
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }
    convolver.buffer = impulse;
    return convolver;
  }

  // ─── Drum Synthesis ─────────────────────────────────────────────────────────
  // Render individual drum hits into short AudioBuffers

  function renderKick(actx) {
    const dur = 0.35;
    const sr = actx.sampleRate;
    const len = Math.ceil(dur * sr);
    const buf = actx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 12);
      const freq = 150 * Math.exp(-t * 40) + 40;
      data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.9;
    }
    return buf;
  }

  function renderSnare(actx) {
    const dur = 0.25;
    const sr = actx.sampleRate;
    const len = Math.ceil(dur * sr);
    const buf = actx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      // body
      const bodyEnv = Math.exp(-t * 20);
      const body = Math.sin(2 * Math.PI * 185 * t) * 0.5 +
                   Math.sin(2 * Math.PI * 349 * t) * 0.3;
      // noise rattle
      const noiseEnv = Math.exp(-t * 15);
      const noise = (Math.random() * 2 - 1);
      data[i] = (body * bodyEnv + noise * noiseEnv * 0.7) * 0.8;
    }
    return buf;
  }

  function renderGhostSnare(actx) {
    const dur = 0.12;
    const sr = actx.sampleRate;
    const len = Math.ceil(dur * sr);
    const buf = actx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const bodyEnv = Math.exp(-t * 35);
      const body = Math.sin(2 * Math.PI * 200 * t) * 0.3;
      const noiseEnv = Math.exp(-t * 30);
      const noise = (Math.random() * 2 - 1);
      data[i] = (body * bodyEnv + noise * noiseEnv * 0.4) * 0.45;
    }
    return buf;
  }

  function renderClosedHat(actx) {
    const dur = 0.08;
    const sr = actx.sampleRate;
    const len = Math.ceil(dur * sr);
    const buf = actx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 60);
      let sig = 0;
      for (const r of ratios) {
        sig += Math.sign(Math.sin(2 * Math.PI * 40 * r * t));
      }
      // bandpass-ish: subtract low freq content with simple HP
      data[i] = sig / ratios.length * env * 0.35;
    }
    // Simple one-pole highpass
    let prev = 0;
    let prevOut = 0;
    const rc = 1 / (2 * Math.PI * 7000);
    const dt = 1 / sr;
    const alpha = rc / (rc + dt);
    for (let i = 0; i < len; i++) {
      const inp = data[i];
      prevOut = alpha * (prevOut + inp - prev);
      prev = inp;
      data[i] = prevOut;
    }
    return buf;
  }

  function renderOpenHat(actx) {
    const dur = 0.3;
    const sr = actx.sampleRate;
    const len = Math.ceil(dur * sr);
    const buf = actx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 8);
      let sig = 0;
      for (const r of ratios) {
        sig += Math.sign(Math.sin(2 * Math.PI * 40 * r * t));
      }
      data[i] = sig / ratios.length * env * 0.35;
    }
    let prev = 0;
    let prevOut = 0;
    const rc = 1 / (2 * Math.PI * 6000);
    const dt = 1 / sr;
    const alpha = rc / (rc + dt);
    for (let i = 0; i < len; i++) {
      const inp = data[i];
      prevOut = alpha * (prevOut + inp - prev);
      prev = inp;
      data[i] = prevOut;
    }
    return buf;
  }

  function renderRide(actx) {
    const dur = 0.2;
    const sr = actx.sampleRate;
    const len = Math.ceil(dur * sr);
    const buf = actx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 15);
      let sig = 0;
      for (const r of ratios) {
        sig += Math.sign(Math.sin(2 * Math.PI * 55 * r * t));
      }
      data[i] = sig / ratios.length * env * 0.22;
    }
    let prev = 0;
    let prevOut = 0;
    const rc = 1 / (2 * Math.PI * 5000);
    const dt = 1 / sr;
    const alpha = rc / (rc + dt);
    for (let i = 0; i < len; i++) {
      const inp = data[i];
      prevOut = alpha * (prevOut + inp - prev);
      prev = inp;
      data[i] = prevOut;
    }
    return buf;
  }

  // ─── Amen Break Pattern ─────────────────────────────────────────────────────
  // 2-bar pattern at 32 sixteenth-note resolution (then looped to fill 4 bars)
  // K = kick, S = snare, s = ghost snare, h = closed hat, H = open hat, r = ride
  // Each step is a 16th note. We define 2 bars (32 steps), pattern is 2 bars.

  // The classic amen break - 2 bar pattern
  // Bar 1: standard funk groove
  // Bar 2: syncopated with displaced snares
  const PATTERN_STEPS = 32; // 2 bars of 16th notes

  // Each entry: [step, hitType]
  // Steps 0-15 = bar 1, steps 16-31 = bar 2
  const amenPattern = [
    // ── Bar 1 ──
    // Beat 1
    [0, 'kick'], [0, 'ride'],
    [1, 'ride'],
    [2, 'hat'], [2, 'ride'],
    [3, 'ride'],
    // Beat 2
    [4, 'snare'], [4, 'ride'],
    [5, 'ride'],
    [6, 'kick'], [6, 'ride'],
    [7, 'ride'],
    // Beat 3
    [8, 'hat'],
    [9, 'ride'],
    [10, 'snare'], [10, 'ride'],
    [11, 'ride'],
    // Beat 4
    [12, 'kick'], [12, 'ride'],
    [13, 'ghost'],
    [14, 'hat'], [14, 'ride'],
    [15, 'ghost'],

    // ── Bar 2 ──
    // Beat 1
    [16, 'kick'], [16, 'ride'],
    [17, 'ride'],
    [18, 'hat'], [18, 'ride'],
    [19, 'ride'],
    // Beat 2
    [20, 'snare'], [20, 'ride'],
    [21, 'kick'], [21, 'ride'],
    [22, 'ride'],
    [23, 'ghost'],
    // Beat 3
    [24, 'hat'],
    [25, 'ride'],
    [26, 'kick'], [26, 'ride'],
    [27, 'openhat'],
    // Beat 4
    [28, 'snare'], [28, 'ride'],
    [29, 'ghost'],
    [30, 'kick'], [30, 'ride'],
    [31, 'ghost'],
  ];

  // ─── Render Full Break to Buffer ────────────────────────────────────────────

  function renderAmenBreak(actx, bpm) {
    const stepDur = 60 / bpm / 4; // duration of one 16th note
    const totalDur = PATTERN_STEPS * stepDur;
    const sr = actx.sampleRate;
    const totalSamples = Math.ceil(totalDur * sr);
    const buffer = actx.createBuffer(1, totalSamples, sr);
    const output = buffer.getChannelData(0);

    // Pre-render each drum sound
    const drums = {
      kick: renderKick(actx),
      snare: renderSnare(actx),
      ghost: renderGhostSnare(actx),
      hat: renderClosedHat(actx),
      openhat: renderOpenHat(actx),
      ride: renderRide(actx),
    };

    // Mix hits into the output buffer
    for (const [step, type] of amenPattern) {
      const hitBuf = drums[type];
      if (!hitBuf) continue;
      const hitData = hitBuf.getChannelData(0);
      const offsetSample = Math.round(step * stepDur * sr);
      for (let i = 0; i < hitData.length && (offsetSample + i) < totalSamples; i++) {
        output[offsetSample + i] += hitData[i];
      }
    }

    // Soft-clip to prevent distortion
    for (let i = 0; i < totalSamples; i++) {
      output[i] = Math.tanh(output[i]);
    }

    return buffer;
  }

  // ─── State ──────────────────────────────────────────────────────────────────

  let amenBuffer = null;       // the rendered full break AudioBuffer
  let sliceOrder = [];         // current order of slices to play
  let numSlices = 16;
  let isPlaying = false;
  let schedulerTimer = null;
  let nextSliceIndex = 0;
  let nextSliceTime = 0;
  let currentBpm = 137;
  let pitchRate = 1.0;
  let swingAmount = 0;
  let crushBits = 16;

  // ─── DOM refs ───────────────────────────────────────────────────────────────

  const playBtn = document.getElementById('play-btn');
  const playIcon = document.getElementById('play-icon');
  const randomizeBtn = document.getElementById('randomize-btn');
  const resetBtn = document.getElementById('reset-btn');
  const bpmSlider = document.getElementById('bpm');
  const bpmVal = document.getElementById('bpm-val');
  const sliceSelect = document.getElementById('slices');
  const swingSlider = document.getElementById('swing');
  const swingVal = document.getElementById('swing-val');
  const pitchSlider = document.getElementById('pitch');
  const pitchVal = document.getElementById('pitch-val');
  const reverbSlider = document.getElementById('reverb');
  const reverbVal = document.getElementById('reverb-val');
  const crushSlider = document.getElementById('crush');
  const crushVal = document.getElementById('crush-val');
  const waveformCanvas = document.getElementById('waveform');
  const playhead = document.getElementById('playhead');
  const sliceMarkersDiv = document.getElementById('slice-markers');
  const sliceGridDiv = document.getElementById('slice-grid');

  // ─── Rebuild break & slices ─────────────────────────────────────────────────

  function rebuild() {
    ensureContext();
    amenBuffer = renderAmenBreak(ctx, currentBpm);
    numSlices = parseInt(sliceSelect.value, 10);
    sliceOrder = Array.from({ length: numSlices }, (_, i) => i);
    drawWaveform();
    drawSliceMarkers();
    buildSliceGrid();
  }

  // ─── Waveform Drawing ──────────────────────────────────────────────────────

  function drawWaveform() {
    const cvs = waveformCanvas;
    const c = cvs.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = cvs.getBoundingClientRect();
    cvs.width = rect.width * dpr;
    cvs.height = rect.height * dpr;
    c.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    c.clearRect(0, 0, w, h);

    if (!amenBuffer) return;
    const data = amenBuffer.getChannelData(0);
    const step = Math.ceil(data.length / w);
    const mid = h / 2;

    c.fillStyle = '#0d0d0d';
    c.fillRect(0, 0, w, h);

    c.beginPath();
    c.strokeStyle = '#ff6b00';
    c.lineWidth = 1;
    for (let x = 0; x < w; x++) {
      const start = x * step;
      let min = 1, max = -1;
      for (let j = 0; j < step && start + j < data.length; j++) {
        const s = data[start + j];
        if (s < min) min = s;
        if (s > max) max = s;
      }
      const y1 = mid + min * mid;
      const y2 = mid + max * mid;
      c.moveTo(x, y1);
      c.lineTo(x, y2);
    }
    c.stroke();
  }

  function drawSliceMarkers() {
    sliceMarkersDiv.innerHTML = '';
    for (let i = 1; i < numSlices; i++) {
      const pct = (i / numSlices) * 100;
      const marker = document.createElement('div');
      marker.className = 'slice-marker';
      marker.style.left = pct + '%';
      sliceMarkersDiv.appendChild(marker);
    }
  }

  // ─── Slice Grid ─────────────────────────────────────────────────────────────

  function buildSliceGrid() {
    sliceGridDiv.innerHTML = '';
    for (let i = 0; i < numSlices; i++) {
      const cell = document.createElement('div');
      cell.className = 'slice-cell';
      cell.textContent = sliceOrder[i] + 1;
      cell.dataset.index = i;
      sliceGridDiv.appendChild(cell);
    }
  }

  function highlightSlice(index) {
    const cells = sliceGridDiv.querySelectorAll('.slice-cell');
    cells.forEach((c, i) => c.classList.toggle('active', i === index));
  }

  // ─── Playback Scheduling ───────────────────────────────────────────────────

  function getSliceDuration() {
    const stepDur = 60 / currentBpm / 4;
    const stepsPerSlice = PATTERN_STEPS / numSlices;
    return stepsPerSlice * stepDur;
  }

  function getSliceOffset(sliceIndex) {
    const stepDur = 60 / currentBpm / 4;
    const stepsPerSlice = PATTERN_STEPS / numSlices;
    return sliceIndex * stepsPerSlice * stepDur;
  }

  function scheduleSlice(sliceIdx, when) {
    const src = ctx.createBufferSource();
    src.buffer = amenBuffer;
    src.playbackRate.value = pitchRate;

    // Bit crushing via waveshaper if needed
    let node = src;
    if (crushBits < 16) {
      const crusher = ctx.createWaveShaper();
      const steps = Math.pow(2, crushBits);
      const curve = new Float32Array(65536);
      for (let i = 0; i < 65536; i++) {
        const x = (i / 65536) * 2 - 1;
        curve[i] = Math.round(x * steps) / steps;
      }
      crusher.curve = curve;
      src.connect(crusher);
      node = crusher;
    }

    node.connect(masterGain);

    const offset = getSliceOffset(sliceOrder[sliceIdx]);
    const duration = getSliceDuration();
    src.start(when, offset, duration / pitchRate);
  }

  function startScheduler() {
    const lookahead = 0.1; // seconds
    const interval = 25;   // ms

    schedulerTimer = setInterval(() => {
      while (nextSliceTime < ctx.currentTime + lookahead) {
        scheduleSlice(nextSliceIndex, nextSliceTime);

        // Apply swing: delay every other slice slightly
        let dur = getSliceDuration() / pitchRate;
        if (swingAmount > 0 && nextSliceIndex % 2 === 0) {
          dur += dur * (swingAmount / 100) * 0.3;
        } else if (swingAmount > 0 && nextSliceIndex % 2 === 1) {
          dur -= dur * (swingAmount / 100) * 0.3;
        }

        nextSliceTime += dur;
        nextSliceIndex = (nextSliceIndex + 1) % numSlices;
      }
    }, interval);
  }

  function startPlayheadAnimation() {
    function animate() {
      if (!isPlaying) {
        playhead.style.opacity = '0';
        return;
      }
      playhead.style.opacity = '1';

      const totalDur = (getSliceDuration() / pitchRate) * numSlices;
      const loopTime = (ctx.currentTime - playStartTime) % totalDur;
      const pct = (loopTime / totalDur) * 100;
      playhead.style.left = pct + '%';

      // Highlight current slice
      const currentSlice = Math.floor((loopTime / totalDur) * numSlices);
      highlightSlice(currentSlice);

      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  let playStartTime = 0;

  function play() {
    ensureContext();
    if (!amenBuffer) rebuild();
    isPlaying = true;
    playBtn.classList.add('playing');
    playIcon.innerHTML = '&#9632;'; // stop icon
    nextSliceIndex = 0;
    nextSliceTime = ctx.currentTime + 0.05;
    playStartTime = nextSliceTime;
    startScheduler();
    startPlayheadAnimation();
  }

  function stop() {
    isPlaying = false;
    playBtn.classList.remove('playing');
    playIcon.innerHTML = '&#9654;'; // play icon
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
    playhead.style.opacity = '0';
    highlightSlice(-1);
  }

  // ─── Shuffle ────────────────────────────────────────────────────────────────

  function shuffleSlices() {
    for (let i = sliceOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sliceOrder[i], sliceOrder[j]] = [sliceOrder[j], sliceOrder[i]];
    }
    buildSliceGrid();
  }

  function resetSlices() {
    sliceOrder = Array.from({ length: numSlices }, (_, i) => i);
    buildSliceGrid();
  }

  // ─── Event Listeners ───────────────────────────────────────────────────────

  playBtn.addEventListener('click', () => {
    if (isPlaying) stop(); else play();
  });

  randomizeBtn.addEventListener('click', () => {
    shuffleSlices();
  });

  resetBtn.addEventListener('click', () => {
    resetSlices();
  });

  bpmSlider.addEventListener('input', () => {
    currentBpm = parseInt(bpmSlider.value, 10);
    bpmVal.textContent = currentBpm;
    // Re-render the break buffer at new BPM
    const wasPlaying = isPlaying;
    if (wasPlaying) stop();
    rebuild();
    if (wasPlaying) play();
  });

  sliceSelect.addEventListener('change', () => {
    const wasPlaying = isPlaying;
    if (wasPlaying) stop();
    rebuild();
    if (wasPlaying) play();
  });

  swingSlider.addEventListener('input', () => {
    swingAmount = parseInt(swingSlider.value, 10);
    swingVal.textContent = swingAmount + '%';
  });

  pitchSlider.addEventListener('input', () => {
    const v = parseInt(pitchSlider.value, 10);
    pitchRate = v / 100;
    pitchVal.textContent = v + '%';
  });

  reverbSlider.addEventListener('input', () => {
    const v = parseInt(reverbSlider.value, 10);
    reverbVal.textContent = v + '%';
    ensureContext();
    const wet = v / 100;
    reverbGain.gain.setTargetAtTime(wet, ctx.currentTime, 0.05);
    dryGain.gain.setTargetAtTime(1 - wet * 0.5, ctx.currentTime, 0.05);
  });

  crushSlider.addEventListener('input', () => {
    crushBits = parseInt(crushSlider.value, 10);
    crushVal.textContent = crushBits;
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    if (amenBuffer) drawWaveform();
  });

  // ─── Init ───────────────────────────────────────────────────────────────────
  // Defer context creation until first user interaction (autoplay policy)
  rebuild();

})();
