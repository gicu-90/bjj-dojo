// UI overlay logic — waits for window.BJJ (set by scene.js after async FBX load).

(function () {
  function start() {
  const STORAGE_KEY = 'bjj.progress.v1';
  const SETTINGS_KEY = 'bjj.settings.v1';

  function loadJSON(k, def) {
    try { return JSON.parse(localStorage.getItem(k)) || def; }
    catch (_) { return def; }
  }
  function saveJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {}
  }

  const learned = new Set(loadJSON(STORAGE_KEY, []));
  const settings = Object.assign(
    { speed: 1, youColor: '#4fc3f7', oppColor: '#ef5350', autoplay: false, autoplayMs: 2200 },
    loadJSON(SETTINGS_KEY, {})
  );

  let activeMove = null;
  let activeStep = 0;
  let autoplayTimer = null;

  // ====== DOM REFS ======
  const $ = (sel) => document.querySelector(sel);
  const moveListEl = $('#moveList');
  const learnedCountEl = $('#learnedCount');
  const totalCountEl = $('#totalCount');
  const stepPanel = $('#stepPanel');
  const moveMenu = $('#moveMenu');
  const settingsPanel = $('#settingsPanel');
  const hintEl = $('#targetHint');
  const partLabel = $('#partLabel');

  totalCountEl.textContent = window.MOVES.length;

  // ====== HEX → uint helpers ======
  const hex = (s) => parseInt(s.replace('#', ''), 16);

  // ====== APPLY INITIAL SETTINGS ======
  function applySettings() {
    window.BJJ.setSpeed(settings.speed);
    window.BJJ.setFigureColors(hex(settings.youColor), hex(settings.oppColor));
    document.documentElement.style.setProperty('--you', settings.youColor);
    document.documentElement.style.setProperty('--opp', settings.oppColor);
  }
  applySettings();

  // ====== MOVE LIST RENDER ======
  function renderMoveList() {
    const byCat = {};
    window.MOVES.forEach((m) => {
      (byCat[m.category] = byCat[m.category] || []).push(m);
    });
    moveListEl.innerHTML = Object.keys(byCat)
      .map(
        (cat) => `
          <div class="cat">
            <div class="cat-h">${cat}</div>
            ${byCat[cat]
              .map(
                (m) => `
                  <button class="move-row" data-id="${m.id}" data-active="${activeMove === m.id ? 'true' : 'false'}">
                    <span class="move-icon">${m.icon}</span>
                    <span class="move-meta">
                      <span class="move-name">${m.name}</span>
                      <span class="move-sub">${m.difficulty} · ${m.steps.length} steps</span>
                    </span>
                    <span class="move-check ${learned.has(m.id) ? 'on' : ''}">${learned.has(m.id) ? '✓' : ''}</span>
                  </button>`
              )
              .join('')}
          </div>`
      )
      .join('');
    learnedCountEl.textContent = learned.size;
    moveListEl.querySelectorAll('.move-row').forEach((row) => {
      row.addEventListener('click', () => startMove(row.dataset.id));
    });
  }

  // ====== STEP PANEL RENDER ======
  function renderStepPanel() {
    if (!activeMove) {
      stepPanel.classList.remove('open');
      hintEl.classList.remove('hidden');
      return;
    }
    hintEl.classList.add('hidden');
    const m = window.MOVES.find((x) => x.id === activeMove);
    const step = m.steps[activeStep];
    const total = m.steps.length;
    stepPanel.classList.add('open');
    stepPanel.innerHTML = `
      <div class="sp-head">
        <div class="sp-name">
          <span class="sp-icon">${m.icon}</span>
          <div>
            <div class="sp-title">${m.name}</div>
            <div class="sp-cat">${m.category} · ${m.difficulty}</div>
          </div>
        </div>
        <button class="sp-close" title="Close" aria-label="Close">✕</button>
      </div>
      <div class="sp-body">
        <div class="sp-stepnum">STEP ${activeStep + 1} / ${total}</div>
        <div class="sp-caption">${step.caption}</div>
        <div class="sp-hint">${step.hint || ''}</div>
      </div>
      <div class="sp-progress">
        ${m.steps
          .map((s, i) => {
            const dirty = window.PoseStore && window.PoseStore.isDirty(m.id, i);
            const hasPose = !!(s.attPose && s.oppPose);
            const cls = dirty ? 'dirty' : (hasPose ? 'has-pose' : '');
            return `<button class="dot ${i === activeStep ? 'active' : ''} ${i < activeStep ? 'done' : ''} ${cls}" data-step="${i}" title="Step ${i+1}${dirty ? ' (unsaved)' : hasPose ? ' (saved)' : ' (no pose)'}"></button>`;
          })
          .join('')}
      </div>
      <div class="sp-controls">
        <button class="sp-btn" data-act="restart" title="Restart">↺</button>
        <button class="sp-btn sp-prev" data-act="prev" ${activeStep === 0 ? 'disabled' : ''}>◀ Prev</button>
        <button class="sp-btn sp-auto ${autoplayTimer ? 'on' : ''}" data-act="auto">${autoplayTimer ? '⏸ Pause' : '▶ Auto'}</button>
        <button class="sp-btn sp-next" data-act="next">${activeStep === total - 1 ? '✓ Finish' : 'Next ▶'}</button>
      </div>
    `;
    stepPanel.querySelector('.sp-close').onclick = () => endMove({ resetPose: true });
    stepPanel.querySelectorAll('.sp-controls .sp-btn').forEach((b) => {
      b.onclick = () => {
        const act = b.dataset.act;
        if (act === 'next') stepForward();
        if (act === 'prev') stepBackward();
        if (act === 'restart') { stopAutoplay(); jumpToStep(0); }
        if (act === 'auto') toggleAutoplay();
      };
    });
    stepPanel.querySelectorAll('.dot').forEach((d) => {
      d.onclick = () => { stopAutoplay(); jumpToStep(parseInt(d.dataset.step)); };
    });
  }

  // ====== MOVE FLOW ======
  function startMove(id) {
    const m = window.MOVES.find((x) => x.id === id);
    if (!m) return;
    activeMove = id;
    activeStep = 0;
    stopAutoplay();
    closeMoveMenu();
    closeSettings();
    // If move has animations, load them first then apply
    if (m.animations && window.BJJ.loadMoveAnimation) {
      window.BJJ.loadMoveAnimation(m.animations).then(() => {
        applyStep();
      });
    } else {
      // Disable animation mode if previously set
      if (window.BJJ.loadMoveAnimation) window.BJJ.loadMoveAnimation(null);
      applyStep();
    }
    renderMoveList();
    renderStepPanel();
  }
  function endMove(opts = {}) {
    activeMove = null;
    stopAutoplay();
    if (window.BJJ.loadMoveAnimation) window.BJJ.loadMoveAnimation(null);
    hideAnimScrubber();
    // Always return to the initial pose (Mixamo t=0 stance).
    const init = window.BJJ.getInitialPose && window.BJJ.getInitialPose();
    if (init) {
      window.BJJ.goToPose(init.attacker, init.opponent, 800);
    } else {
      window.BJJ.goToPose(window.fightStanceA(), window.fightStanceB(), 800);
    }
    renderMoveList();
    renderStepPanel();
  }
  function applyStep() {
    const m = window.MOVES.find((x) => x.id === activeMove);
    const step = m.steps[activeStep];
    // NEW: if step has its own pose data (attPose/oppPose), use it.
    if (step.attPose && step.oppPose) {
      window.BJJ.applyStepPoses(step.attPose, step.oppPose,
        step.transitionMs || 700);
      hideAnimScrubber();
      pulseTargets(m);
      return;
    }
    if (m.animations && window.BJJ.isAnimMode && window.BJJ.isAnimMode()) {
      const t = (m.animations.stepTimes && m.animations.stepTimes[activeStep]) || 0;
      window.BJJ.setAnimTime(t, 800, activeStep);
      renderAnimScrubber(m, activeStep, t);
    } else {
      window.BJJ.goToPose(step.attacker, step.opponent, 950);
      hideAnimScrubber();
    }
    pulseTargets(m);
  }

  function renderAnimScrubber(m, stepIdx, currentT) {
    const el = document.getElementById('animScrubber');
    if (!el) return;
    el.classList.add('open');
    el.innerHTML = `
      <span class="lbl">STEP ${stepIdx + 1} TIME</span>
      <input type="range" id="scrubRange" min="0" max="${m.animations.duration}" step="0.05" value="${currentT}">
      <span class="time" id="scrubTime">${currentT.toFixed(2)}s</span>
      <button class="set-step">Save as Step ${stepIdx + 1}</button>
    `;
    const range = el.querySelector('#scrubRange');
    const time = el.querySelector('#scrubTime');
    range.addEventListener('input', () => {
      const t = parseFloat(range.value);
      time.textContent = t.toFixed(2) + 's';
      window.BJJ.setAnimTime(t, 100);
    });
    el.querySelector('.set-step').onclick = () => {
      const t = parseFloat(range.value);
      m.animations.stepTimes[stepIdx] = t;
      showToast('Step ' + (stepIdx + 1) + ' saved at ' + t.toFixed(2) + 's');
    };
  }
  function hideAnimScrubber() {
    const el = document.getElementById('animScrubber');
    if (el) el.classList.remove('open');
  }
  function pulseTargets(m) {
    // Only pulse opponent targets on first step
    if (activeStep === 0) {
      m.target.forEach((t) => window.BJJ.pulseTarget(t));
    }
  }
  function stepForward() {
    const m = window.MOVES.find((x) => x.id === activeMove);
    if (activeStep < m.steps.length - 1) {
      activeStep++;
      applyStep();
      renderStepPanel();
    } else {
      // finish
      if (!learned.has(activeMove)) {
        learned.add(activeMove);
        saveJSON(STORAGE_KEY, [...learned]);
        showToast(`Learned: ${m.name} ✓`);
      }
      stopAutoplay();
      endMove();
    }
  }
  function stepBackward() {
    if (activeStep > 0) {
      activeStep--;
      applyStep();
      renderStepPanel();
    }
  }
  function jumpToStep(i) {
    activeStep = i;
    applyStep();
    renderStepPanel();
  }
  function toggleAutoplay() {
    if (autoplayTimer) stopAutoplay();
    else startAutoplay();
    renderStepPanel();
  }
  function startAutoplay() {
    const tick = () => {
      const m = window.MOVES.find((x) => x.id === activeMove);
      if (!m) return;
      if (activeStep >= m.steps.length - 1) {
        stopAutoplay();
        // finish on auto
        if (!learned.has(activeMove)) {
          learned.add(activeMove);
          saveJSON(STORAGE_KEY, [...learned]);
          showToast(`Learned: ${m.name} ✓`);
        }
        renderMoveList();
        renderStepPanel();
        return;
      }
      activeStep++;
      applyStep();
      renderStepPanel();
      autoplayTimer = setTimeout(tick, settings.autoplayMs / settings.speed);
    };
    autoplayTimer = setTimeout(tick, settings.autoplayMs / settings.speed);
  }
  function stopAutoplay() {
    if (autoplayTimer) clearTimeout(autoplayTimer);
    autoplayTimer = null;
  }

  // ====== CLICK ON OPPONENT → MENU ======
  window.BJJ.setOnTargetClick((bodyPart, x, y, mesh) => {
    if (!bodyPart) { closeMoveMenu(); return; }
    const moves = window.movesTargeting(bodyPart);
    showMoveMenu(bodyPart, moves, x, y);
  });

  function showMoveMenu(bodyPart, moves, x, y) {
    const label = window.BODY_PART_LABEL[bodyPart] || bodyPart;
    if (moves.length === 0) {
      moveMenu.innerHTML = `
        <div class="mm-head"><span class="mm-target">${label}</span></div>
        <div class="mm-empty">No moves target this yet. Try the head, neck, arms, or legs.</div>
      `;
    } else {
      moveMenu.innerHTML = `
        <div class="mm-head">
          <span class="mm-pre">Attack the</span>
          <span class="mm-target">${label}</span>
        </div>
        <div class="mm-list">
          ${moves
            .map(
              (m) => `
              <button class="mm-row" data-id="${m.id}">
                <span class="mm-icon">${m.icon}</span>
                <span class="mm-meta">
                  <span class="mm-name">${m.name}</span>
                  <span class="mm-sum">${m.summary}</span>
                </span>
                <span class="mm-go">▶</span>
              </button>`
            )
            .join('')}
        </div>
      `;
      moveMenu.querySelectorAll('.mm-row').forEach((r) => {
        r.onclick = () => { startMove(r.dataset.id); closeMoveMenu(); };
      });
    }
    // Position OFF to the side of the click so it doesn't cover the body part.
    const w = 300;
    const h = Math.min(360, 80 + moves.length * 64);
    const offset = 60;   // distance to the side
    let mx = x + offset;
    let my = y - 30;
    // Flip to left side if it would run off the right edge
    if (mx + w > window.innerWidth - 16) mx = x - w - offset;
    // Clamp to screen
    if (mx < 16) mx = 16;
    if (my + h > window.innerHeight - 16) my = window.innerHeight - h - 16;
    if (my < 16) my = 16;
    moveMenu.style.left = mx + 'px';
    moveMenu.style.top = my + 'px';
    moveMenu.style.display = 'block';
    moveMenu.classList.add('in');
  }
  function closeMoveMenu() {
    moveMenu.classList.remove('in');
    moveMenu.style.display = 'none';
    if (window.BJJ.clearHighlight) window.BJJ.clearHighlight();
  }
  document.addEventListener('click', (e) => {
    if (!moveMenu.contains(e.target) && e.target.id !== 'scene') {
      // closed by canvas handler if needed
    }
  });

  // ====== SETTINGS PANEL ======
  function renderSettings() {
    const youColors = ['#4fc3f7', '#9ccc65', '#ffd54f', '#ce93d8'];
    const oppColors = ['#ef5350', '#ff7043', '#ec407a', '#7e57c2'];
    settingsPanel.innerHTML = `
      <div class="set-head">
        <h3>Settings</h3>
        <button class="set-close">✕</button>
      </div>
      <div class="set-section">
        <div class="set-label">Animation speed <span class="set-val">${settings.speed.toFixed(2)}x</span></div>
        <input type="range" id="speedRange" min="0.4" max="2" step="0.05" value="${settings.speed}">
      </div>
      <div class="set-section">
        <div class="set-label">Auto-play delay <span class="set-val">${(settings.autoplayMs / 1000).toFixed(1)}s</span></div>
        <input type="range" id="autoRange" min="1000" max="4500" step="100" value="${settings.autoplayMs}">
      </div>
      <div class="set-section">
        <div class="set-label">Your color</div>
        <div class="swatches" data-target="you">
          ${youColors.map((c) => `<button class="swatch ${c === settings.youColor ? 'on' : ''}" data-c="${c}" style="--c:${c}"></button>`).join('')}
        </div>
      </div>
      <div class="set-section">
        <div class="set-label">Opponent color</div>
        <div class="swatches" data-target="opp">
          ${oppColors.map((c) => `<button class="swatch ${c === settings.oppColor ? 'on' : ''}" data-c="${c}" style="--c:${c}"></button>`).join('')}
        </div>
      </div>
      <div class="set-section">
        <div class="set-label">Camera</div>
        <div class="cam-row">
          <button data-cam="default">3/4</button>
          <button data-cam="front">Front</button>
          <button data-cam="side">Side</button>
          <button data-cam="top">Top</button>
          <button data-cam="hero">Hero</button>
        </div>
      </div>
      <div class="set-section">
        <div class="set-row">
          <button id="resetProgress" class="set-danger">Reset progress</button>
        </div>
      </div>
    `;
    settingsPanel.querySelector('.set-close').onclick = closeSettings;
    settingsPanel.querySelector('#speedRange').oninput = (e) => {
      settings.speed = parseFloat(e.target.value);
      saveJSON(SETTINGS_KEY, settings);
      window.BJJ.setSpeed(settings.speed);
      settingsPanel.querySelector('.set-section .set-val').textContent = settings.speed.toFixed(2) + 'x';
    };
    settingsPanel.querySelector('#autoRange').oninput = (e) => {
      settings.autoplayMs = parseInt(e.target.value);
      saveJSON(SETTINGS_KEY, settings);
      settingsPanel.querySelectorAll('.set-val')[1].textContent = (settings.autoplayMs / 1000).toFixed(1) + 's';
    };
    settingsPanel.querySelectorAll('.swatches').forEach((group) => {
      group.querySelectorAll('.swatch').forEach((b) => {
        b.onclick = () => {
          const c = b.dataset.c;
          if (group.dataset.target === 'you') settings.youColor = c;
          else settings.oppColor = c;
          saveJSON(SETTINGS_KEY, settings);
          applySettings();
          renderSettings();
        };
      });
    });
    settingsPanel.querySelectorAll('.cam-row button').forEach((b) => {
      b.onclick = () => window.BJJ.setCameraPreset(b.dataset.cam);
    });
    settingsPanel.querySelector('#resetProgress').onclick = () => {
      if (confirm('Reset learned moves?')) {
        learned.clear();
        saveJSON(STORAGE_KEY, []);
        renderMoveList();
        showToast('Progress reset.');
      }
    };
  }
  function openSettings() {
    renderSettings();
    settingsPanel.classList.add('open');
  }
  function closeSettings() {
    settingsPanel.classList.remove('open');
  }
  $('#settingsBtn').onclick = () => {
    if (settingsPanel.classList.contains('open')) closeSettings();
    else openSettings();
  };
  $('#resetCam').onclick = () => window.BJJ.setCameraPreset('default');

  // ====== POSE EDITOR EMBED ======
  // ====== POSE EDITOR (inline) ======
  $('#editorBtn').onclick = () => {
    if (window.BJJ.editIsActive && window.BJJ.editIsActive()) {
      window.BJJ.setEditMode(false);
    } else {
      window.BJJ.setEditMode(true);
    }
  };
  $('#editClose').onclick = () => window.BJJ.setEditMode(false);
  window.BJJ.editGetActiveMove = () => activeMove;
  window.BJJ.editGetActiveStep = () => activeStep;

  // === Mobile bottom-sheet drag-to-expand ===
  (function () {
    const panel = document.getElementById('editPanel');
    if (!panel) return;
    let startY = 0, startH = 0, dragging = false;
    function onStart(e) {
      const y = (e.touches ? e.touches[0].clientY : e.clientY);
      // Only initiate drag from the top 30px (where the drag handle sits)
      const r = panel.getBoundingClientRect();
      if (y - r.top > 30) return;
      startY = y;
      startH = r.height;
      dragging = true;
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      const y = (e.touches ? e.touches[0].clientY : e.clientY);
      const dy = startY - y;
      const newH = Math.min(window.innerHeight * 0.92, Math.max(180, startH + dy));
      panel.style.height = newH + 'px';
      panel.style.maxHeight = newH + 'px';
      // Toggle expanded class for any style sync
      panel.classList.toggle('expanded', newH > window.innerHeight * 0.65);
    }
    function onEnd() {
      if (!dragging) return;
      dragging = false;
      // Snap to nearest of small/large height
      const h = parseFloat(panel.style.height) || window.innerHeight * 0.55;
      if (h > window.innerHeight * 0.7) {
        panel.style.height = '85vh';
        panel.style.maxHeight = '85vh';
        panel.classList.add('expanded');
      } else if (h < window.innerHeight * 0.35) {
        // Swipe down far enough → close
        window.BJJ.setEditMode(false);
        panel.style.height = '';
        panel.style.maxHeight = '';
        panel.classList.remove('expanded');
      } else {
        panel.style.height = '55vh';
        panel.style.maxHeight = '55vh';
        panel.classList.remove('expanded');
      }
    }
    panel.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    panel.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
  })();

  // ====== KEY SHORTCUTS ======
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && activeMove) stepForward();
    else if (e.key === 'ArrowLeft' && activeMove) stepBackward();
    else if (e.key === 'Escape') { closeMoveMenu(); closeSettings(); }
    else if (e.key === ' ' && activeMove) { e.preventDefault(); toggleAutoplay(); }
  });

  // ====== TOAST ======
  let toastTimer;
  function showToast(text) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  // ====== INIT ======

  // Try to load autosaved POSE data only — never overwrite captions/hints
  // (those should always come from moves.js source of truth).
  if (window.PoseStore) {
    const saved = window.PoseStore.loadAutosave();
    if (saved && Array.isArray(saved) && saved.length === window.MOVES.length) {
      window.MOVES.forEach((m, i) => {
        const s = saved.find(x => x.id === m.id);
        if (!s) return;
        // Only restore pose data per step, NOT captions/hints/etc.
        if (Array.isArray(s.steps)) {
          s.steps.forEach((srcStep, si) => {
            if (!m.steps[si]) return;
            if (srcStep.attPose) m.steps[si].attPose = srcStep.attPose;
            if (srcStep.oppPose) m.steps[si].oppPose = srcStep.oppPose;
          });
        }
        // Restore animation step times if user tweaked them
        if (s.animations && m.animations && s.animations.stepTimes) {
          m.animations.stepTimes = s.animations.stepTimes;
        }
      });
    }
  }

  // Watch for dirty state changes to redraw indicators
  if (window.PoseStore && window.PoseStore.onDirtyChange) {
    window.PoseStore.onDirtyChange(() => {
      if (activeMove) renderStepPanel();
    });
  }

  renderMoveList();
  renderStepPanel();
  }

  // Wait for window.BJJ from scene.js (async FBX load)
  if (window.BJJ) start();
  else {
    const t = setInterval(() => {
      if (window.BJJ) { clearInterval(t); start(); }
    }, 50);
  }
})();
