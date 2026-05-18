# BJJ Rig Pose Lessons

Patterns I've learned authoring poses on the low-poly mannequin.
Each move is iterated step-by-step.

## Coordinate convention
- Figure default faces +Z. Head=+Y. Limbs hang -Y.
- Attacker faces +X (rootRot [0, π/2, 0]), opponent faces -X.
- For ground poses, use precomputed orientation Eulers from direction-vector decomposition.
- Local-frame rotation conventions (in figure's local frame, BEFORE root rotation applied):
  - **shoulder.x negative** → arm raises FORWARD (toward face direction)
  - **shoulder.x = -π/2** → arm horizontal forward
  - **shoulder.x = -π** → arm pointing up (overhead)
  - **shoulder.z positive (left side)** → arm out to figure's left side
  - **elbow.x negative** → forearm bends bringing it toward face direction
  - **elbow.x = -π/2** with shoulder.x = -π/2 → forearm vertical up (hands by face)
  - **hip.x negative** → thigh raises FORWARD
  - **knee.x positive** → shin folds back (knee bend)

## Common pose tips (LP rig)

### Fight stance (verified ✓)
- Hands at face/chin level: `shoulder.x = -1.7`, `elbow.x = -1.7`, `shoulder.z = ±0.2`
- Bladed body twist: `chest.y = 0.2`
- Staggered feet (lead forward): `hipL.x = -0.35` (lead), `hipR.x = -0.15` (rear)
- Knees bent: `knee.x = 0.55-0.7`
- Slight forward lean: `spine.x = 0.08`, `chest.x = 0.05`

### Level change / crouch
- TBD

### Penetration step (one knee down)
- TBD

### Closed guard (att on back)
- Root: `[ON_BACK_HEAD_NEG_X]` at y=0.27
- Legs frog up + slightly toward opp: `hip.x = -π/2 + 0.3`, `hip.z = ±0.5`, `knee.x = π - 0.8`
- Hands controlling: `shoulder.x = -2.0`, `elbow.x = -1.2`

### Back control (att behind opp, both seated)
- Both face +X, both at GY_LOW_KNEEL (0.4)
- Att position -0.35, opp position +0.1
- Att arms wrap forward: `shoulder.z = ±1.3` (wide), `elbow.x = -1.4`
- Att legs (hooks): `hip.x = -1.1`, `hip.z = ±0.7`, `knee.x = 1.2`

## Workflow rules
1. **Always hide UI for verification screenshots**: `document.querySelectorAll('.topbar, .legend, .movesPanel, .hint, .stepPanel').forEach(e=>e.style.display='none');`
2. Capture from 3 angles (front, hero, side) before adjusting.
3. After each pose change, screenshot all 3 angles again to verify.
4. Pose tester (`pose-tester.html`) is good for foundation poses; in-app screenshot is good for testing specific move steps.
5. Force-render after snapToPose because requestAnimationFrame is throttled in hidden iframes.

## Move-by-move status

### Double Leg Takedown
- [x] Step 1: Fight stance — hands at face, bladed, staggered feet
- [ ] Step 2: Forward fake — needs hands kept at face, slight forward lean
- [ ] Step 3: Level change — drop hips
- [ ] Step 4: Penetration step
- [ ] Step 5: Wrap legs
- [ ] Step 6: Drive up
- [ ] Step 7: Land on top
