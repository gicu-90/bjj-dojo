// IK handles for Mixamo-rigged figures.
// Provides draggable spheres at wrists & ankles. Dragging runs CCD IK on the
// arm/leg chain so the limb naturally follows.
//
// Also exposes window.POSE_PRESETS — { presetName: { bones: {...} } } for the
// pose editor's preset library.
//
// Usage:
//   const handles = createIKHandles(scene, camera, renderer, [att, opp], orbit);
//   handles.show(); handles.hide();

(function () {
  function makeHandle(color) {
    const geo = new THREE.SphereGeometry(0.05, 16, 12);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.isIKHandle = true;
    return mesh;
  }

  // Apply rotation `q` (world-space delta) to bone so its world quaternion
  // becomes q * currentWorldQuat. Mutates bone.quaternion (local).
  function applyWorldRotation(bone, deltaWorldQuat) {
    const parentWorldQ = new THREE.Quaternion();
    if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ);
    const curWorldQ = new THREE.Quaternion();
    bone.getWorldQuaternion(curWorldQ);
    const newWorldQ = deltaWorldQuat.clone().multiply(curWorldQ);
    bone.quaternion.copy(parentWorldQ.invert().multiply(newWorldQ));
    bone.updateMatrixWorld(true);
  }

  // CCD IK: rotate each bone in `chain` (root → ... → tip's parent) so that
  // `tip` reaches `targetPos`. Iterates `iters` times.
  function solveCCD(chain, tip, targetPos, iters = 12) {
    const tipWP = new THREE.Vector3();
    const boneWP = new THREE.Vector3();
    const toTip = new THREE.Vector3();
    const toTgt = new THREE.Vector3();
    const q = new THREE.Quaternion();
    for (let it = 0; it < iters; it++) {
      for (let i = chain.length - 1; i >= 0; i--) {
        const bone = chain[i];
        tip.getWorldPosition(tipWP);
        bone.getWorldPosition(boneWP);
        toTip.subVectors(tipWP, boneWP);
        toTgt.subVectors(targetPos, boneWP);
        if (toTip.lengthSq() < 1e-8 || toTgt.lengthSq() < 1e-8) continue;
        toTip.normalize(); toTgt.normalize();
        q.setFromUnitVectors(toTip, toTgt);
        applyWorldRotation(bone, q);
      }
      // Check convergence
      tip.getWorldPosition(tipWP);
      if (tipWP.distanceTo(targetPos) < 0.005) break;
    }
  }

  function createIKHandles(scene, camera, renderer, figures, orbit) {
    // Per-figure handle objects: { wristL, wristR, ankleL, ankleR }
    const all = [];
    figures.forEach((fig) => {
      const figHandles = {};
      [
        { id: 'wristL', color: 0x4fc3f7, chain: ['shoulderL', 'elbowL'], tip: 'wristL' },
        { id: 'wristR', color: 0x4fc3f7, chain: ['shoulderR', 'elbowR'], tip: 'wristR' },
        { id: 'ankleL', color: 0xffb74d, chain: ['hipL', 'kneeL'], tip: 'ankleL' },
        { id: 'ankleR', color: 0xffb74d, chain: ['hipR', 'kneeR'], tip: 'ankleR' },
      ].forEach((cfg) => {
        if (!fig.joints[cfg.tip]) return;
        const handle = makeHandle(cfg.color);
        handle.userData.figName = fig.root.name;
        handle.userData.handleId = cfg.id;
        handle.userData.chain = cfg.chain.map((k) => fig.joints[k]);
        handle.userData.tip = fig.joints[cfg.tip];
        handle.userData.fig = fig;
        scene.add(handle);
        figHandles[cfg.id] = handle;
        all.push(handle);
      });
      fig.ikHandles = figHandles;
    });

    // Update handle positions each frame to match the tip bone's world pos.
    function syncHandles(dragging) {
      all.forEach((h) => {
        if (h === dragging) return;
        h.userData.tip.getWorldPosition(h.position);
      });
    }

    // Drag interaction: use a single TransformControls attached on demand.
    const gizmo = new THREE.TransformControls(camera, renderer.domElement);
    gizmo.size = 0.5;
    gizmo.setMode('translate');
    scene.add(gizmo);
    let activeHandle = null;
    let dragging = false;

    gizmo.addEventListener('dragging-changed', (e) => {
      orbit.enabled = !e.value;
      dragging = e.value;
    });
    gizmo.addEventListener('change', () => {
      if (!activeHandle || !dragging) return;
      const targetPos = activeHandle.position.clone();
      solveCCD(activeHandle.userData.chain, activeHandle.userData.tip, targetPos, 15);
    });

    // Raycast clicks on handles to select.
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function tryPick(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(all, false);
      if (hits[0]) {
        selectHandle(hits[0].object);
        return true;
      }
      return false;
    }
    function selectHandle(h) {
      activeHandle = h;
      gizmo.attach(h);
    }
    function deselect() {
      activeHandle = null;
      gizmo.detach();
    }

    let visible = false;
    function show() {
      visible = true;
      all.forEach((h) => { h.visible = true; });
      gizmo.visible = true;
    }
    function hide() {
      visible = false;
      all.forEach((h) => { h.visible = false; });
      gizmo.visible = false;
      deselect();
    }
    hide();   // start hidden

    // Animate loop integration
    function update() {
      if (visible) syncHandles(activeHandle && dragging ? activeHandle : null);
    }

    return {
      handles: all,
      show, hide, update, tryPick, selectHandle, deselect,
      get visible() { return visible; },
      get activeHandle() { return activeHandle; },
      onChange(cb) { gizmo.addEventListener('change', cb); },
    };
  }

  window.createIKHandles = createIKHandles;
  window.solveCCD = solveCCD;
})();

