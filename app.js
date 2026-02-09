// ─── Amen Break Generator ───────────────────────────────────────────────────
// Loads real amen break WAV samples, slices them into segments,
// and lets you shuffle & loop them with effects.

(function () {
  'use strict';

  // ─── Sample Library ─────────────────────────────────────────────────────────
  // Rhythm Lab Amen Vol. 1 — filename: cw_amenNN_BPM.wav
  const SAMPLES = [
    { file: 'cw_amen01_175.wav', name: 'Amen 01', bpm: 175 },
    { file: 'cw_amen02_165.wav', name: 'Amen 02', bpm: 165 },
    { file: 'cw_amen03_167.wav', name: 'Amen 03', bpm: 167 },
    { file: 'cw_amen04_170.wav', name: 'Amen 04', bpm: 170 },
    { file: 'cw_amen05_158.wav', name: 'Amen 05', bpm: 158 },
    { file: 'cw_amen06_169.wav', name: 'Amen 06', bpm: 169 },
    { file: 'cw_amen07_172.wav', name: 'Amen 07', bpm: 172 },
    { file: 'cw_amen08_165.wav', name: 'Amen 08', bpm: 165 },
    { file: 'cw_amen09_175.wav', name: 'Amen 09', bpm: 175 },
    { file: 'cw_amen10_135.wav', name: 'Amen 10', bpm: 135 },
    { file: 'cw_amen11_145.wav', name: 'Amen 11', bpm: 145 },
    { file: 'cw_amen12_137.wav', name: 'Amen 12', bpm: 137 },
    { file: 'cw_amen13_173.wav', name: 'Amen 13', bpm: 173 },
    { file: 'cw_amen14_175.wav', name: 'Amen 14', bpm: 175 },
    { file: 'cw_amen15_174.wav', name: 'Amen 15', bpm: 174 },
    { file: 'cw_amen16_167.wav', name: 'Amen 16', bpm: 167 },
    { file: 'cw_amen17_175.wav', name: 'Amen 17', bpm: 175 },
    { file: 'cw_amen18_178.wav', name: 'Amen 18', bpm: 178 },
    { file: 'cw_amen19_172.wav', name: 'Amen 19', bpm: 172 },
    { file: 'cw_amen20_164.wav', name: 'Amen 20', bpm: 164 },
  ];

  const SAMPLES_DIR = 'samples/';

  // ─── Audio Context ──────────────────────────────────────────────────────────
  let ctx = null;
  let masterGain = null;
  let reverbNode = null;
  let reverbGain = null;
  let dryGain = null;

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.8;

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

  // ─── Reverb (convolution with generated impulse) ───────────────────────────
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

  // ─── Load WAV Sample ──────────────────────────────────────────────────────
  async function loadSample(filename) {
    const url = SAMPLES_DIR + filename;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to load ' + filename + '. Make sure WAV files are in the samples/ folder.');
    }
    const arrayBuffer = await response.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
  }

  // ─── State ──────────────────────────────────────────────────────────────────
  let amenBuffer = null;       // the loaded WAV AudioBuffer
  let sampleBpm = 137;         // native BPM of the loaded sample
  let sliceOrder = [];
  let numSlices = 16;
  let isPlaying = false;
  let schedulerTimer = null;
  let nextSliceIndex = 0;
  let nextSliceTime = 0;
  let currentBpm = 137;
  let pitchRate = 1.0;
  let swingAmount = 0;
  let crushBits = 16;
  let isLoading = false;

  // ─── DOM refs ───────────────────────────────────────────────────────────────
  const sampleSelect = document.getElementById('sample-select');
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

  // ─── Populate Sample Dropdown ──────────────────────────────────────────────
  function populateSampleSelect() {
    SAMPLES.forEach((s, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = s.name + ' (' + s.bpm + ' BPM)';
      sampleSelect.appendChild(opt);
    });
  }

  // ─── Load & Rebuild ────────────────────────────────────────────────────────
  async function loadAndRebuild(sampleIndex) {
    ensureContext();
    isLoading = true;
    playBtn.disabled = true;
    playBtn.textContent = '...';

    try {
      const sample = SAMPLES[sampleIndex];
      amenBuffer = await loadSample(sample.file);
      sampleBpm = sample.bpm;

      // Set BPM slider to the sample's native BPM
      currentBpm = sample.bpm;
      bpmSlider.value = currentBpm;
      bpmVal.textContent = currentBpm;

      numSlices = parseInt(sliceSelect.value, 10);
      sliceOrder = Array.from({ length: numSlices }, (_, i) => i);
      drawWaveform();
      drawSliceMarkers();
      buildSliceGrid();
    } catch (err) {
      alert(err.message);
    } finally {
      isLoading = false;
      playBtn.disabled = false;
      playBtn.innerHTML = '<span id="play-icon">&#9654;</span>';
    }
  }

  function rebuildSlices() {
    numSlices = parseInt(sliceSelect.value, 10);
    sliceOrder = Array.from({ length: numSlices }, (_, i) => i);
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

    c.fillStyle = '#0d0d0d';
    c.fillRect(0, 0, w, h);

    if (!amenBuffer) return;
    const data = amenBuffer.getChannelData(0);
    const step = Math.ceil(data.length / w);
    const mid = h / 2;

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
  // The buffer contains the full break at its native BPM.
  // We slice it evenly by time. BPM changes are achieved via playback rate.

  function getBpmRate() {
    return currentBpm / sampleBpm;
  }

  function getSliceDuration() {
    // Duration of one slice at the CURRENT bpm (accounting for time-stretch)
    const totalDur = amenBuffer.duration;
    return (totalDur / numSlices) / getBpmRate();
  }

  function getSliceOffset(sliceIndex) {
    const totalDur = amenBuffer.duration;
    return (sliceIndex / numSlices) * totalDur;
  }

  function scheduleSlice(sliceIdx, when) {
    const src = ctx.createBufferSource();
    src.buffer = amenBuffer;

    // Combined rate: BPM adjustment * pitch knob
    const combinedRate = getBpmRate() * pitchRate;
    src.playbackRate.value = combinedRate;

    // Bit crushing via waveshaper
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
    const nativeDuration = amenBuffer.duration / numSlices;
    // Play the slice segment from the buffer
    src.start(when, offset, nativeDuration);
  }

  function startScheduler() {
    const lookahead = 0.1;
    const interval = 25;

    schedulerTimer = setInterval(() => {
      while (nextSliceTime < ctx.currentTime + lookahead) {
        scheduleSlice(nextSliceIndex, nextSliceTime);

        let dur = getSliceDuration() / pitchRate;
        // Swing
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

  let playStartTime = 0;

  function startPlayheadAnimation() {
    function animate() {
      if (!isPlaying) {
        playhead.style.opacity = '0';
        return;
      }
      playhead.style.opacity = '1';

      const sliceDur = getSliceDuration() / pitchRate;
      const totalDur = sliceDur * numSlices;
      const loopTime = (ctx.currentTime - playStartTime) % totalDur;
      const pct = (loopTime / totalDur) * 100;
      playhead.style.left = pct + '%';

      const currentSlice = Math.floor((loopTime / totalDur) * numSlices);
      highlightSlice(currentSlice);

      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  function play() {
    if (!amenBuffer || isLoading) return;
    ensureContext();
    isPlaying = true;
    playBtn.classList.add('playing');
    playIcon.innerHTML = '&#9632;';
    nextSliceIndex = 0;
    nextSliceTime = ctx.currentTime + 0.05;
    playStartTime = nextSliceTime;
    startScheduler();
    startPlayheadAnimation();
  }

  function stop() {
    isPlaying = false;
    playBtn.classList.remove('playing');
    const icon = document.getElementById('play-icon');
    if (icon) icon.innerHTML = '&#9654;';
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

  randomizeBtn.addEventListener('click', () => shuffleSlices());
  resetBtn.addEventListener('click', () => resetSlices());

  sampleSelect.addEventListener('change', () => {
    const wasPlaying = isPlaying;
    if (wasPlaying) stop();
    loadAndRebuild(parseInt(sampleSelect.value, 10)).then(() => {
      if (wasPlaying) play();
    });
  });

  bpmSlider.addEventListener('input', () => {
    currentBpm = parseInt(bpmSlider.value, 10);
    bpmVal.textContent = currentBpm;
    // BPM changes take effect on next scheduled slice — no rebuild needed
  });

  sliceSelect.addEventListener('change', () => {
    const wasPlaying = isPlaying;
    if (wasPlaying) stop();
    rebuildSlices();
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

  window.addEventListener('resize', () => {
    if (amenBuffer) drawWaveform();
  });

  // ─── Init ───────────────────────────────────────────────────────────────────
  populateSampleSelect();
  // Draw empty waveform
  drawWaveform();

  // Auto-load the first sample on first user click (autoplay policy)
  let initialized = false;
  document.addEventListener('click', function init() {
    if (initialized) return;
    initialized = true;
    loadAndRebuild(0);
  }, { once: false });

  // Also try loading immediately (works if served from localhost)
  loadAndRebuild(0).catch(() => {
    // Will retry on first click
  });

})();
