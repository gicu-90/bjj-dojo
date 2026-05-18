// Three.js scene, animation system, raycasting.
// Exposes window.BJJ with methods used by ui.js.

(async function () {
  const canvas = document.getElementById('scene');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0c11');
  scene.fog = new THREE.Fog('#0a0c11', 8, 22);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  // Mobile gets a wider FOV + further pull-back so figures aren't cramped
  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  const DEFAULT_CAM = isMobile
    ? { pos: [0, 1.7, 7.5], target: [0, 1.0, 0], fov: 50 }
    : { pos: [0.3, 1.55, 6.2], target: [0, 0.85, 0], fov: 38 };
  camera.fov = DEFAULT_CAM.fov;
  camera.updateProjectionMatrix();
  camera.position.set(...DEFAULT_CAM.pos);
  camera.lookAt(...DEFAULT_CAM.target);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // === LIGHTS ===
  const hemi = new THREE.HemisphereLight(0x6a7888, 0x0a0c10, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe2b8, 1.1);
  key.position.set(3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 18;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x4fc3f7, 0.6);
  rim.position.set(-4, 3, -3);
  scene.add(rim);
  const accent = new THREE.PointLight(0xff7043, 0.4, 8);
  accent.position.set(2, 1.2, -2);
  scene.add(accent);

  // === MAT / FLOOR ===
  // Tatami-inspired grid floor
  const matGroup = new THREE.Group();
  scene.add(matGroup);
  const matSize = 10;
  const tile = 1;
  const matGeo = new THREE.PlaneGeometry(matSize, matSize);
  const matMat = new THREE.MeshStandardMaterial({ color: 0x141921, roughness: 0.9, metalness: 0 });
  const matPlane = new THREE.Mesh(matGeo, matMat);
  matPlane.rotation.x = -Math.PI / 2;
  matPlane.receiveShadow = true;
  matGroup.add(matPlane);
  // grid lines
  const grid = new THREE.GridHelper(matSize, matSize / tile, 0x2a3340, 0x1c2230);
  grid.position.y = 0.001;
  matGroup.add(grid);
  // central circle ring (dojo)
  const ringGeo = new THREE.RingGeometry(1.6, 1.66, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb74d, side: THREE.DoubleSide, transparent: true, opacity: 0.35 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  matGroup.add(ring);

  // === FIGURES ===
  const COLOR_YOU = 0x4fc3f7;
  const COLOR_OPP = 0xef5350;
  const attacker = await createMannequin({ color: COLOR_YOU, name: 'you' });
  const opponent = await createMannequin({ color: COLOR_OPP, name: 'opp' });
  scene.add(attacker.root);
  scene.add(opponent.root);

  // === ANIMATION PLAYERS ===
  const attPlayer = window.AnimLoader.createPlayer(attacker);
  const oppPlayer = window.AnimLoader.createPlayer(opponent);
  let activeAnim = null;   // { attClip, oppClip, duration, stepTimes }
  let animTargetTime = 0;
  let animCurrentTime = 0;
  let animSpeed = 1;       // 1 = instant set, <1 = slower tween
  let animMode = false;    // true when an animation is loaded for the current move

  async function loadMoveAnimation(animations) {
    if (!animations || !animations.attUrl) {
      activeAnim = null;
      animMode = false;
      return;
    }
    try {
      const [attClip, oppClip] = await Promise.all([
        window.AnimLoader.loadAnim(animations.attUrl),
        window.AnimLoader.loadAnim(animations.oppUrl),
      ]);
      attPlayer.setClip(attClip);
      oppPlayer.setClip(oppClip);
      activeAnim = {
        attClip, oppClip,
        duration: animations.duration || attClip.duration,
        stepTimes: animations.stepTimes || [0],
        move: window.MOVES.find(x => x.animations === animations),
      };
      animMode = true;
      animCurrentTime = 0;
      animTargetTime = 0;
      // Move the figure roots to the animation's starting positions
      // (root motion is baked into the Hips bone, so the wrapper Group stays put).
      if (animations.startPos) {
        attacker.root.position.set(...animations.startPos.att);
        opponent.root.position.set(...animations.startPos.opp);
      }
      if (animations.startRot) {
        attacker.root.rotation.set(...animations.startRot.att);
        opponent.root.rotation.set(...animations.startRot.opp);
      }
      attPlayer.setTime(0);
      oppPlayer.setTime(0);
    } catch (e) {
      console.error('Failed to load animation:', e);
      activeAnim = null;
      animMode = false;
    }
  }

  function setAnimTime(t, durationMs = 600, stepIdx) {
    if (!activeAnim) return;
    animTargetTime = Math.max(0, Math.min(activeAnim.duration, t));
    animTweenStart = performance.now();
    animTweenFrom = animCurrentTime;
    animTweenDur = durationMs;
    // Apply per-step position overrides if defined
    const move = activeAnim.move;
    const ovr = move && move.animations && move.animations.stepOverrides
      && stepIdx != null ? move.animations.stepOverrides[stepIdx] : null;
    if (ovr) {
      if (ovr.attPos) attacker.root.position.set(...ovr.attPos);
      if (ovr.attRot) attacker.root.rotation.set(...ovr.attRot);
      if (ovr.oppPos) opponent.root.position.set(...ovr.oppPos);
      if (ovr.oppRot) opponent.root.rotation.set(...ovr.oppRot);
    }
  }
  let animTweenStart = 0, animTweenFrom = 0, animTweenDur = 600;

  function tickAnim() {
    if (!animMode || !activeAnim) return;
    const now = performance.now();
    const elapsed = (now - animTweenStart) * speedMul;
    const t = Math.min(1, elapsed / animTweenDur);
    const ee = easeInOut(t);
    animCurrentTime = animTweenFrom + (animTargetTime - animTweenFrom) * ee;
    attPlayer.setTime(animCurrentTime);
    oppPlayer.setTime(animCurrentTime);
  }

  // Hover/select highlight materials (per part).
  // We tint via emissive on hover/select.
  function makeHoverable(parts) {
    parts.forEach((m) => {
      m.userData.originalEmissive = m.material.emissive ? m.material.emissive.getHex() : 0x000000;
    });
  }
  // Clone material per part on opponent so we can highlight individually.
  opponent.parts.forEach((p) => {
    p.material = p.material.clone();
    p.userData.originalEmissive = 0x000000;
  });
  makeHoverable(opponent.parts);
  makeHoverable(attacker.parts);

  // === ORBIT CONTROLS ===
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(...DEFAULT_CAM.target);
  controls.minDistance = 2;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.update();

  // === ANIMATION SYSTEM ===
  // Each frame we hold a pose for attacker + opponent. When new step requested,
  // we lerp from current applied state to target poses over `transitionMs`.
  const tmpEuler = new THREE.Euler();
  let currentPose = { attacker: window.fightStanceA(), opponent: window.fightStanceB() };
  let targetPose = currentPose;
  let transitionStart = 0;
  let transitionDur = 900;
  let speedMul = 1;

  // Measure the world-Y of the lowest point of fig's mesh bounds with the given pose applied.
  function liftedRootY(fig, pose) {
    const origPos = fig.root.position.clone();
    const origRot = fig.root.rotation.clone();
    const origJoints = {};
    for (const jn in fig.joints) {
      if (jn === 'root') continue;
      origJoints[jn] = fig.joints[jn].rotation.clone();
    }
    fig.root.position.set(...pose.rootPos);
    fig.root.rotation.set(...pose.rootRot);
    for (const jn in pose.joints) {
      if (fig.joints[jn]) fig.joints[jn].rotation.set(...pose.joints[jn]);
    }
    fig.root.updateMatrixWorld(true);
    let lowest = Infinity;
    const bbox = new THREE.Box3();
    for (const part of fig.parts) {
      bbox.setFromObject(part);
      if (bbox.min.y < lowest) lowest = bbox.min.y;
    }
    const lift = lowest < 0 ? -lowest : 0;
    // Restore
    fig.root.position.copy(origPos);
    fig.root.rotation.copy(origRot);
    for (const jn in origJoints) fig.joints[jn].rotation.copy(origJoints[jn]);
    fig.root.updateMatrixWorld(true);
    return pose.rootPos[1] + lift;
  }

  function liftPose(fig, pose) {
    const newY = liftedRootY(fig, pose);
    if (newY === pose.rootPos[1]) return pose;
    return {
      joints: pose.joints,
      rootPos: [pose.rootPos[0], newY, pose.rootPos[2]],
      rootRot: pose.rootRot,
    };
  }

  function poseFigure(fig, pose) {
    // FBX rig: apply root position/rotation. Joint rotations from old pose data
    // are SKIPPED (different rest pose & bone-local axes than the blocky rig).
    // We also let pose.bones override individual bone quaternions if present.
    fig.root.position.set(pose.rootPos[0], 0, pose.rootPos[2] || 0);
    fig.root.rotation.set(pose.rootRot[0] || 0, pose.rootRot[1] || 0, pose.rootRot[2] || 0);
    if (pose.bones) {
      for (const k in pose.bones) {
        const b = fig.joints[k];
        if (!b) continue;
        const q = pose.bones[k];
        b.quaternion.set(q[0], q[1], q[2], q[3]);
      }
    } else if (fig.restPose) {
      // Reset to rest pose
      for (const k in fig.restPose) {
        const b = fig.joints[k];
        if (!b) continue;
        const rq = fig.restPose[k].quaternion;
        b.quaternion.set(rq[0], rq[1], rq[2], rq[3]);
      }
    }
  }

  function lerpPose(fig, a, b, t) {
    // Root pos/rot
    const pos = [
      a.rootPos[0] + (b.rootPos[0] - a.rootPos[0]) * t,
      0,
      (a.rootPos[2] || 0) + ((b.rootPos[2] || 0) - (a.rootPos[2] || 0)) * t,
    ];
    const rot = [
      (a.rootRot[0] || 0) + ((b.rootRot[0] || 0) - (a.rootRot[0] || 0)) * t,
      (a.rootRot[1] || 0) + ((b.rootRot[1] || 0) - (a.rootRot[1] || 0)) * t,
      (a.rootRot[2] || 0) + ((b.rootRot[2] || 0) - (a.rootRot[2] || 0)) * t,
    ];
    fig.root.position.set(...pos);
    fig.root.rotation.set(...rot);
    // Bone quaternions (slerp)
    if (b.bones) {
      const qa = new THREE.Quaternion();
      const qb = new THREE.Quaternion();
      for (const k in b.bones) {
        const bn = fig.joints[k];
        if (!bn) continue;
        const aq = (a.bones && a.bones[k]) || (fig.restPose[k] && fig.restPose[k].quaternion) || [0,0,0,1];
        const bq = b.bones[k];
        qa.set(aq[0], aq[1], aq[2], aq[3]);
        qb.set(bq[0], bq[1], bq[2], bq[3]);
        qa.slerp(qb, t);
        bn.quaternion.copy(qa);
      }
    }
    // Lerp Hips bone position (root motion)
    if (b.hipsPos && fig.joints.rootBone) {
      const ah = a.hipsPos || b.hipsPos;
      fig.joints.rootBone.position.set(
        ah[0] + (b.hipsPos[0] - ah[0]) * t,
        ah[1] + (b.hipsPos[1] - ah[1]) * t,
        ah[2] + (b.hipsPos[2] - ah[2]) * t
      );
    }
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function goToPose(att, opp, duration = 900) {
    currentPose = capturePose(); // snapshot current visual state
    targetPose = { attacker: att, opponent: opp };
    transitionStart = performance.now();
    transitionDur = duration;
  }

  function capturePose() {
    const snap = (fig) => {
      const r = fig.root;
      const bones = {};
      for (const k in fig.joints) {
        if (k === 'root') continue;
        const q = fig.joints[k].quaternion;
        bones[k] = [q.x, q.y, q.z, q.w];
      }
      // Capture rootBone (Hips) position too, since Mixamo animations bake
      // root motion into the Hips bone's position track.
      let hipsPos = null;
      if (fig.joints.rootBone) {
        const p = fig.joints.rootBone.position;
        hipsPos = [p.x, p.y, p.z];
      }
      return {
        joints: {},
        bones,
        hipsPos,
        rootPos: [r.position.x, r.position.y, r.position.z],
        rootRot: [r.rotation.x, r.rotation.y, r.rotation.z],
      };
    };
    return { attacker: snap(attacker), opponent: snap(opponent) };
  }

  // Initial pose: load Double Leg animation at t=0 (the proper starting stance).
  let savedInitialPose = null;     // { attacker, opponent } — used when closing moves
  // Hide figures until init pose applied (prevents T-pose flash)
  attacker.root.visible = false;
  opponent.root.visible = false;
  (async function applyInitialPose() {
    const dl = window.MOVES && window.MOVES.find((m) => m.id === 'doubleLeg');
    let attPose, oppPose;
    if (dl && dl.animations && dl.animations.attUrl && window.AnimLoader) {
      try {
        await loadMoveAnimation(dl.animations);
        attPlayer.setTime(0);
        oppPlayer.setTime(0);
        animMode = false;
        const snap = capturePose();
        attPose = snap.attacker;
        oppPose = snap.opponent;
      } catch (e) { console.warn('init anim failed', e); }
    }
    if (!attPose) {
      const step0 = dl && dl.steps && dl.steps[0];
      attPose = (step0 && step0.attPose) || (step0 && step0.attacker) || window.fightStanceA();
      oppPose = (step0 && step0.oppPose) || (step0 && step0.opponent) || window.fightStanceB();
      poseFigure(attacker, attPose);
      poseFigure(opponent, oppPose);
    }
    savedInitialPose = { attacker: attPose, opponent: oppPose };
    currentPose = { attacker: attPose, opponent: oppPose };
    targetPose = currentPose;
    transitionStart = performance.now() - 99999;
    attacker.root.visible = true;
    opponent.root.visible = true;
  })();

  // === RAYCASTER ===
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredPart = null;
  let labelsVisible = false;

  function setHover(mesh) {
    if (hoveredPart && hoveredPart !== mesh) {
      hoveredPart.material.emissive.setHex(hoveredPart.userData.originalEmissive || 0);
    }
    hoveredPart = mesh;
    if (mesh) {
      mesh.material.emissive.setHex(0x4a3c10);
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = 'grab';
    }
  }

  function getHitOnEither(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...opponent.parts, ...attacker.parts], false);
    return hits[0] || null;
  }
  function getOpponentIntersect(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(opponent.parts, false);
    return hits[0] || null;
  }

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      const hit = getOpponentIntersect(e.clientX, e.clientY);
      setHover(hit ? hit.object : null);
    }
  });

  canvas.addEventListener('pointerleave', () => setHover(null));

  // Click → fire onTarget callback (set by ui.js)
  let onTargetClick = () => {};
  // Persistent highlight overlay shown while a move menu is open.
  let activeHighlight = null;
  function clearHighlight() {
    if (activeHighlight) {
      if (activeHighlight.parent) activeHighlight.parent.remove(activeHighlight);
      activeHighlight.material.dispose();
      activeHighlight = null;
    }
  }
  function showHighlight(hitObject) {
    if (!hitObject || !hitObject.geometry) return;
    clearHighlight();
    // Use a stretched sphere (football / balloon shape) sized to match the
    // hitbox's bounds — soft, rounded, inflated. No sharp edges.
    const params = hitObject.geometry.parameters || {};
    const w = params.width || 0.1;
    const h = params.height || 0.2;
    const d = params.depth || 0.1;
    const overlay = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 24, 18),
      new THREE.MeshBasicMaterial({
        color: 0xffb74d, transparent: true, opacity: 0.25,
        depthTest: true, depthWrite: false, side: THREE.FrontSide,
      })
    );
    overlay.position.copy(hitObject.position);
    overlay.quaternion.copy(hitObject.quaternion);
    // Sphere has radius 0.5, so scale by hitbox dimensions to fill bounds,
    // then inflate a bit (1.15x along length, 0.95x cross-section for a
    // slightly tapered "football" feel).
    overlay.scale.copy(hitObject.scale).multiply(
      new THREE.Vector3(w * 1.25, h * 1.3, d * 1.25)
    );
    overlay.renderOrder = 999;
    hitObject.parent.add(overlay);
    activeHighlight = overlay;
    const t0 = performance.now();
    function pulse() {
      if (overlay !== activeHighlight) return;
      const t = (performance.now() - t0) / 2200;
      const breathe = 0.22 + 0.10 * Math.sin(t * Math.PI * 2);
      overlay.material.opacity = breathe;
      requestAnimationFrame(pulse);
    }
    pulse();
  }
  canvas.addEventListener('click', (e) => {
    const hit = getOpponentIntersect(e.clientX, e.clientY);
    if (hit) {
      showHighlight(hit.object);
      onTargetClick(hit.object.userData.bodyPart, e.clientX, e.clientY, hit.object);
    } else {
      clearHighlight();
      onTargetClick(null);
    }
  });

  // === ANIMATION LOOP ===
  function tick() {
    const now = performance.now();
    const elapsed = (now - transitionStart) * speedMul;
    const t = Math.min(1, elapsed / transitionDur);
    const e = easeInOut(t);
    if (animMode) {
      tickAnim();
    } else {
      lerpPose(attacker, currentPose.attacker, targetPose.attacker, e);
      lerpPose(opponent, currentPose.opponent, targetPose.opponent, e);
    }
    controls.update();
    renderer.render(scene, camera);
  }
  function animate() {
    requestAnimationFrame(animate);
    tick();
  }
  animate();
  // Backup tick at 30Hz via setInterval — keeps poses progressing even when
  // requestAnimationFrame is throttled (background tabs, hidden iframes).
  setInterval(tick, 33);

  // === CAMERA PRESETS ===
  function setCameraPreset(name) {
    const presets = isMobile ? {
      default: { pos: [0, 1.7, 7.5], target: [0, 1.0, 0] },
      front:   { pos: [0, 1.5, 7.8], target: [0, 1.0, 0] },
      side:    { pos: [7.5, 1.5, 0.01], target: [0, 0.9, 0] },
      top:     { pos: [0, 6.5, 0.01], target: [0, 0.3, 0] },
      hero:    { pos: [-3.5, 1.9, 5.5], target: [0, 0.9, 0] },
    } : {
      default: { pos: [0.3, 1.55, 6.2], target: [0, 0.85, 0] },
      front: { pos: [0, 1.3, 6.4], target: [0, 0.9, 0] },
      side: { pos: [6, 1.3, 0.01], target: [0, 0.7, 0] },
      top: { pos: [0, 5.6, 0.01], target: [0, 0.3, 0] },
      hero: { pos: [-3.1, 1.7, 4.6], target: [0, 0.8, 0] },
    };
    const p = presets[name] || presets.default;
    // tween camera position
    const start = { pos: camera.position.toArray(), tgt: controls.target.toArray() };
    const t0 = performance.now();
    const dur = 700;
    function tick() {
      const tt = Math.min(1, (performance.now() - t0) / dur);
      const e = easeInOut(tt);
      camera.position.set(
        start.pos[0] + (p.pos[0] - start.pos[0]) * e,
        start.pos[1] + (p.pos[1] - start.pos[1]) * e,
        start.pos[2] + (p.pos[2] - start.pos[2]) * e
      );
      controls.target.set(
        start.tgt[0] + (p.target[0] - start.tgt[0]) * e,
        start.tgt[1] + (p.target[1] - start.tgt[1]) * e,
        start.tgt[2] + (p.target[2] - start.tgt[2]) * e
      );
      controls.update();
      if (tt < 1) requestAnimationFrame(tick);
    }
    tick();
  }

  // === JOINT LABEL OVERLAY ===
  // Rendered in DOM by ui.js using projected positions; we expose a helper.
  function project(vec3) {
    const v = vec3.clone().project(camera);
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((v.x + 1) / 2) * rect.width + rect.left,
      y: ((-v.y + 1) / 2) * rect.height + rect.top,
      visible: v.z < 1,
    };
  }
  function getBodyPartWorldPos(bodyPart, who = 'opp') {
    const fig = who === 'opp' ? opponent : attacker;
    const part = fig.parts.find((p) => p.userData.bodyPart === bodyPart);
    if (!part) return null;
    return part.getWorldPosition(new THREE.Vector3());
  }

  function setFigureColors(youHex, oppHex) {
    attacker.parts.forEach((p) => p.material.color.setHex(youHex));
    opponent.parts.forEach((p) => p.material.color.setHex(oppHex));
  }
  function setThickness() {
    // Thickness change would require rebuilding meshes — skip in v1; expose as no-op.
  }

  // Public API for ui.js
  window.BJJ = {
    goToPose,
    getInitialPose: () => savedInitialPose,
    clearHighlight,
    loadMoveAnimation,
    setAnimTime,
    isAnimMode: () => animMode,
    // Editor hooks: expose the live scene primitives
    scene, camera, renderer, controls,
    attacker, opponent,
    attPlayer, oppPlayer,
    get activeAnim() { return activeAnim; },
    forceAnimMode(on) { animMode = on; },
    // Apply per-step poses (PoseStore poses) to figures
    applyStepPoses(attPose, oppPose, durationMs = 700) {
      if (!attPose || !oppPose) return;
      const startAtt = window.PoseStore.captureFigure(attacker);
      const startOpp = window.PoseStore.captureFigure(opponent);
      const t0 = performance.now();
      function tick() {
        const t = Math.min(1, (performance.now() - t0) / durationMs);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        window.PoseStore.slerpFigure(attacker, startAtt, attPose, e);
        window.PoseStore.slerpFigure(opponent, startOpp, oppPose, e);
        if (t < 1) requestAnimationFrame(tick);
      }
      tick();
    },
    snapToStepPoses(attPose, oppPose) {
      window.PoseStore.applyFigure(attacker, attPose);
      window.PoseStore.applyFigure(opponent, oppPose);
    },
    snapToPose(att, opp) {
      // Instant set (no lerp) — useful for testing single poses.
      currentPose = { attacker: att, opponent: opp };
      targetPose = currentPose;
      transitionStart = performance.now() - 99999;
      poseFigure(attacker, att);
      poseFigure(opponent, opp);
      // Force a render
      renderer.render(scene, camera);
    },
    setOnTargetClick: (fn) => { onTargetClick = fn; },
    setSpeed: (s) => { speedMul = s; },
    setCameraPreset,
    project,
    getBodyPartWorldPos,
    setFigureColors,
    pulseTarget(bodyPart) {
      const part = opponent.parts.find((p) => p.userData.bodyPart === bodyPart);
      if (!part) return;
      const orig = part.userData.originalEmissive || 0;
      let t0 = performance.now();
      function pulse() {
        const t = (performance.now() - t0) / 700;
        if (t >= 1) { part.material.emissive.setHex(orig); return; }
        const v = Math.sin(t * Math.PI);
        part.material.emissive.setHex(0xffb74d);
        part.material.emissiveIntensity = v;
        requestAnimationFrame(pulse);
      }
      pulse();
    },
    highlightTarget(bodyPart, on) {
      const part = opponent.parts.find((p) => p.userData.bodyPart === bodyPart);
      if (!part) return;
      part.material.emissive.setHex(on ? 0x7a5410 : (part.userData.originalEmissive || 0));
    },
    // expose for ui label positions
    opponentParts: opponent.parts,
    attackerParts: attacker.parts,
  };
})();
