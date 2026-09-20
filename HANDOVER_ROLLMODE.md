# Roll Up Mode — Handover & Checklist

## Current State (Phase 1 In Progress)

### What's Built
- ✅ ROLLMODEPLAN.md (spec document)
- ⏳ src/systems/RollUp.js (in progress)
- ⏳ src/ui/RollUpHUD.js (in progress)
- ⏳ src/roll-up.html (in progress)
- ⏳ Sound system integration (in progress)

### What Needs Testing
1. Camera distance scaling feels natural across ball sizes (0.2 → 18 m)
2. Size gauge updates smoothly and metal icons highlight correctly
3. Stage display counts down to next transmutation accurately
4. Item counter animates on collection
5. Wedding ending triggers at r = 18 m and plays fanfare
6. Tuning dials respond to query params and `roll.tune` updates

## Phase 1 Checklist

### Camera System
- [ ] `camera.distance = 1.2 + ballRadius * 2.0` implemented
- [ ] Camera follows ball smoothly (no jitter)
- [ ] Tuning dials `tune.camBase` and `tune.camScale` work
- [ ] Camera zoom feels responsive, not disorienting

### Size Gauge (Bottom-Left)
- [ ] Bar renders and fills 0 → 18 m
- [ ] Metal icons placed at 4.5, 9, 13.5, 18 m boundaries
- [ ] Icons change color at each stage transition
- [ ] Positioned correctly with 16px margin

### Stage/Metal Display (Top-Left)
- [ ] Current metal name displays (e.g., "Lead", "Tin", "Mercury", "Gold")
- [ ] Countdown to next stage shows (+4.5 m → Tin)
- [ ] Text updates every frame
- [ ] Text color pulses as ball approaches boundary
- [ ] Positioned correctly with 16px margin

### Collection Counter (Top-Right)
- [ ] Displays "Items: X" with correct count
- [ ] "+1" animation floats up on collection
- [ ] Counter increments correctly
- [ ] Positioned correctly with 16px margin

### Wedding Ending
- [ ] Triggers at r ≥ 18 m
- [ ] Ball physics pause cleanly
- [ ] Camera zooms out over 2 seconds (ease-out)
- [ ] Fanfare sound plays (3–4 seconds)
- [ ] Score screen displays:
  - [ ] Final radius (18.0 m)
  - [ ] Total items collected
  - [ ] Stage progression (NIGREDO → ALBEDO → CITRINITAS → RUBEDO)
  - [ ] Time elapsed
- [ ] Restart and menu buttons work

### Sound System
- [ ] Wedding fanfare loads and plays at correct time
- [ ] Volume balanced with game audio
- [ ] No audio errors in console

### Deployment & Testing
- [ ] Local test at http://localhost:port/src/roll-up.html
- [ ] Query param tuning works: `?tune.camScale=2.5`
- [ ] Live test at https://t3dy.github.io/EmblemsIn3d/src/
- [ ] Deployed to GitHub Pages (git push origin main)
- [ ] Asset paths correct (no 404s)
- [ ] Verified in live environment before marking done

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
