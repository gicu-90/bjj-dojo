// edit-mode.js — attaches the pose editor to the live dojo scene.
// Toggle via setEditMode(true/false). Uses BJJ's scene, figures, animation system.

(function () {
  if (!window.BJJ) {
    // Wait for BJJ to be ready
    const t = setInterval(() => {
      if (window.BJJ) { clearInterval(t); init(); }
    }, 50);
    return;
  }
  init();

  function init() {
    const { scene, camera, renderer, controls, attacker, opponent } = window.BJJ;

    // === Joint maps ===
    const partToJoint = {
      head: 'head', neck: 'neck', chest: 'chest', abdomen: 'spine', hip: 'root',
      upperArmL: 'shoulderL', forearmL: 'elbowL', handL: 'wristL',
      upperArmR: 'shoulderR', forearmR: 'elbowR', handR: 'wristR',
      thighL: 'hipL', shinL: 'kneeL', footL: 'ankleL',
      thighR: 'hipR', shinR: 'kneeR', footR: 'ankleR',
    };
    const friendly = {
      root: 'Whole body', spine: 'Lower back', chest: 'Upper back',
      neck: 'Neck', head: 'Head',
      shoulderL: 'Left shoulder', elbowL: 'Left elbow', wristL: 'Left wrist',
      shoulderR: 'Right shoulder', elbowR: 'Right elbow', wristR: 'Right wrist',
      hipL: 'Left hip', kneeL: 'Left knee', ankleL: 'Left ankle',
      hipR: 'Right hip', kneeR: 'Right knee', ankleR: 'Right ankle',
    };

    const figs = { att: attacker, opp: opponent };

    // === Editor state ===
    let active = false;
    let activeFig = 'att';
    let activeJoint = 'root';
    let gizmoMode = 'rotate';

    // === TransformControls gizmo ===
    const gizmo = new THREE.TransformControls(camera, renderer.domElement);
    gizmo.size = 0.7;
    gizmo.visible = false;
    scene.add(gizmo);
    gizmo.addEventListener('dragging-changed', (e) => {
      controls.enabled = !e.value;
    });

    function setGizmoTarget() {
      if (!active) { gizmo.detach(); gizmo.visible = false; return; }
      const fig = figs[activeFig];
      const target = activeJoint === 'root' ? fig.root : fig.joints[activeJoint];
      if (target) {
        gizmo.attach(target);
        gizmo.setMode(activeJoint === 'root' && gizmoMode === 'translate'
          ? 'translate' : 'rotate');
        gizmo.visible = true;
      } else {
        gizmo.detach();
        gizmo.visible = false;
      }
    }

    // === Raycaster: click body part to select ===
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt = 0;
    function pick(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(
        [...attacker.parts, ...opponent.parts], false);
      return hits[0];
    }
    renderer.domElement.addEventListener('pointerdown', (e) => {
      if (!active) return;
      downAt = e.clientX + e.clientY * 1000;
    });
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (!active) return;
      if (!controls.enabled) return;   // dragging gizmo
      if (Math.abs((e.clientX + e.clientY * 1000) - downAt) > 4) return;
      const hit = pick(e);
      if (!hit) return;
      const bp = hit.object.userData.bodyPart;
      const fn = hit.object.userData.figureName === 'you' ? 'att' : 'opp';
      selectJoint(fn, partToJoint[bp] || 'root');
    });

    function selectJoint(figName, joint) {
      activeFig = figName;
      activeJoint = joint;
      document.querySelectorAll('.ep-fig').forEach((b) =>
        b.classList.toggle('on', b.dataset.fig === figName));
      const sel = document.getElementById('epSel');
      if (sel) sel.textContent = friendly[joint] || joint;
      const rotSec = document.getElementById('epRotSec');
      const posSec = document.getElementById('epPosSec');
      if (rotSec) rotSec.style.display = joint === 'root' ? 'none' : 'block';
      if (posSec) posSec.style.display = joint === 'root' ? 'block' : 'none';
      setGizmoTarget();
      updateAllSliders();
    }

    // === Helpers: joint delta euler (relative to rest pose) ===
    function getJointDeltaEuler() {
      const fig = figs[activeFig];
      if (activeJoint === 'root' || !fig.joints[activeJoint] || !fig.restPose[activeJoint]) {
        return [0, 0, 0];
      }
      const rq = fig.restPose[activeJoint].quaternion;
      const qRest = new THREE.Quaternion(rq[0], rq[1], rq[2], rq[3]);
      const qCur = fig.joints[activeJoint].quaternion.clone();
      const qDelta = qRest.clone().invert().multiply(qCur);
      const e = new THREE.Euler().setFromQuaternion(qDelta, 'XYZ');
      return [e.x, e.y, e.z];
    }
    function applyJointDeltaEuler(eulerXYZ) {
      const fig = figs[activeFig];
      if (activeJoint === 'root' || !fig.joints[activeJoint] || !fig.restPose[activeJoint]) return;
      const rq = fig.restPose[activeJoint].quaternion;
      const qRest = new THREE.Quaternion(rq[0], rq[1], rq[2], rq[3]);
      const qDelta = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(eulerXYZ[0], eulerXYZ[1], eulerXYZ[2], 'XYZ'));
      fig.joints[activeJoint].quaternion.copy(qRest.clone().multiply(qDelta));
    }

    // === Slider bindings ===
    function bindRoot(id, valId, idx) {
      const inp = document.getElementById(id), out = document.getElementById(valId);
      if (!inp) return () => {};
      inp.addEventListener('input', () => {
        const fig = figs[activeFig];
        fig.root.position[['x','y','z'][idx]] = parseFloat(inp.value);
        out.textContent = (+inp.value).toFixed(2);
      });
      return () => {
        const v = figs[activeFig].root.position[['x','y','z'][idx]];
        inp.value = v; out.textContent = v.toFixed(2);
      };
    }
    function bindDelta(id, valId, idx) {
      const inp = document.getElementById(id), out = document.getElementById(valId);
      if (!inp) return () => {};
      inp.addEventListener('input', () => {
        const e = getJointDeltaEuler();
        e[idx] = parseFloat(inp.value);
        applyJointDeltaEuler(e);
        out.textContent = (+inp.value).toFixed(2);
      });
      return () => {
        const e = getJointDeltaEuler();
        inp.value = e[idx]; out.textContent = e[idx].toFixed(2);
      };
    }
    const upd = [
      bindRoot('epRpx', 'epRpxv', 0),
      bindRoot('epRpy', 'epRpyv', 1),
      bindRoot('epRpz', 'epRpzv', 2),
      bindDelta('epJx', 'epJxv', 0),
      bindDelta('epJy', 'epJyv', 1),
      bindDelta('epJz', 'epJzv', 2),
    ];
    function updateAllSliders() { upd.forEach((u) => u()); }

    // === Figure picker ===
    document.querySelectorAll('.ep-fig').forEach((b) => {
      b.onclick = () => {
        activeFig = b.dataset.fig;
        document.querySelectorAll('.ep-fig').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        setGizmoTarget();
        updateAllSliders();
      };
    });
    // === Mode buttons ===
    const modeBtn = (id, m) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.onclick = () => {
        gizmoMode = m;
        document.getElementById('epModeRot').classList.toggle('on', m === 'rotate');
        document.getElementById('epModeTr').classList.toggle('on', m === 'translate');
        setGizmoTarget();
      };
    };
    modeBtn('epModeRot', 'rotate');
    modeBtn('epModeTr', 'translate');
    const moveBodyBtn = document.getElementById('epMoveBody');
    if (moveBodyBtn) moveBodyBtn.onclick = () => {
      gizmoMode = 'translate';
      selectJoint(activeFig, 'root');
    };
    const hideGizmoBtn = document.getElementById('epHideGizmo');
    if (hideGizmoBtn) hideGizmoBtn.onclick = () => { gizmo.visible = !gizmo.visible; };
    const zeroBtn = document.getElementById('epZeroJoint');
    if (zeroBtn) zeroBtn.onclick = () => {
      applyJointDeltaEuler([0, 0, 0]);
      updateAllSliders();
    };
    const mirrorBtn = document.getElementById('epMirror');
    if (mirrorBtn) mirrorBtn.onclick = () => {
      if (activeJoint === 'root') return;
      const other = activeJoint.endsWith('L')
        ? activeJoint.slice(0, -1) + 'R'
        : activeJoint.endsWith('R')
        ? activeJoint.slice(0, -1) + 'L'
        : null;
      if (!other || !figs[activeFig].joints[other]) return;
      const e = getJointDeltaEuler();
      const tmp = activeJoint;
      activeJoint = other;
      applyJointDeltaEuler([e[0], -e[1], -e[2]]);
      activeJoint = tmp;
      updateAllSliders();
    };

    // === Presets ===
    if (window.POSE_PRESETS) {
      const grid = document.getElementById('epPresetGrid');
      if (grid) {
        Object.keys(window.POSE_PRESETS).forEach((name) => {
          const b = document.createElement('button');
          b.className = 'ep-preset';
          b.textContent = name;
          b.title = window.POSE_PRESETS[name].desc || '';
          b.onclick = () => applyPreset(activeFig, name);
          grid.appendChild(b);
        });
      }
    }
    function applyPreset(figName, presetName) {
      const preset = window.POSE_PRESETS[presetName];
      if (!preset) return;
      const fig = figs[figName];
      // Reset all bones to rest
      for (const k in fig.restPose) {
        const rq = fig.restPose[k].quaternion;
        fig.joints[k].quaternion.set(rq[0], rq[1], rq[2], rq[3]);
      }
      if (preset.rootPosOverride) fig.root.position.set(...preset.rootPosOverride);
      if (preset.rootRotOverride) fig.root.rotation.set(...preset.rootRotOverride);
      for (const k in preset.deltas) {
        if (!fig.restPose[k]) continue;
        const rq = fig.restPose[k].quaternion;
        const qRest = new THREE.Quaternion(rq[0], rq[1], rq[2], rq[3]);
        const qDelta = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(...preset.deltas[k]));
        fig.joints[k].quaternion.copy(qRest.clone().multiply(qDelta));
      }
      updateAllSliders();
    }

    // === Save current step ===
    const saveBtn = document.getElementById('epSave');
    if (saveBtn) saveBtn.onclick = () => {
      const activeMoveId = window.BJJ.editGetActiveMove
        ? window.BJJ.editGetActiveMove() : null;
      const activeStep = window.BJJ.editGetActiveStep
        ? window.BJJ.editGetActiveStep() : 0;
      if (!activeMoveId) {
        flash(saveBtn, '⚠ Open a move first');
        return;
      }
      const m = window.MOVES.find(x => x.id === activeMoveId);
      // Capture full pose for both figures into step.attPose / step.oppPose.
      const attPose = window.PoseStore.captureFigure(window.BJJ.attacker);
      const oppPose = window.PoseStore.captureFigure(window.BJJ.opponent);
      m.steps[activeStep].attPose = attPose;
      m.steps[activeStep].oppPose = oppPose;
      // Optional: also remember the Mixamo time we sampled from
      if (m.animations) {
        const scrub = document.getElementById('scrubRange');
        if (scrub) m.animations.stepTimes[activeStep] = parseFloat(scrub.value);
      }
      window.PoseStore.markClean(activeMoveId, activeStep);
      window.PoseStore.pushStepHistory(activeMoveId, activeStep, attPose, oppPose);
      window.PoseStore.autosave();
      flash(saveBtn, '✓ Saved');
    };
    function flash(btn, msg) {
      const orig = btn.textContent;
      btn.textContent = msg;
      setTimeout(() => btn.textContent = orig, 1500);
    }

    // === Public toggle ===
    function setEditMode(on) {
      active = on;
      const panel = document.getElementById('editPanel');
      if (panel) panel.classList.toggle('open', on);
      // Mirror the open state onto <body> so the step panel can reposition
      // out from under the editor. A body class is used instead of a sibling
      // selector because .stepPanel precedes .edit-panel in the DOM, which
      // makes the `~` general-sibling combinator never match.
      document.body.classList.toggle('edit-open', on);
      if (!on) document.body.classList.remove('edit-expanded');
      if (on) {
        selectJoint(activeFig, activeJoint);
      } else {
        gizmo.detach();
        gizmo.visible = false;
      }
    }
    window.BJJ.setEditMode = setEditMode;
    window.BJJ.editSelectJoint = selectJoint;
    window.BJJ.editIsActive = () => active;
  }
})();
