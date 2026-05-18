// editor-extras.js — adds undo/redo, copy/paste pose, timeline pins,
// frame stepping, play preview, snap angles, and caption editing.
// Hooks into the existing BJJ + edit-mode plumbing without modifying core files.

(function () {
  function ready(fn) {
    if (window.BJJ && window.BJJ.setEditMode) fn();
    else setTimeout(() => ready(fn), 60);
  }
  ready(init);

  function init() {
    // === Undo / Redo system ============================================
    const history = [];
    let historyIdx = -1;
    const HISTORY_MAX = 80;

    function snapshot() {
      const { attacker, opponent } = window.BJJ;
      const capFig = (f) => {
        const bones = {};
        for (const k in f.joints) {
          if (k === 'root') continue;
          const q = f.joints[k].quaternion;
          bones[k] = [q.x, q.y, q.z, q.w];
        }
        return {
          pos: f.root.position.toArray(),
          rot: [f.root.rotation.x, f.root.rotation.y, f.root.rotation.z],
          bones,
        };
      };
      return { att: capFig(attacker), opp: capFig(opponent) };
    }
    function restore(snap) {
      const { attacker, opponent } = window.BJJ;
      const restoreFig = (f, s) => {
        f.root.position.fromArray(s.pos);
        f.root.rotation.set(...s.rot);
        for (const k in s.bones) {
          if (f.joints[k]) {
            const q = s.bones[k];
            f.joints[k].quaternion.set(q[0], q[1], q[2], q[3]);
          }
        }
      };
      restoreFig(attacker, snap.att);
      restoreFig(opponent, snap.opp);
    }
    function pushHistory() {
      // Truncate forward history
      if (historyIdx < history.length - 1) history.length = historyIdx + 1;
      history.push(snapshot());
      if (history.length > HISTORY_MAX) history.shift();
      historyIdx = history.length - 1;
    }
    function undo() {
      if (historyIdx <= 0) return;
      historyIdx--;
      restore(history[historyIdx]);
      window.BJJ.renderer.render(window.BJJ.scene, window.BJJ.camera);
      showHistoryToast('Undo');
    }
    function redo() {
      if (historyIdx >= history.length - 1) return;
      historyIdx++;
      restore(history[historyIdx]);
      window.BJJ.renderer.render(window.BJJ.scene, window.BJJ.camera);
      showHistoryToast('Redo');
    }
    // Initial snapshot
    pushHistory();
    // Snapshot on every save
    const origSave = document.getElementById('epSave');
    if (origSave) {
      origSave.addEventListener('click', () => setTimeout(pushHistory, 100));
    }
    // Snapshot + mark dirty when gizmo finishes dragging (debounced)
    document.addEventListener('pointerup', (e) => {
      if (window.BJJ.editIsActive && window.BJJ.editIsActive()) {
        // Skip pointerups that land on the step panel. markDirty() fires the
        // onDirtyChange listener, which calls renderStepPanel() — that rebuilds
        // the panel's innerHTML, destroying the very button being clicked
        // before its `click` event can fire (mousedown lands on the old
        // button, mouseup on the rebuilt panel → no click). The step panel
        // never edits a pose, so it can never legitimately make a step dirty.
        if (e.target && e.target.closest && e.target.closest('#stepPanel')) return;
        setTimeout(pushHistory, 80);
        // Mark current step dirty
        if (window.PoseStore && window.BJJ.editGetActiveMove
            && window.BJJ.editGetActiveStep) {
          const mId = window.BJJ.editGetActiveMove();
          const sIdx = window.BJJ.editGetActiveStep();
          if (mId != null) window.PoseStore.markDirty(mId, sIdx);
        }
      }
    }, true);

    document.addEventListener('keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); }
    });

    function showHistoryToast(text) {
      let el = document.getElementById('toast');
      if (!el) {
        el = document.createElement('div'); el.id = 'toast';
        document.body.appendChild(el);
      }
      el.textContent = text;
      el.classList.add('show');
      clearTimeout(showHistoryToast._t);
      showHistoryToast._t = setTimeout(() => el.classList.remove('show'), 900);
    }

    // === Copy / paste pose ============================================
    let clipboardPose = null;
    function copyPose(figName) {
      const f = figName === 'att' ? window.BJJ.attacker : window.BJJ.opponent;
      const bones = {};
      for (const k in f.joints) {
        if (k === 'root') continue;
        const q = f.joints[k].quaternion;
        bones[k] = [q.x, q.y, q.z, q.w];
      }
      clipboardPose = {
        bones,
        rot: [f.root.rotation.x, f.root.rotation.y, f.root.rotation.z],
      };
      showHistoryToast('Pose copied');
    }
    function pastePose(figName, opts = {}) {
      if (!clipboardPose) {
        showHistoryToast('Clipboard empty'); return;
      }
      const f = figName === 'att' ? window.BJJ.attacker : window.BJJ.opponent;
      for (const k in clipboardPose.bones) {
        if (f.joints[k]) {
          let q = clipboardPose.bones[k];
          if (opts.mirror) q = mirrorBoneQuat(k, q);
          f.joints[k].quaternion.set(q[0], q[1], q[2], q[3]);
        }
      }
      if (opts.includeRot && !opts.mirror) {
        f.root.rotation.set(...clipboardPose.rot);
      }
      pushHistory();
      showHistoryToast(opts.mirror ? 'Pose pasted (mirrored)' : 'Pose pasted');
    }
    function mirrorBoneQuat(jointKey, q) {
      // Simple horizontal mirror: invert x rotation component.
      // For full mirror we'd need to swap L/R bones — but pasting onto a
      // figure rotated 180° (facing the other way) handles that naturally.
      return [q[0], -q[1], -q[2], q[3]];
    }

    // === Timeline pins + frame stepping + play preview ================
    // We watch for the anim scrubber being rendered and enhance it.
    const scrubberEl = document.getElementById('animScrubber');
    if (scrubberEl) {
      const obs = new MutationObserver(() => enhanceScrubber());
      obs.observe(scrubberEl, { childList: true, subtree: true });
    }

    let isPlaying = false;
    let playTimer = null;

    // Re-enhance the scrubber whenever it gets re-rendered (it's innerHTML'd
    // on every step change, which wipes our buttons).
    function maybeEnhance() {
      if (!scrubberEl) return;
      if (!scrubberEl.classList.contains('open')) return;
      const range = scrubberEl.querySelector('#scrubRange');
      const saveBtn = scrubberEl.querySelector('.set-step');
      if (!range || !saveBtn) return;
      // Already enhanced this DOM?
      if (scrubberEl.querySelector('[data-extras-toolbar]')) return;
      enhanceScrubber(range, saveBtn);
    }
    if (scrubberEl) {
      const obs = new MutationObserver(maybeEnhance);
      obs.observe(scrubberEl, { childList: true, subtree: true });
      setInterval(maybeEnhance, 400);
    }

    function enhanceScrubber(range, saveBtn) {
      // Toolbar with play/frame controls
      const ctrlWrap = document.createElement('div');
      ctrlWrap.dataset.extrasToolbar = '1';
      ctrlWrap.style.cssText = 'display:flex;gap:4px;margin-left:6px';
      const mkBtn = (label, fn, title) => {
        const b = document.createElement('button');
        b.style.cssText = 'background:var(--surface-2);color:var(--text);border:1px solid var(--border-2);padding:4px 8px;font-size:11px;cursor:pointer;border-radius:4px;font-family:inherit';
        b.textContent = label;
        if (title) b.title = title;
        b.onclick = fn;
        return b;
      };
      ctrlWrap.appendChild(mkBtn('⏮', () => stepFrame(-0.1), 'Back 0.1s'));
      ctrlWrap.appendChild(mkBtn('◀', () => stepFrame(-1 / 30), 'Back 1 frame'));
      const playBtn = mkBtn(isPlaying ? '⏸' : '▶', toggleAnimPlay, 'Play / pause');
      playBtn.dataset.playBtn = '1';
      ctrlWrap.appendChild(playBtn);
      ctrlWrap.appendChild(mkBtn('▶', () => stepFrame(1 / 30), 'Forward 1 frame'));
      ctrlWrap.appendChild(mkBtn('⏭', () => stepFrame(0.1), 'Forward 0.1s'));
      saveBtn.before(ctrlWrap);

      // Step pins along the timeline
      const movId = currentMoveId();
      const m = movId ? window.MOVES.find(x => x.id === movId) : null;
      if (m && m.animations) {
        const pinTrack = document.createElement('div');
        pinTrack.dataset.pinTrack = '1';
        pinTrack.style.cssText = 'position:absolute;left:0;right:0;top:-12px;height:14px;pointer-events:none;z-index:2';
        const rangeWrap = document.createElement('div');
        rangeWrap.style.cssText = 'flex:1;position:relative;display:flex;align-items:center';
        range.parentNode.insertBefore(rangeWrap, range);
        rangeWrap.appendChild(range);
        rangeWrap.appendChild(pinTrack);
        const duration = m.animations.duration || 1;
        const times = m.animations.stepTimes || [];
        times.forEach((t, i) => {
          const isCur = i === currentStepIdx();
          const pin = document.createElement('div');
          pin.style.cssText = `position:absolute;left:${(t / duration) * 100}%;
            transform:translateX(-50%);width:2px;height:10px;top:2px;
            background:var(--accent);opacity:${isCur ? 1 : 0.45}`;
          const lbl = document.createElement('div');
          lbl.style.cssText = `position:absolute;left:50%;top:-12px;
            transform:translateX(-50%);font-size:9px;color:var(--accent);
            font-family:monospace;font-weight:${isCur ? 700 : 400};
            opacity:${isCur ? 1 : 0.6}`;
          lbl.textContent = (i + 1);
          pin.appendChild(lbl);
          pinTrack.appendChild(pin);
        });
      }
    }

    function currentMoveId() {
      return window.BJJ.editGetActiveMove ? window.BJJ.editGetActiveMove() : null;
    }
    function currentStepIdx() {
      return window.BJJ.editGetActiveStep ? window.BJJ.editGetActiveStep() : 0;
    }

    function stepFrame(deltaSec) {
      const range = document.getElementById('scrubRange');
      if (!range) return;
      const newT = Math.max(parseFloat(range.min), Math.min(parseFloat(range.max),
        parseFloat(range.value) + deltaSec));
      range.value = newT;
      range.dispatchEvent(new Event('input'));
    }
    function toggleAnimPlay() {
      const range = document.getElementById('scrubRange');
      if (!range) return;
      if (isPlaying) {
        clearInterval(playTimer); playTimer = null;
        isPlaying = false;
      } else {
        isPlaying = true;
        const stepMs = 33;
        const stepSec = stepMs / 1000;
        playTimer = setInterval(() => {
          const r = document.getElementById('scrubRange');
          if (!r) { clearInterval(playTimer); playTimer = null; isPlaying = false; return; }
          const cur = parseFloat(r.value);
          const max = parseFloat(r.max);
          if (cur >= max) { clearInterval(playTimer); playTimer = null; isPlaying = false; updatePlayBtn(); return; }
          r.value = cur + stepSec;
          r.dispatchEvent(new Event('input'));
        }, stepMs);
      }
      updatePlayBtn();
    }
    function updatePlayBtn() {
      const b = scrubberEl && scrubberEl.querySelector('[data-play-btn="1"]');
      if (b) b.textContent = isPlaying ? '⏸' : '▶';
    }

    // === Edit panel toolbar (copy/paste/undo) =========================
    const editPanel = document.getElementById('editPanel');
    if (editPanel) {
      const toolbar = document.createElement('div');
      toolbar.className = 'ep-section';
      toolbar.innerHTML = `
        <div class="ep-row"><span class="ep-label">TOOLS</span></div>
        <div class="ep-mode-row">
          <button class="ep-mode" id="ep-undo" title="Undo (Cmd+Z)">↶ Undo</button>
          <button class="ep-mode" id="ep-redo" title="Redo (Cmd+Shift+Z)">↷ Redo</button>
        </div>
        <div class="ep-mode-row">
          <button class="ep-mode" id="ep-copy">⎘ Copy pose</button>
          <button class="ep-mode" id="ep-paste">⎗ Paste</button>
        </div>
        <div class="ep-mode-row">
          <button class="ep-mode" id="ep-paste-mirror">⎗ Paste mirrored</button>
        </div>
      `;
      // Insert after the SELECTED section
      const sections = editPanel.querySelectorAll('.ep-section');
      if (sections.length >= 2) {
        sections[1].after(toolbar);
      } else {
        editPanel.appendChild(toolbar);
      }
      document.getElementById('ep-undo').onclick = undo;
      document.getElementById('ep-redo').onclick = redo;
      document.getElementById('ep-copy').onclick = () => {
        const figName = getActiveFig();
        copyPose(figName);
      };
      document.getElementById('ep-paste').onclick = () => pastePose(getActiveFig());
      document.getElementById('ep-paste-mirror').onclick = () => pastePose(getActiveFig(), { mirror: true });
    }
    function getActiveFig() {
      const onAtt = document.querySelector('.ep-fig.on.att');
      return onAtt ? 'att' : 'opp';
    }

    // === Snap angles when holding Shift ===============================
    // TransformControls reads .translationSnap/.rotationSnap — we set them
    // on the gizmo from edit-mode.js by reaching into scene.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') setSnap(THREE.MathUtils.degToRad(15));
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') setSnap(null);
    });
    function setSnap(rad) {
      // Find TransformControls in scene
      window.BJJ.scene.traverse((o) => {
        if (o.isTransformControls) {
          o.setRotationSnap(rad);
          o.setTranslationSnap(rad != null ? 0.05 : null);
        }
      });
    }

    // Expose for debugging
    window.BJJ.editor = { undo, redo, copyPose, pastePose, pushHistory };

    // === Caption editing — click caption in step panel to edit ========
    // Caption + hint are rendered fresh each renderStepPanel call. Use
    // event delegation.
    document.addEventListener('click', (e) => {
      if (!window.BJJ.editIsActive || !window.BJJ.editIsActive()) return;
      const t = e.target;
      if (t.classList.contains('sp-caption') || t.classList.contains('sp-hint')) {
        const movId = currentMoveId();
        const stepIdx = currentStepIdx();
        if (!movId) return;
        const m = window.MOVES.find(x => x.id === movId);
        const field = t.classList.contains('sp-caption') ? 'caption' : 'hint';
        const cur = m.steps[stepIdx][field] || '';
        const next = window.prompt('Edit ' + field + ':', cur);
        if (next != null && next !== cur) {
          m.steps[stepIdx][field] = next;
          t.textContent = next;
          showHistoryToast(field + ' saved');
        }
      }
    });

    // === Step reordering — drag step number buttons in step bar =======
    let dragSrcIdx = null;
    document.addEventListener('mousedown', (e) => {
      const dot = e.target.closest('.dot');
      if (dot && window.BJJ.editIsActive && window.BJJ.editIsActive()) {
        dragSrcIdx = parseInt(dot.dataset.step);
      }
    });
    document.addEventListener('mouseup', (e) => {
      if (dragSrcIdx == null) return;
      const dot = e.target.closest('.dot');
      if (dot) {
        const tgtIdx = parseInt(dot.dataset.step);
        if (tgtIdx !== dragSrcIdx) {
          const movId = currentMoveId();
          if (movId) {
            const m = window.MOVES.find(x => x.id === movId);
            const step = m.steps.splice(dragSrcIdx, 1)[0];
            m.steps.splice(tgtIdx, 0, step);
            // Also swap stepTimes
            if (m.animations && m.animations.stepTimes) {
              const t = m.animations.stepTimes.splice(dragSrcIdx, 1)[0];
              m.animations.stepTimes.splice(tgtIdx, 0, t);
            }
            showHistoryToast('Step ' + (dragSrcIdx + 1) + ' → ' + (tgtIdx + 1));
            // Force re-render: click the new step
            setTimeout(() => {
              const newDot = document.querySelector(`.dot[data-step="${tgtIdx}"]`);
              if (newDot) newDot.click();
            }, 100);
          }
        }
      }
      dragSrcIdx = null;
    });

    // === Body collision warning =======================================
    // After each pose change, check whether the attacker's and opponent's
    // hitbox bounding boxes intersect significantly. Flash a warning badge.
    function checkCollision() {
      if (!window.BJJ.attacker || !window.BJJ.opponent) return;
      const att = window.BJJ.attacker;
      const opp = window.BJJ.opponent;
      const box = new THREE.Box3();
      let count = 0;
      for (const ap of att.parts) {
        const bp = box.setFromObject(ap).clone();
        for (const op of opp.parts) {
          const bp2 = box.setFromObject(op);
          if (bp.intersectsBox(bp2)) count++;
        }
      }
      showCollisionBadge(count);
    }
    let collisionBadge = null;
    function showCollisionBadge(count) {
      if (!collisionBadge) {
        collisionBadge = document.createElement('div');
        collisionBadge.style.cssText = `position:fixed;top:64px;left:50%;
          transform:translateX(-50%);background:#a83232;color:#fff;
          padding:5px 12px;border-radius:4px;font-size:11px;
          font-family:'JetBrains Mono',monospace;z-index:9;opacity:0;
          transition:opacity 0.2s;letter-spacing:0.1em;pointer-events:none`;
        document.body.appendChild(collisionBadge);
      }
      if (count > 4 && window.BJJ.editIsActive && window.BJJ.editIsActive()) {
        collisionBadge.textContent = '⚠ BODIES INTERSECTING (' + count + ' parts)';
        collisionBadge.style.opacity = '0.9';
      } else {
        collisionBadge.style.opacity = '0';
      }
    }
    setInterval(checkCollision, 400);

    // === Export / Import moves as JSON ===============================
    addExportImportUI();
    function addExportImportUI() {
      const editPanel = document.getElementById('editPanel');
      if (!editPanel) return;
      const sec = document.createElement('div');
      sec.className = 'ep-section';
      sec.innerHTML = `
        <div class="ep-row"><span class="ep-label">DATA</span></div>
        <div class="ep-mode-row">
          <button class="ep-mode" id="ep-export">⇩ Export move JSON</button>
        </div>
        <div class="ep-mode-row">
          <button class="ep-mode" id="ep-import">⇧ Import JSON</button>
          <button class="ep-mode" id="ep-record">● Record video</button>
        </div>
        <div class="ep-mode-row">
          <input type="file" id="ep-import-file" accept=".json" style="display:none">
          <button class="ep-mode" id="ep-ref-img">+ Reference photo</button>
          <input type="file" id="ep-ref-file" accept="image/*" style="display:none">
        </div>
      `;
      editPanel.appendChild(sec);

      document.getElementById('ep-export').onclick = () => {
        const movId = currentMoveId();
        if (!movId) { showHistoryToast('Open a move first'); return; }
        const m = window.MOVES.find(x => x.id === movId);
        const data = JSON.stringify(m, null, 2);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
        a.download = movId + '.json';
        a.click();
      };
      document.getElementById('ep-import').onclick = () => {
        document.getElementById('ep-import-file').click();
      };
      document.getElementById('ep-import-file').addEventListener('change', async (e) => {
        const f = e.target.files[0]; if (!f) return;
        const text = await f.text();
        try {
          const m = JSON.parse(text);
          const idx = window.MOVES.findIndex(x => x.id === m.id);
          if (idx >= 0) window.MOVES[idx] = m;
          else window.MOVES.push(m);
          showHistoryToast('Move imported: ' + m.name);
        } catch (err) {
          showHistoryToast('Bad JSON');
        }
      });

      // Reference image overlay
      document.getElementById('ep-ref-img').onclick = () => {
        document.getElementById('ep-ref-file').click();
      };
      document.getElementById('ep-ref-file').addEventListener('change', (e) => {
        const f = e.target.files[0]; if (!f) return;
        const url = URL.createObjectURL(f);
        showReferenceImage(url);
      });

      // Video recording
      let mediaRecorder = null;
      let recordedChunks = [];
      document.getElementById('ep-record').onclick = () => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
          const canvas = window.BJJ.renderer.domElement;
          const stream = canvas.captureStream(30);
          recordedChunks = [];
          mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
          };
          mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'bjj-move.webm';
            a.click();
          };
          mediaRecorder.start();
          document.getElementById('ep-record').textContent = '■ Stop recording';
          document.getElementById('ep-record').style.background = '#a83232';
          document.getElementById('ep-record').style.color = '#fff';
        } else {
          mediaRecorder.stop();
          document.getElementById('ep-record').textContent = '● Record video';
          document.getElementById('ep-record').style.background = '';
          document.getElementById('ep-record').style.color = '';
        }
      };
    }

    // === Reference image overlay =====================================
    function showReferenceImage(url) {
      let img = document.getElementById('ep-ref-overlay');
      if (!img) {
        img = document.createElement('img');
        img.id = 'ep-ref-overlay';
        img.style.cssText = `position:fixed;top:90px;left:160px;
          max-width:400px;max-height:60vh;opacity:0.4;z-index:8;
          pointer-events:auto;cursor:move;
          border:1px solid var(--accent);border-radius:8px;
          box-shadow:0 4px 20px rgba(0,0,0,0.5)`;
        document.body.appendChild(img);
        // Drag to move
        let dragOff = null;
        img.addEventListener('mousedown', (e) => {
          dragOff = { x: e.clientX - img.offsetLeft, y: e.clientY - img.offsetTop };
        });
        window.addEventListener('mousemove', (e) => {
          if (!dragOff) return;
          img.style.left = (e.clientX - dragOff.x) + 'px';
          img.style.top = (e.clientY - dragOff.y) + 'px';
        });
        window.addEventListener('mouseup', () => { dragOff = null; });

        // Opacity slider on top
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = 'ep-ref-opacity';
        slider.min = 0; slider.max = 1; slider.step = 0.05; slider.value = 0.4;
        slider.style.cssText = `position:fixed;top:96px;left:170px;width:200px;
          z-index:9;accent-color:var(--accent)`;
        slider.oninput = () => { img.style.opacity = slider.value; };
        document.body.appendChild(slider);

        // Close button
        const close = document.createElement('button');
        close.textContent = '✕';
        close.style.cssText = `position:fixed;top:96px;left:380px;
          background:#a83232;color:#fff;border:0;padding:3px 8px;
          border-radius:4px;cursor:pointer;z-index:9`;
        close.onclick = () => {
          img.remove(); slider.remove(); close.remove();
        };
        document.body.appendChild(close);
      }
      img.src = url;
    }
  }
})();