// === POSE PRESETS ===
// Bone-delta quaternion presets. Each is applied as: bone.quaternion = restQ * delta.
// Saved as DELTA Euler {x,y,z} for readability; applied at preset time.
window.POSE_PRESETS = {
  'T-Pose / Reset': {
    desc: 'Bind pose (arms out)',
    deltas: {},
  },
  'Stand relaxed': {
    desc: 'Arms hanging at sides',
    deltas: {
      shoulderL: [0, 0, 1.45],
      shoulderR: [0, 0, -1.45],
    },
  },
  'Fight stance': {
    desc: 'Crouched, arms forward',
    deltas: {
      hipL: [1.0, 0, 0], hipR: [1.0, 0, 0],
      kneeL: [-1.8, 0, 0], kneeR: [-1.8, 0, 0],
      spine: [0.3, 0, 0], chest: [0.2, 0, 0],
      head: [0.2, 0, 0],
      shoulderL: [1.5, -1.2, 0], shoulderR: [1.5, 1.2, 0],
      elbowL: [0, 0, 1.5], elbowR: [0, 0, -1.5],
    },
  },
  'Deep squat': {
    desc: 'Knees bent fully, hips low',
    deltas: {
      hipL: [1.6, 0, 0], hipR: [1.6, 0, 0],
      kneeL: [-2.3, 0, 0], kneeR: [-2.3, 0, 0],
      spine: [0.2, 0, 0], chest: [0.1, 0, 0],
      shoulderL: [0, 0, 1.4], shoulderR: [0, 0, -1.4],
    },
  },
  'Kneel': {
    desc: 'Both knees on ground',
    deltas: {
      hipL: [0.1, 0, 0], hipR: [0.1, 0, 0],
      kneeL: [-2.5, 0, 0], kneeR: [-2.5, 0, 0],
      ankleL: [-1.0, 0, 0], ankleR: [-1.0, 0, 0],
      shoulderL: [0, 0, 1.45], shoulderR: [0, 0, -1.45],
    },
  },
  'Lie on back': {
    desc: 'Flat on back, looking up',
    deltas: {
      // Whole body tipped backward — apply via rootRot, not bones
    },
    rootRotOverride: [-Math.PI / 2, 0, Math.PI / 2],
    rootPosOverride: [0, 0, 0],
  },
  'Crouch low': {
    desc: 'Sprawled / low base',
    deltas: {
      hipL: [1.3, 0, 0], hipR: [1.3, 0, 0],
      kneeL: [-2.0, 0, 0], kneeR: [-2.0, 0, 0],
      spine: [0.5, 0, 0], chest: [0.3, 0, 0],
      head: [0.3, 0, 0],
      shoulderL: [1.7, -0.5, 0], shoulderR: [1.7, 0.5, 0],
      elbowL: [0, 0, 1.3], elbowR: [0, 0, -1.3],
    },
  },
};
