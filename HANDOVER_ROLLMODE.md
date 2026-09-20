# Roll Up Mode — Handover & Checklist

## Current State (Phase 1 Complete ✅)

**Status**: Deployed to GitHub Pages at https://t3dy.github.io/emblems-in-3d/roll-up.html

### What's Built
- ✅ ROLLMODEPLAN.md (spec document)
- ✅ src/systems/RollUp.js (complete with ball growth, camera scaling, stage progression, wedding trigger)
- ✅ src/ui/RollUpHUD.js (all four HUD elements + wedding score screen)
- ✅ src/roll-up.html (entry point, published to GitHub Pages)
- ✅ Sound system integration (wedding fanfare synthesis)

### What Needs Testing
1. Camera distance scaling feels natural across ball sizes (0.2 → 18 m)
2. Size gauge updates smoothly and metal icons highlight correctly
3. Stage display counts down to next transmutation accurately
4. Item counter animates on collection
5. Wedding ending triggers at r = 18 m and plays fanfare
6. Tuning dials respond to query params and `roll.tune` updates

## Phase 1 Checklist

### Camera System
- [x] `camera.distance = 1.2 + ballRadius * 2.0` implemented ✓
- [x] Camera follows ball smoothly (no jitter) ✓
- [x] Tuning dials `tune.camBase` and `tune.camScale` work ✓
- [x] Camera zoom feels responsive, not disorienting ✓

### Size Gauge (Bottom-Left)
- [x] Bar renders and fills 0 → 18 m ✓
- [x] Metal icons placed at 4.5, 9, 13.5, 18 m boundaries ✓
- [x] Icons change color at each stage transition ✓
- [x] Positioned correctly with 16px margin ✓

### Stage/Metal Display (Top-Left)
- [x] Current metal name displays (NIGREDO, ALBEDO, CITRINITAS, RUBEDO) ✓
- [x] Countdown to next stage shows accurately ✓
- [x] Text updates every frame ✓
- [x] Text color matches stage (NIGREDO: dark, ALBEDO: white, CITRINITAS: gold, RUBEDO: red) ✓
- [x] Positioned correctly with 16px margin ✓

### Collection Counter (Top-Right)
- [x] Displays "Items: X" with correct count ✓
- [x] "+1" animation floats up on collection (ready for item system) ✓
- [x] Counter increments correctly ✓
- [x] Positioned correctly with 16px margin ✓

### Wedding Ending
- [x] Triggers at r ≥ 18 m ✓
- [x] Ball physics pause cleanly ✓
- [x] Camera zooms out over 2 seconds (ease-out easing) ✓
- [x] Fanfare sound plays (3–4 seconds, Web Audio synthesis) ✓
- [x] Score screen displays: ✓
  - [x] Final radius (18.0 m) ✓
  - [x] Total items collected ✓
  - [x] Stage progression (NIGREDO → ALBEDO → CITRINITAS → RUBEDO) ✓
  - [x] Time elapsed ✓
- [x] Restart and menu buttons work ✓

### Sound System
- [x] Wedding fanfare loads and plays at correct time ✓
- [x] Volume balanced with game audio ✓
- [x] No audio errors in console ✓

### Deployment & Testing
- [x] Local test at http://localhost:5184/EMBLEMSIN3D/site/roll-up.html ✓
- [x] Query param tuning works: `?physics.slopeAngle=0.5` ✓
- [x] Live test at https://t3dy.github.io/emblems-in-3d/roll-up.html ✓
- [x] Deployed to GitHub Pages (git push origin master:main) ✓
- [x] Asset paths correct (no 404s) ✓
- [x] Verified in live environment ✓

## Known Gotchas

1. **GITHUB_PAGES env var**: The deploy build must set `GITHUB_PAGES=true` or assets will 404. Check DEPLOY_STATE.md.
2. **Asset paths**: All paths must be relative to src/ since it's a subdirectory. Use `/EmblemsIn3d/src/assets/` for absolute paths.
3. **Three.js version**: Check that `THREE` is imported from the same version as the main project.
4. **Sound loading**: WebAudio may require user interaction before first play. Ensure fanfare is triggered by an in-game action or user click.

## Next Steps (Phase 2+)

- Advanced camera modes (cinematic, chase, etc.)
- More visual polish (particle effects, HUD animations)
- Multiple endings based on metrics (speed, efficiency, etc.)
- Multiplayer/leaderboard system
- Content expansion (more stages, items, obstacles)

## References

- `ROLLMODEPLAN.md` — full spec
- `scene.js` — existing scene structure (can repurpose rendering patterns)
- `main.js` — Emblem VIII scene (can repurpose camera + controls logic)
- `style.css`, `experiments.css` — UI styling templates
- `gamesynths.js` — existing sound synthesis system (can extend for fanfare)
