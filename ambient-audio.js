(function () {
  var STORAGE_KEY = 'urx_sound_on';
  var ctx = null, master = null, scheduler = null, leadScheduler = null, nodes = [], soundPref = false;

  function isOn() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return v === null ? true : v === '1';
    } catch (e) { return true; }
  }
  function setOn(v) {
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch (e) {}
  }

  function start() {
    if (ctx) return;
    if (window.__urxAudioCtx) {
      try { window.__urxAudioCtx.close(); } catch (e) {}
      window.__urxAudioCtx = null;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      window.__urxAudioCtx = ctx;
      master = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 1);
      master.connect(ctx.destination);

      var bpm = 150;
      var stepTime = 60 / bpm / 4;

      function playKick(t) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(38, t + 0.13);
        g.gain.setValueAtTime(1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.32);
      }
      function playSnare(t) {
        var bufferSize = ctx.sampleRate * 0.18;
        var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
        var src = ctx.createBufferSource(); src.buffer = buffer;
        var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(2200, t); bp.Q.setValueAtTime(0.8, t);
        var g = ctx.createGain(); g.gain.setValueAtTime(0.6, t);
        src.connect(bp); bp.connect(g); g.connect(master);
        src.start(t);
        var o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(190, t);
        og.gain.setValueAtTime(0.4, t);
        og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(og); og.connect(master);
        o.start(t); o.stop(t + 0.12);
      }
      function playHat(t, accent) {
        var bufferSize = ctx.sampleRate * 0.035;
        var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        var src = ctx.createBufferSource(); src.buffer = buffer;
        var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime(8500, t);
        var g = ctx.createGain(); g.gain.setValueAtTime(accent ? 0.14 : 0.06, t);
        src.connect(hp); hp.connect(g); g.connect(master);
        src.start(t);
      }

      var bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'lowpass'; bassFilter.Q.setValueAtTime(14, ctx.currentTime);
      var distortion = ctx.createWaveShaper();
      (function () {
        var n = 4096, curve = new Float32Array(n), amt = 70;
        for (var i = 0; i < n; i++) { var x = (i * 2) / n - 1; curve[i] = ((3 + amt) * x * 20 * Math.PI / 180) / (Math.PI + amt * Math.abs(x)); }
        distortion.curve = curve;
      })();
      var duckGain = ctx.createGain(); duckGain.gain.setValueAtTime(1, ctx.currentTime);
      distortion.connect(duckGain); duckGain.connect(master);
      function duck(t) {
        duckGain.gain.cancelScheduledValues(t);
        duckGain.gain.setValueAtTime(0.35, t);
        duckGain.gain.linearRampToValueAtTime(1, t + 0.12);
      }
      function playImpact(t) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(90, t);
        o.frequency.exponentialRampToValueAtTime(28, t + 0.5);
        g.gain.setValueAtTime(1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.6);
        var bufferSize = ctx.sampleRate * 0.3;
        var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.2);
        var src = ctx.createBufferSource(); src.buffer = buffer;
        var g2 = ctx.createGain(); g2.gain.setValueAtTime(0.4, t);
        src.connect(g2); g2.connect(master);
        src.start(t);
      }
      // clean separated sub layer (never distorted, keeps the bottom end tight)
      function playSub(t, freq, dur) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.38, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + dur);
      }
      // BASS CHARACTER LIBRARY — call-and-response vocabulary, not one repeating wobble
      function bassGrowl(t, freq, dur) {
        var o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
        o1.type = 'sawtooth'; o1.frequency.setValueAtTime(freq, t);
        o2.type = 'sawtooth'; o2.frequency.setValueAtTime(freq * 1.008, t); o2.detune.setValueAtTime(7, t);
        var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.setValueAtTime(16, t);
        var lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.setValueAtTime(28, t);
        var lfoGain = ctx.createGain(); lfoGain.gain.setValueAtTime(500, t);
        lfo.connect(lfoGain); lfoGain.connect(f.frequency);
        f.frequency.setValueAtTime(700, t);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.4, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(distortion);
        o1.start(t); o1.stop(t + dur); o2.start(t); o2.stop(t + dur); lfo.start(t); lfo.stop(t + dur);
        duck(t); playSub(t, freq / 2, dur);
      }
      function bassReese(t, freq, dur) {
        var voices = [0, -14, 14, -6];
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.32, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1200, t); f.Q.setValueAtTime(6, t);
        f.frequency.exponentialRampToValueAtTime(300, t + dur * 0.8);
        voices.forEach(function (cents) {
          var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t); o.detune.setValueAtTime(cents, t);
          o.connect(f); o.start(t); o.stop(t + dur);
        });
        f.connect(g); g.connect(distortion);
        duck(t); playSub(t, freq / 2, dur);
      }
      function bassMetallic(t, freq, dur) {
        var o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
        o1.type = 'square'; o1.frequency.setValueAtTime(freq, t);
        o2.type = 'square'; o2.frequency.setValueAtTime(freq * 2.756, t);
        var g1 = ctx.createGain(), g2 = ctx.createGain();
        g1.gain.setValueAtTime(0.0001, t); g1.gain.linearRampToValueAtTime(0.32, t + 0.006); g1.gain.exponentialRampToValueAtTime(0.001, t + dur);
        g2.gain.setValueAtTime(0.0001, t); g2.gain.linearRampToValueAtTime(0.14, t + 0.006); g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.6);
        var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq * 3, t); f.Q.setValueAtTime(4, t);
        o1.connect(f); f.connect(g1); g1.connect(distortion);
        o2.connect(g2); g2.connect(master);
        o1.start(t); o1.stop(t + dur); o2.start(t); o2.stop(t + dur * 0.6);
        duck(t); playSub(t, freq / 2, dur);
      }
      function bassStab(t, freq) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.4, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        o.connect(g); g.connect(distortion);
        o.start(t); o.stop(t + 0.09);
        duck(t);
      }
      function bassPitchDive(t, freq, dur) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(freq * 3, t);
        o.frequency.exponentialRampToValueAtTime(freq * 0.4, t + dur);
        g.gain.setValueAtTime(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(distortion);
        o.start(t); o.stop(t + dur);
        duck(t); playSub(t, freq / 2, dur);
      }
      function bassSubHit(t, freq, dur) {
        playSub(t, freq / 2, dur);
        duck(t);
      }
      var bassCharacters = [bassGrowl, bassReese, bassMetallic, bassPitchDive];

      // industrial intro texture: rumble + electrical hum + geiger clicks, present during sparse sections
      var rumble = ctx.createOscillator(); rumble.type = 'sine'; rumble.frequency.setValueAtTime(38, ctx.currentTime);
      var rumbleGain = ctx.createGain(); rumbleGain.gain.setValueAtTime(0.05, ctx.currentTime);
      rumble.connect(rumbleGain); rumbleGain.connect(master); rumble.start();
      var hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.setValueAtTime(60, ctx.currentTime);
      var humFilter = ctx.createBiquadFilter(); humFilter.type = 'lowpass'; humFilter.frequency.setValueAtTime(200, ctx.currentTime);
      var humGain = ctx.createGain(); humGain.gain.setValueAtTime(0.02, ctx.currentTime);
      hum.connect(humFilter); humFilter.connect(humGain); humGain.connect(master); hum.start();
      function playGeigerClick(t) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square'; o.frequency.setValueAtTime(2200 + Math.random() * 1800, t);
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.02);
      }
      function playScreechLead(t, freq) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(freq * 2.4, t + 0.09);
        o.frequency.exponentialRampToValueAtTime(freq * 0.8, t + 0.2);
        var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq * 3, t); f.Q.setValueAtTime(8, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.22, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.connect(f); f.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.22);
      }
      function playVocalChop(t, freq) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t);
        var f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.setValueAtTime(900, t); f1.Q.setValueAtTime(6, t);
        var f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.setValueAtTime(1800, t); f2.Q.setValueAtTime(6, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.24, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        o.connect(f1); f1.connect(f2); f2.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.14);
      }

      var barLen = stepTime * 16;
      var sections = [
        { name: 's1', bars: 8, note: 41.2, wobbleSteps: [0, 4, 8, 12], drums: 'sparse', lead: false },
        { name: 's2', bars: 8, note: 41.2, wobbleSteps: [0, 2, 4, 6, 8, 10, 12, 14], drums: 'building', lead: true },
        { name: 's3', bars: 12, note: 41.2, wobbleSteps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], drums: 'full', lead: true },
        { name: 's4', bars: 8, note: 46.2, wobbleSteps: [0, 4, 8, 12], drums: 'sparse', lead: false },
        { name: 's5', bars: 8, note: 46.2, wobbleSteps: [0, 2, 4, 6, 8, 10, 12, 14], drums: 'building', lead: true },
        { name: 's6', bars: 12, note: 46.2, wobbleSteps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], drums: 'full', lead: true },
        { name: 's7', bars: 8, note: 36.7, wobbleSteps: [0, 4, 8, 12], drums: 'sparse', lead: false },
        { name: 's8', bars: 8, note: 36.7, wobbleSteps: [0, 2, 4, 6, 8, 10, 12, 14], drums: 'building', lead: true },
        { name: 's9', bars: 20, note: 41.2, wobbleSteps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], drums: 'full', lead: true },
        { name: 's10', bars: 8, note: 41.2, wobbleSteps: [0, 4, 8, 12], drums: 'sparse', lead: false }
      ];
      var totalBars = sections.reduce(function (a, s) { return a + s.bars; }, 0);
      function getSectionForBar(n) {
        var acc = 0;
        for (var i = 0; i < sections.length; i++) {
          if (n < acc + sections[i].bars) return { section: sections[i], barInSection: n - acc };
          acc += sections[i].bars;
        }
        return { section: sections[0], barInSection: 0 };
      }

      var leadDelay = ctx.createDelay(); leadDelay.delayTime.setValueAtTime(stepTime * 3, ctx.currentTime);
      var leadFeedback = ctx.createGain(); leadFeedback.gain.setValueAtTime(0.3, ctx.currentTime);
      leadDelay.connect(leadFeedback); leadFeedback.connect(leadDelay); leadDelay.connect(master);
      function playGlitch(t) {
        var bufferSize = ctx.sampleRate * (0.02 + Math.random() * 0.08);
        var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        var src = ctx.createBufferSource(); src.buffer = buffer;
        src.playbackRate.setValueAtTime(0.5 + Math.random() * 2.5, t);
        var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(1000 + Math.random() * 6000, t);
        var g = ctx.createGain(); g.gain.setValueAtTime(0.15 + Math.random() * 0.12, t);
        src.connect(bp); bp.connect(g); g.connect(master);
        src.start(t);
      }
      function playRiser(t, dur) {
        var bufferSize = ctx.sampleRate * dur;
        var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
        var src = ctx.createBufferSource(); src.buffer = buffer;
        var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.setValueAtTime(400, t);
        bp.frequency.exponentialRampToValueAtTime(9000, t + dur);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(0.26, t + dur * 0.9);
        g.gain.linearRampToValueAtTime(0, t + dur);
        src.connect(bp); bp.connect(g); g.connect(master);
        src.start(t);
      }
      function playSnareRoll(t) {
        for (var k = 0; k < 4; k++) playSnare(t + k * (stepTime / 3));
      }
      function playLead(t, freq) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.18, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepTime * 1.8);
        o.connect(g); g.connect(master); g.connect(leadDelay);
        o.start(t); o.stop(t + stepTime * 2);
      }
      var leadPattern = [220, 0, 0, 220, 0, 261.6, 0, 0, 220, 0, 0, 220, 0, 196, 0, 0];

      var barIdx = 0;
      function currentSection() {
        return getSectionForBar(barIdx % totalBars);
      }

      var step = 0;
      var nextTime = ctx.currentTime + 0.1;
      var wobbleFlip = false;
      scheduler = setInterval(function () {
        while (nextTime < ctx.currentTime + 0.15) {
          var s16 = step % 16;
          if (s16 === 0) barIdx++;
          var info = currentSection();
          var sec = info.section;
          var isLastBarOfBuild = (sec.name === 's2' || sec.name === 's5' || sec.name === 's8') && info.barInSection === sec.bars - 1;

          if (s16 === 0) playKick(nextTime);
          if (s16 === 3) playKick(nextTime);
          if (s16 === 8) playSnare(nextTime);
          if (s16 === 11) playSnare(nextTime);
          if (sec.drums !== 'sparse' && s16 === 6) playKick(nextTime);
          if (sec.drums === 'full' ? s16 % 2 === 0 : s16 % 4 === 0) playHat(nextTime, s16 === 8);
          if (sec.drums === 'full' && (s16 === 2 || s16 === 10)) playVocalChop(nextTime, sec.note * 6);
          if (sec.lead && leadPattern[s16]) {
            if (sec.drums === 'full') playScreechLead(nextTime, leadPattern[s16]);
            else playLead(nextTime, leadPattern[s16]);
          }

          if (sec.wobbleSteps.indexOf(s16) !== -1) {
            if (sec.drums === 'full') {
              var charIdx = (info.barInSection + sec.wobbleSteps.indexOf(s16)) % bassCharacters.length;
              var dur = barLen / sec.wobbleSteps.length * 0.9;
              if ((info.barInSection + sec.wobbleSteps.indexOf(s16)) % 5 === 4) {
                bassStab(nextTime, sec.note * 2);
              } else {
                bassCharacters[charIdx](nextTime, sec.note, dur);
              }
            } else {
              wobbleFlip = !wobbleFlip;
              bassSubHit(nextTime, sec.note, barLen / sec.wobbleSteps.length * 0.9);
            }
          }
          if (isLastBarOfBuild && s16 === 12) playRiser(nextTime, stepTime * 4);
          if (isLastBarOfBuild && (s16 === 13 || s16 === 14)) playSnareRoll(nextTime);
          // Skrillex-style silence-then-blast: brief robotic stutter chop right before the drop, then dead silence, then impact
          if (isLastBarOfBuild && s16 === 15) {
            for (var c = 0; c < 6; c++) playVocalChop(nextTime + c * (stepTime / 6), sec.note * 8);
          }
          if (s16 === 0 && info.barInSection === 0 && sec.drums === 'full') playImpact(nextTime);
          if (Math.random() < (sec.drums === 'full' ? 0.16 : 0.03)) playGlitch(nextTime);
          if (sec.drums === 'sparse' && Math.random() < 0.15) playGeigerClick(nextTime);

          nextTime += stepTime;
          step++;
        }
      }, 25);
    } catch (e) {}
  }

  function stop() {
    if (scheduler) { clearInterval(scheduler); scheduler = null; }
    if (ctx) {
      var c = ctx, m = master;
      ctx = null; master = null; nodes = [];
      if (window.__urxAudioCtx === c) window.__urxAudioCtx = null;
      try {
        var now = c.currentTime;
        if (m) m.gain.linearRampToValueAtTime(0, now + 0.3);
      } catch (e) {}
      setTimeout(function () { try { c.close(); } catch (e) {} }, 400);
    }
  }

  function updateIcon(btn) {
    btn.textContent = isOn() ? '\uD83D\uDD0A' : '\uD83D\uDD07';
  }

  window.urxAudio = {
    isOn: isOn,
    toggle: function () {
      var next = !isOn();
      soundPref = next;
      setOn(next);
      if (next) start(); else stop();
      if (window.urxAudio._btn) updateIcon(window.urxAudio._btn);
      return next;
    },
    ensureStarted: function () {
      if (isOn() && !ctx) start();
    }
  };

  function makeButton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle site sound');
    btn.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:400;width:42px;height:42px;border-radius:50%;background:rgba(15,16,18,0.9);border:1px solid rgba(255,106,26,0.4);color:#ff8a52;font-size:17px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
    updateIcon(btn);
    window.urxAudio._btn = btn;
    btn.addEventListener('click', function () {
      window.urxAudio.toggle();
    });
    document.body.appendChild(btn);
  }

  function playClickSound() {
    if (!isOn() || !ctx) return;
    try {
      var now = ctx.currentTime;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(700, now);
      o.frequency.exponentialRampToValueAtTime(180, now + 0.06);
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      o.connect(g); g.connect(master);
      o.start(now); o.stop(now + 0.08);
    } catch (e) {}
  }

  function playTransitionWhoosh() {
    if (!isOn()) return;
    try {
      var localCtx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      var now = localCtx.currentTime;
      var dest = master || localCtx.destination;
      var bass = localCtx.createOscillator(); var bassGain = localCtx.createGain();
      bass.type = 'sine'; bass.frequency.setValueAtTime(180, now);
      bass.frequency.exponentialRampToValueAtTime(38, now + 0.4);
      bassGain.gain.setValueAtTime(0.0001, now);
      bassGain.gain.exponentialRampToValueAtTime(0.5, now + 0.05);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      bass.connect(bassGain); bassGain.connect(dest);
      bass.start(now); bass.stop(now + 0.9);
      var riser = localCtx.createOscillator(); var riserGain = localCtx.createGain();
      riser.type = 'sawtooth'; riser.frequency.setValueAtTime(220, now);
      riser.frequency.exponentialRampToValueAtTime(1600, now + 0.5);
      riserGain.gain.setValueAtTime(0.0001, now);
      riserGain.gain.exponentialRampToValueAtTime(0.14, now + 0.35);
      riserGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      riser.connect(riserGain); riserGain.connect(dest);
      riser.start(now); riser.stop(now + 0.55);
      [1, 1.5, 2].forEach(function (mult, i) {
        var stab = localCtx.createOscillator(); var stabGain = localCtx.createGain();
        stab.type = 'square'; stab.frequency.setValueAtTime(110 * mult, now + 0.45);
        stabGain.gain.setValueAtTime(0.0001, now + 0.45);
        stabGain.gain.exponentialRampToValueAtTime(0.12 / (i + 1), now + 0.47);
        stabGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
        stab.connect(stabGain); stabGain.connect(dest);
        stab.start(now + 0.45); stab.stop(now + 0.75);
      });
    } catch (e) {}
  }
  window.urxAudio.playTransitionWhoosh = playTransitionWhoosh;

  function init() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', init); return; }
    if (window.__urxAudioCtx) {
      try { window.__urxAudioCtx.close(); } catch (e) {}
      window.__urxAudioCtx = null;
    }
    if (!window.__urxHideAudioBtn) makeButton();
    soundPref = isOn();
    if (soundPref) {
      start();
    }
    window.addEventListener('pagehide', stop);
    window.addEventListener('beforeunload', stop);
    document.addEventListener('click', function (e) {
      if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (er) {} }
      var el = e.target.closest && e.target.closest('button, a.nav-tab, .btn-connect');
      if (el) playClickSound();
    }, true);
    document.addEventListener('touchend', function () {
      if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (er) {} }
    }, { passive: true });
  }
  init();
})();
