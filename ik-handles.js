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
    const geo = new THREE.SphereGeometry(0.055, 16, 12);
    // depthTest off + high renderOrder → handle is always visible and
    // clickable even when it sits behind a limb.
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 999;
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

  // One draggable handle per joint. `chain` lists the bones (root-first) that
  // CCD rotates so the joint (`tip`) reaches the dragged target. Colours:
  // arms cyan, legs orange, spine/head green.
  const ARM = 0x4fc3f7, LEG = 0xffb74d, CORE = 0x81c784;
  const HANDLE_DEFS = [
    // arms
    { id: 'shoulderL', color: ARM, tip: 'shoulderL', chain: ['spine', 'chest'] },
    { id: 'elbowL', color: ARM, tip: 'elbowL', chain: ['shoulderL'] },
    { id: 'wristL', color: ARM, tip: 'wristL', chain: ['shoulderL', 'elbowL'] },
    { id: 'shoulderR', color: ARM, tip: 'shoulderR', chain: ['spine', 'chest'] },
    { id: 'elbowR', color: ARM, tip: 'elbowR', chain: ['shoulderR'] },
    { id: 'wristR', color: ARM, tip: 'wristR', chain: ['shoulderR', 'elbowR'] },
    // legs
    { id: 'hipL', color: LEG, tip: 'hipL', chain: ['spine'] },
    { id: 'kneeL', color: LEG, tip: 'kneeL', chain: ['hipL'] },
    { id: 'ankleL', color: LEG, tip: 'ankleL', chain: ['hipL', 'kneeL'] },
    { id: 'hipR', color: LEG, tip: 'hipR', chain: ['spine'] },
    { id: 'kneeR', color: LEG, tip: 'kneeR', chain: ['hipR'] },
    { id: 'ankleR', color: LEG, tip: 'ankleR', chain: ['hipR', 'kneeR'] },
    // spine / head
    { id: 'chest', color: CORE, tip: 'chest', chain: ['spine'] },
    { id: 'neck', color: CORE, tip: 'neck', chain: ['spine', 'chest'] },
    { id: 'head', color: CORE, tip: 'head', chain: ['spine', 'chest', 'neck'] },
  ];

  function createIKHandles(scene, camera, renderer, figures, orbit) {
    // Per-figure handle objects keyed by joint id.
    const all = [];
    figures.forEach((fig) => {
      const figHandles = {};
      HANDLE_DEFS.forEach((cfg) => {
        if (!fig.joints[cfg.tip]) return;
        const chain = cfg.chain.map((k) => fig.joints[k]).filter(Boolean);
        if (!chain.length) return;   // no rotatable ancestors → can't IK it
        const handle = makeHandle(cfg.color);
        handle.userData.figName = fig.root.name;
        handle.userData.handleId = cfg.id;
        handle.userData.chain = chain;
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

    // === Direct screen-plane drag ==========================================
    // Grab a handle sphere and it follows the cursor in the plane that faces
    // the camera — no axis arrows. Orbit the camera and drag again to reach a
    // different depth.
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const planeHit = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    const _w = new THREE.Vector3();
    let activeHandle = null;
    let dragging = false;
    let visible = false;

    const FLOOR_Y = 0;        // mat height
    const FLOOR_SNAP = 0.09;  // a handle dragged within this of the mat snaps onto it
    const GRAB_SNAP = 0.20;   // a wrist dragged within this of another joint snaps to grip it

    function setNdc(clientX, clientY) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    }

    // Snap a drag target: never below the mat, near-floor points rest ON it,
    // and wrists snap onto the other figure's nearest joint (a grip).
    function snapTarget(handle, target) {
      if (target.y < FLOOR_Y + FLOOR_SNAP) target.y = FLOOR_Y;
      const id = handle.userData.handleId;
      if (id === 'wristL' || id === 'wristR') {
        let best = null, bestD = GRAB_SNAP;
        figures.forEach((f) => {
          if (f === handle.userData.fig) return;   // only the OTHER figure
          for (const k in f.joints) {
            if (k === 'root' || k === 'rootBone') continue;
            f.joints[k].getWorldPosition(_w);
            const d = _w.distanceTo(target);
            if (d < bestD) { bestD = d; best = _w.clone(); }
          }
        });
        if (best) target.copy(best);
      }
      return target;
    }

    function onDown(e) {
      if (!visible) return;
      setNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(all.filter((h) => h.visible), false)[0];
      if (!hit) return;
      activeHandle = hit.object;
      dragging = true;
      orbit.enabled = false;
      camera.getWorldDirection(camDir);
      dragPlane.setFromNormalAndCoplanarPoint(camDir, activeHandle.position);
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging || !activeHandle) return;
      setNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(dragPlane, planeHit)) return;
      snapTarget(activeHandle, planeHit);
      activeHandle.position.copy(planeHit);
      solveCCD(activeHandle.userData.chain, activeHandle.userData.tip, planeHit, 16);
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      activeHandle = null;
      orbit.enabled = true;
    }
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    function show() {
      visible = true;
      all.forEach((h) => { h.visible = true; });
    }
    function hide() {
      visible = false;
      dragging = false;
      activeHandle = null;
      orbit.enabled = true;
      all.forEach((h) => { h.visible = false; });
    }
    hide();   // start hidden

    function update() {
      if (visible) syncHandles(dragging ? activeHandle : null);
    }

    return {
      handles: all,
      show, hide, update,
      get visible() { return visible; },
      get activeHandle() { return activeHandle; },
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
