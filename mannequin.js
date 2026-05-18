// Mannequin v5 — FBX rigged humanoid (Mixamo skeleton).
// Async-loads once from a user-provided URL, clones via SkeletonUtils per figure.
//
// Public API:
//   await createMannequin({ color, name }) -> figure
//     figure.root         - THREE.Group wrapping the FBX scene
//     figure.joints       - { jointKey: THREE.Bone } map (e.g. spine, shoulderL, kneeR)
//     figure.parts        - invisible hitbox meshes for body-part raycasting
//     figure.skinned      - THREE.SkinnedMesh
//     figure.standingY    - root Y offset so feet rest at y=0
//
// joints keys match the v2 mannequin schema so move code remains compatible:
//   root, spine, chest, neck, head,
//   shoulderL/R, elbowL/R, wristL/R,
//   hipL/R, kneeL/R, ankleL/R

const FBX_PARTS = [
  'uploads/character.fbx.part-aa',
  'uploads/character.fbx.part-ab',
  'uploads/character.fbx.part-ac',
];

let templatePromise = null;
function loadFigureTemplate() {
  if (templatePromise) return templatePromise;
  templatePromise = (async () => {
    if (!THREE.FBXLoader) throw new Error('FBXLoader not loaded');

    const CACHE_KEY = 'bjj.character.fbx.v1';
    function setProgress(p, txt) {
      const el = document.getElementById('fbx-loading');
      if (!el) return;
      el.style.display = 'flex';
      const bar = el.querySelector('.bar-fill');
      if (bar) bar.style.width = (p * 100).toFixed(1) + '%';
      const label = el.querySelector('.label');
      if (label) label.textContent = txt || '';
    }

    // Try IndexedDB cache first (instant on reload).
    let buf = null;
    try {
      buf = await idbGet(CACHE_KEY);
      if (buf) setProgress(0.95, 'Loading cached character…');
    } catch (e) { /* no cache */ }

    if (!buf) {
      setProgress(0.0, 'Downloading character (35 MB)…');
      // Fetch the 3 parts in parallel with progress.
      const parts = await Promise.all(
        FBX_PARTS.map(async (u, i) => {
          const r = await fetch(u);
          const total = +r.headers.get('content-length') || 0;
          const reader = r.body.getReader();
          const chunks = [];
          let loaded = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            setProgress((i + (total ? loaded / total : 0.5)) / FBX_PARTS.length,
              'Downloading character… part ' + (i + 1) + '/' + FBX_PARTS.length);
          }
          let size = 0; chunks.forEach(c => size += c.length);
          const out = new Uint8Array(size);
          let off = 0;
          for (const c of chunks) { out.set(c, off); off += c.length; }
          return out;
        })
      );
      const total = parts.reduce((s, p) => s + p.byteLength, 0);
      const merged = new Uint8Array(total);
      let off = 0;
      for (const p of parts) { merged.set(p, off); off += p.byteLength; }
      buf = merged.buffer;
      // Cache for next time
      setProgress(0.97, 'Caching character…');
      try { await idbSet(CACHE_KEY, buf); } catch (e) { console.warn('cache fail', e); }
    }

    setProgress(0.99, 'Parsing character…');
    const loader = new THREE.FBXLoader();
    const result = loader.parse(buf, '');
    // Hide loading screen
    const el = document.getElementById('fbx-loading');
    if (el) el.style.display = 'none';
    return result;
  })();
  return templatePromise;
}

// Tiny IndexedDB helpers for ArrayBuffer cache.
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('bjj-cache', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(k) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('files', 'readonly');
    const r = tx.objectStore('files').get(k);
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error);
  });
}
async function idbSet(k, v) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('files', 'readwrite');
    const r = tx.objectStore('files').put(v, k);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

// Map Mixamo bone names (without 'mixamorig1' prefix) → our joint keys.
const BONE_TO_JOINT = {
  'Hips':         'rootBone',   // pelvis bone — used for full-body translation
  'Spine':        'spine',      // lower back bend
  'Spine1':       'chest',      // upper back bend
  'Spine2':       'chestUpper', // (we mostly use Spine1 as chest)
  'Neck':         'neck',
  'Head':         'head',
  'LeftShoulder': 'clavicleL',
  'LeftArm':      'shoulderL',
  'LeftForeArm':  'elbowL',
  'LeftHand':     'wristL',
  'RightShoulder':'clavicleR',
  'RightArm':     'shoulderR',
  'RightForeArm': 'elbowR',
  'RightHand':    'wristR',
  'LeftUpLeg':    'hipL',
  'LeftLeg':      'kneeL',
  'LeftFoot':     'ankleL',
  'RightUpLeg':   'hipR',
  'RightLeg':     'kneeR',
  'RightFoot':    'ankleR',
};

// Joint key → body-part name used by the raycaster + UI labels.
const JOINT_TO_PART = {
  rootBone:   'hip',
  spine:      'abdomen',
  chest:      'chest',
  neck:       'neck',
  head:       'head',
  shoulderL:  'upperArmL',
  shoulderR:  'upperArmR',
  elbowL:     'forearmL',
  elbowR:     'forearmR',
  wristL:     'handL',
  wristR:     'handR',
  hipL:       'thighL',
  hipR:       'thighR',
  kneeL:      'shinL',
  kneeR:      'shinR',
  ankleL:     'footL',
  ankleR:     'footR',
};

