# Roll Up Mode Plan

## Overview

Roll Up mode is a new gameplay loop where the player's avatar is a growing ball that rolls uphill, accumulating mass. The goal is to reach a maximum radius of 18 m before triggering the wedding ending cinematic.

## Phases

### Phase 1: Critical Path (1–2 sessions)
This phase establishes the core mechanics and feedback loops needed for a playable 5-minute run.

#### 1.1 Dynamic Camera Distance
- **Formula**: `camera.distance = 1.2 + ballRadius * 2.0`
- **Tuning dial**: `tune.camBase` (1.2) and `tune.camScale` (2.0)
- **Behavior**: At start (r ≈ 0.2 m), camera is ~1.6 m away; at end (r = 18 m), camera is ~37.6 m away
- **Integration**: Tie to `this.r` in RollUp.js system
- **Test**: Reload at t3dy.github.io/EmblemsIn3d/src/ and verify camera feels natural—not too tight at start, not too far at end

#### 1.2 Size Gauge (Bottom-Left)
- **Display**: Vertical bar from 0 → 18 m with metal stage icons at transition points
- **Metal transitions**: 
  - NIGREDO → ALBEDO: 4.5 m
  - ALBEDO → CITRINITAS: 9 m
  - CITRINITAS → RUBEDO: 13.5 m
- **Visual**: Bar fills left-to-right; metal icon changes color at each stage boundary
- **Animation**: No animation on size itself, but stage icons highlight when boundary is crossed
- **Position**: Bottom-left corner, 16px margin

#### 1.3 Stage/Metal Display (Top-Left)
- **Content**: Shows current metal (e.g., "Lead") and countdown to next transmutation
- **Format**: 
  ```
  LEAD
  +4.5 m → TIN
  ```
- **Update frequency**: Every frame (smooth, no lag)
- **Animation**: Text color pulses or slightly brightens as ball approaches next boundary
- **Position**: Top-left corner, 16px margin

#### 1.4 Collection Counter (Top-Right)
- **Display**: "Items: 4,237" with item count
- **Animation**: When player collects an item, "+1" floats up from the ball and fades
- **Position**: Top-right corner, 16px margin
- **Font**: Match existing UI (see experiments.css or style.css)

#### 1.5 Wedding Cinematic Ending
- **Trigger**: When `this.r >= 18.0` m
- **Behavior**:
  1. Pause ball physics
  2. Zoom camera out over 2 seconds (ease-out)
  3. Play wedding fanfare sound (3–4 seconds)
  4. Display score screen with:
     - Final radius: 18.0 m
     - Total items collected
     - Stage progression (NIGREDO → ALBEDO → CITRINITAS → RUBEDO)
     - Time elapsed
  5. Offer restart or return to menu
- **Tuning dial**: `tune.weddingZoomDuration` (2.0 s), `tune.weddingZoomScale` (40.0 m distance)

## Tuning Dials (All live on `roll.tune`)

```javascript
{
  camBase: 1.2,           // base camera distance
  camScale: 2.0,          // scale per radius unit
  quickTurnBoost: 1.2,    // momentum multiplier after 180-degree turn
  weddingZoomDuration: 2.0,
  weddingZoomScale: 40.0
}
```

## Deliverable

After Phase 1 completion:
- A 5-minute roll feels meaningful and readable
- Size gauge fills smoothly
- Metal display updates correctly
- Item counter climbs
- Wedding ending provides narrative closure
- Live at https://t3dy.github.io/EmblemsIn3d/src/

## Files to Create

- `src/systems/RollUp.js` — main roll-up system, camera scaling, wedding trigger
- `src/ui/RollUpHUD.js` — all four HUD elements + wedding score screen
- `src/sounds/rollup-fanfare.js` or extend existing sound system
- `src/roll-up.html` — entry point for the mode

## Entry Point

Load at: `src/roll-up.html?tune.camScale=2.0&tune.camBase=1.2`

Query params override defaults in `roll.tune`.
