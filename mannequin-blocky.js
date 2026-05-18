// Mannequin v3 — gi/martial arts uniform makeover.
// Skeleton/joints UNCHANGED from v2 so all existing poses still work.
//
// Joints (Object3D Groups, pivot-based):
//   root, spine, chest, neck, head,
//   shoulderL/R, elbowL/R, wristL/R, hipL/R, kneeL/R, ankleL/R
//
// Body parts (mesh userData.bodyPart for raycaster):
//   hip, abdomen, chest, neck, head,
//   upperArmL/R, forearmL/R, handL/R,
//   thighL/R, shinL/R, footL/R
//
// Decorations: hair (on head), gi top (chest+abdomen+pelvis+upper arms+thighs+shins),
// belt (waist), exposed skin (neck, forearms, head, feet).

function createMannequin(opts) {
  const { color = 0x4dd0e1, thickness = 1, name = 'figure', beltColor = 0x1a1a1a } = opts;
  const matAccent = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05 });
  const matGi = new THREE.MeshStandardMaterial({ color: 0xe8e4d4, roughness: 0.85, metalness: 0 });
  const matBelt = new THREE.MeshStandardMaterial({ color: beltColor, roughness: 0.7, metalness: 0 });
  const matHair = new THREE.MeshStandardMaterial({ color: 0x1f1410, roughness: 0.95, metalness: 0 });
  const matSkin = new THREE.MeshStandardMaterial({ color: 0xc89a73, roughness: 0.7, metalness: 0 });

  const joints = {};
  const parts = [];
  const T = thickness;

  // === Sizes ===
  const headSize = 0.3;
  const headD = 0.28;
  const neckH = 0.1;
  const neckW = 0.14 * T;
  const neckD = 0.14 * T;
  const chestH = 0.32;
  const chestW = 0.55 * T;
  const chestD = 0.32 * T;
  const abdomenH = 0.25;
  const abdomenW = 0.42 * T;
  const abdomenD = 0.3 * T;
  const pelvisH = 0.18;
  const pelvisW = 0.5 * T;
  const pelvisD = 0.32 * T;
  const armW = 0.14 * T;
  const upperArmH = 0.32;
  const forearmH = 0.3;
  const handH = 0.18;
  const handW = 0.18 * T;
  const handD = 0.12;
  const legW = 0.18 * T;
  const thighH = 0.42;
  const shinH = 0.42;
  const footH = 0.1;
  const footD = 0.32;
  const footW = 0.2 * T;

  // Tag mesh + register for raycasting
  const tag = (mesh, bodyPart) => {
    mesh.userData.bodyPart = bodyPart;
    mesh.userData.figureName = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parts.push(mesh);
    return mesh;
  };
  const deco = (mesh) => {
    // Decorative mesh (hair, belt) — not raycasted, but still cast shadow
    mesh.castShadow = true;
    return mesh;
  };

  const root = new THREE.Group();
  root.name = name + '_root';
  joints.root = root;

  // === Pelvis (gi pants top / hip) ===
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(pelvisW, pelvisH, pelvisD), matGi);
  tag(pelvis, 'hip');
  root.add(pelvis);

  // === Belt — wraps around the waist (top of pelvis) ===
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(pelvisW + 0.02, 0.06, pelvisD + 0.02),
    matBelt
  );
  belt.position.y = pelvisH / 2 + 0.01;
  root.add(deco(belt));

  // === Spine pivot ===
  const spine = new THREE.Group();
  spine.position.y = pelvisH / 2;
  root.add(spine);
  joints.spine = spine;

  // === Abdomen (lower torso, in gi) ===
  const abdomen = new THREE.Mesh(new THREE.BoxGeometry(abdomenW, abdomenH, abdomenD), matGi);
  abdomen.position.y = abdomenH / 2;
  tag(abdomen, 'abdomen');
  spine.add(abdomen);

  // === Chest pivot ===
  const chest = new THREE.Group();
  chest.position.y = abdomenH;
  spine.add(chest);
  joints.chest = chest;

  // === Chest (upper torso in gi — broader) ===
  const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(chestW, chestH, chestD), matGi);
  chestMesh.position.y = chestH / 2;
  tag(chestMesh, 'chest');
  chest.add(chestMesh);

  // === Gi lapels — two narrow panels crossing the chest (decorative) ===
  const lapelGeo = new THREE.BoxGeometry(0.06, chestH * 0.9, 0.05);
  const lapelL = new THREE.Mesh(lapelGeo, matAccent);
  lapelL.position.set(-0.07, chestH / 2, chestD / 2 + 0.005);
  lapelL.rotation.z = 0.18;
  chest.add(deco(lapelL));
  const lapelR = new THREE.Mesh(lapelGeo, matAccent);
  lapelR.position.set(0.07, chestH / 2, chestD / 2 + 0.005);
  lapelR.rotation.z = -0.18;
  chest.add(deco(lapelR));

  // === Neck pivot ===
  const neck = new THREE.Group();
  neck.position.y = chestH;
  chest.add(neck);
  joints.neck = neck;

  // Neck mesh (exposed skin)
  const neckMesh = new THREE.Mesh(new THREE.BoxGeometry(neckW, neckH, neckD), matSkin);
  neckMesh.position.y = neckH / 2;
  tag(neckMesh, 'neck');
  neck.add(neckMesh);

  // === Head pivot ===
  const headJoint = new THREE.Group();
  headJoint.position.y = neckH;
  neck.add(headJoint);
  joints.head = headJoint;

  // Head (skin)
  const head = new THREE.Mesh(new THREE.BoxGeometry(headSize, headSize, headD), matSkin);
  head.position.y = headSize / 2;
  tag(head, 'head');
  headJoint.add(head);

  // === Hair (cap over top of head) ===
  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(headSize + 0.02, headSize * 0.45, headD + 0.02),
    matHair
  );
  hair.position.y = headSize - (headSize * 0.45) / 2 + 0.01;
  headJoint.add(deco(hair));

  // === Eyes — small dark cubes on the face (decorative) ===
  const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.015);
  const matEye = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 });
  const eyeL = new THREE.Mesh(eyeGeo, matEye);
  eyeL.position.set(-0.07, headSize * 0.6, headD / 2 + 0.005);
  headJoint.add(deco(eyeL));
  const eyeR = new THREE.Mesh(eyeGeo, matEye);
  eyeR.position.set(0.07, headSize * 0.6, headD / 2 + 0.005);
  headJoint.add(deco(eyeR));

  // === Arms (gi sleeves on upper arm; bare forearm + hand) ===
  function makeArm(side) {
    const sign = side === 'L' ? 1 : -1;
    const shoulder = new THREE.Group();
    shoulder.position.set(sign * (chestW / 2 + armW / 2 - 0.02), chestH - armW / 2, 0);
    chest.add(shoulder);
    joints['shoulder' + side] = shoulder;

    // Upper arm = gi sleeve (slightly wider than skin)
    const upperArm = new THREE.Mesh(
      new THREE.BoxGeometry(armW * 1.15, upperArmH, armW * 1.15),
      matGi
    );
    upperArm.position.y = -upperArmH / 2;
    tag(upperArm, 'upperArm' + side);
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -upperArmH;
    shoulder.add(elbow);
    joints['elbow' + side] = elbow;

    // Forearm = skin
    const forearm = new THREE.Mesh(
      new THREE.BoxGeometry(armW * 0.88, forearmH, armW * 0.88),
      matSkin
    );
    forearm.position.y = -forearmH / 2;
    tag(forearm, 'forearm' + side);
    elbow.add(forearm);

    const wrist = new THREE.Group();
    wrist.position.y = -forearmH;
    elbow.add(wrist);
    joints['wrist' + side] = wrist;

    // Hand = skin
    const hand = new THREE.Mesh(new THREE.BoxGeometry(handW, handH, handD), matSkin);
    hand.position.y = -handH / 2;
    tag(hand, 'hand' + side);
    wrist.add(hand);
  }
  makeArm('L');
  makeArm('R');

  // === Legs (gi pants on thighs + shins; bare feet) ===
  function makeLeg(side) {
    const sign = side === 'L' ? 1 : -1;
    const hip = new THREE.Group();
    hip.position.set(sign * (pelvisW / 2 - legW / 2), -pelvisH / 2, 0);
    root.add(hip);
    joints['hip' + side] = hip;

    // Thigh in gi
    const thigh = new THREE.Mesh(
      new THREE.BoxGeometry(legW * 1.15, thighH, legW * 1.15),
      matGi
    );
    thigh.position.y = -thighH / 2;
    tag(thigh, 'thigh' + side);
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -thighH;
    hip.add(knee);
    joints['knee' + side] = knee;

    // Shin in gi (slightly tapered)
    const shin = new THREE.Mesh(
      new THREE.BoxGeometry(legW * 1.0, shinH, legW * 1.0),
      matGi
    );
    shin.position.y = -shinH / 2;
    tag(shin, 'shin' + side);
    knee.add(shin);

    const ankle = new THREE.Group();
    ankle.position.y = -shinH;
    knee.add(ankle);
    joints['ankle' + side] = ankle;

    // Foot (skin — bare foot)
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(footW, footH, footD),
      matSkin
    );
    foot.position.set(0, -footH / 2, footD / 2 - footW / 2);
    tag(foot, 'foot' + side);
    ankle.add(foot);
  }
  makeLeg('L');
  makeLeg('R');

  const standingY = pelvisH / 2 + thighH + shinH + footH;

  return {
    root, joints, parts,
    mat: matAccent,   // legacy alias for code that recolors via fig.mat
    materials: { matAccent, matGi, matBelt, matHair, matSkin },
    standingY,
    sizes: {
      pelvisH, abdomenH, chestH, neckH, headSize,
      thighH, shinH, footH,
      upperArmH, forearmH, handH, armW, legW,
    },
  };
}

window.createMannequin = createMannequin;