// Approximate hit-box sizes in figure-local meters (after auto-scale to 1.7m).
// Each box is attached to its bone and positioned along the bone's local Y axis.
const HITBOX = {
  head:      { size: [0.22, 0.24, 0.22], offset: [0,  0.10, 0] },
  neck:      { size: [0.13, 0.10, 0.13], offset: [0,  0.05, 0] },
  chest:     { size: [0.42, 0.30, 0.28], offset: [0,  0.18, 0] },
  abdomen:   { size: [0.34, 0.18, 0.26], offset: [0,  0.08, 0] },
  hip:       { size: [0.36, 0.18, 0.28], offset: [0, -0.05, 0] },
  upperArmL: { size: [0.11, 0.28, 0.11], offset: [0,  0.14, 0] },
  upperArmR: { size: [0.11, 0.28, 0.11], offset: [0,  0.14, 0] },
  forearmL:  { size: [0.09, 0.26, 0.09], offset: [0,  0.13, 0] },
  forearmR:  { size: [0.09, 0.26, 0.09], offset: [0,  0.13, 0] },
  handL:     { size: [0.09, 0.14, 0.05], offset: [0,  0.07, 0] },
  handR:     { size: [0.09, 0.14, 0.05], offset: [0,  0.07, 0] },
  thighL:    { size: [0.14, 0.42, 0.14], offset: [0,  0.21, 0] },
  thighR:    { size: [0.14, 0.42, 0.14], offset: [0,  0.21, 0] },
  shinL:     { size: [0.11, 0.40, 0.11], offset: [0,  0.20, 0] },
  shinR:     { size: [0.11, 0.40, 0.11], offset: [0,  0.20, 0] },
  footL:     { size: [0.11, 0.08, 0.24], offset: [0,  0.04, 0.08] },
  footR:     { size: [0.11, 0.08, 0.24], offset: [0,  0.04, 0.08] },
};

async function createMannequin(opts) {
  const { color = 0x4dd0e1, name = 'figure', tintBlend = 0.35 } = opts;
  const template = await loadFigureTemplate();

  // Deep clone the FBX scene including skeleton.
  const fbxScene = THREE.SkeletonUtils
    ? THREE.SkeletonUtils.clone(template)
    : template.clone(true);

  // Walk the cloned hierarchy: collect bones + skinned mesh.
  const joints = {};
  let skinned = null;
  fbxScene.traverse((obj) => {
    if (obj.isSkinnedMesh && !skinned) skinned = obj;
    if (obj.isBone) {
      let n = obj.name;
      n = n.replace(/^mixamorig\d*/, '');   // strip prefix
      const key = BONE_TO_JOINT[n];
      if (key && !joints[key]) joints[key] = obj;
    }
  });

  // Wrap in our own Group so we can position/rotate the figure freely
  // without disturbing the FBX scene's own root transforms.
  const root = new THREE.Group();
  root.name = name + '_root';
  root.add(fbxScene);
  joints.root = root;

  // Auto-scale to ~1.7m. The FBX has y-range ~177 units; scale by 1.7/177 ≈ 0.0096.
  const bbox = new THREE.Box3().setFromObject(fbxScene);
  const height = bbox.max.y - bbox.min.y;
  const targetHeight = 1.7;
  const s = height > 0 ? targetHeight / height : 1;
  fbxScene.scale.setScalar(s);
  // After scaling, position feet at y=0
  const bbox2 = new THREE.Box3().setFromObject(fbxScene);
  fbxScene.position.y = -bbox2.min.y;

  // Tint the skinned-mesh material toward `color` (so figures are distinguishable).
  if (skinned) {
    skinned.castShadow = true;
    skinned.receiveShadow = true;
    const tintColor = new THREE.Color(color);
    const tintMaterial = (m) => {
      const cloned = m.clone();
      if (cloned.color) cloned.color = cloned.color.clone().lerp(tintColor, tintBlend);
      // emissive: subtle glow so figure tints in shadow too
      if (cloned.emissive) cloned.emissive = tintColor.clone().multiplyScalar(0.08);
      return cloned;
    };
    if (Array.isArray(skinned.material)) {
      skinned.material = skinned.material.map(tintMaterial);
    } else {
      skinned.material = tintMaterial(skinned.material);
    }
  }

  // === Hitbox meshes attached to each bone ===
  const parts = [];
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  // Hitboxes live in BONE-LOCAL space. Bone local Y axis points along the bone.
  // BUT! The bones are inside a parent that's scaled by `s`. To keep hitbox
  // sizes in WORLD units (≈ meters), we counter-scale by 1/s.
  const invS = 1 / s;
  for (const jointKey in joints) {
    if (jointKey === 'root') continue;
    const partName = JOINT_TO_PART[jointKey];
    const cfg = HITBOX[partName];
    if (!cfg) continue;
    const geo = new THREE.BoxGeometry(...cfg.size);
    const mesh = new THREE.Mesh(geo, hitMat);
    mesh.position.set(...cfg.offset).multiplyScalar(invS);
    mesh.scale.setScalar(invS);
    mesh.userData.bodyPart = partName;
    mesh.userData.figureName = name;
    mesh.userData.jointKey = jointKey;
    joints[jointKey].add(mesh);
    parts.push(mesh);
  }

  // Save the bone rest-pose (so pose data deltas can be applied on top of rest)
  const restPose = {};
  for (const jn in joints) {
    if (jn === 'root') continue;
    const b = joints[jn];
    restPose[jn] = {
      position: b.position.toArray(),
      quaternion: b.quaternion.toArray(),
    };
  }

  return {
    root,
    joints,
    parts,
    skinned,
    fbxScene,
    standingY: 0,           // figure already grounded
    sizes: { targetHeight, scale: s },
    restPose,
  };
}

window.createMannequin = createMannequin;
window.loadFigureTemplate = loadFigureTemplate;
