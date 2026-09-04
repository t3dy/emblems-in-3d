import * as THREE from "three";

// ===========================================================================
// camera.js — one camera, three owners, and every handoff written down.
//
// The rule that matters most in this project: inside a MEASURED station the
// camera is not ours. It belongs to the plate. Its vertical field of view is
// 2·atan(h / 2f) for that plate's solved focal length, and its eye height is
// that plate's solved eye height, because those are the two numbers that make
// the reprojection gate a test rather than a vibe check. Phase 5 bought that
// property; the world must not quietly spend it.
//
// So projection ownership is explicit:
//
//   owner "world"    fov WORLD_FOV, eye WALK_EYE          — free walking
//   owner "plate:NN" fov from the solve, eye from the solve — at a station point
//
// and every transfer between owners is ONE interpolation stage (lerp position,
// slerp orientation, lerp fov), after which the frame returns immediately.
// Stacking a follow smoother on top of a transition is the classic way to get
// a mid-transition half-halt, so we do not.
// ===========================================================================

export const WORLD_FOV = 62;
export const WALK_EYE = 1.62;
const PITCH_LIMIT = Math.PI / 2 - 0.01;
const LOOK_SENS = 0.0022;
const SPEED_WALK = 3.4;
const SPEED_RUN = 8.5;

const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Look-at quaternion without disturbing the camera. */
function lookQuat(from, to, up = UP) {
  _m.lookAt(from, to, up);
  return new THREE.Quaternion().setFromRotationMatrix(_m);
}

export class CameraDirector {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} domElement
   */
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;

    this.mode = "walk";           // walk | tour | handoff
    this.owner = "world";
    this.locked = false;

    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();

    // handoff state — one stage, no second smoother
    this.hand = null;

    // what the tour is doing, if anything
    this.tour = null;
    this.onTourEvent = () => {};

    this.groundY = 0;
    this.bounds = null;           // {minX,maxX,minZ,maxZ}

    this._bind();
  }

  // -- input ---------------------------------------------------------------
  _bind() {
    const d = this.dom;
    this._onMove = (e) => {
      if (!this.locked || this.mode !== "walk") return;
      this.yaw -= e.movementX * LOOK_SENS;
      this.pitch -= e.movementY * LOOK_SENS;
      this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
    };
    this._onLock = () => {
      this.locked = document.pointerLockElement === d;
      if (this.locked) {
        // Re-sync from the camera, per the rig contract: whatever moved the
        // camera while we were unlocked (a tour, a teleport) is now the truth.
        const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, "YXZ");
        this.yaw = e.y;
        this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, e.x));
      } else {
        this.keys.clear();
      }
      this.onTourEvent({ type: "lock", locked: this.locked });
    };
    this._onDown = (e) => {
      if (!this.locked) return;
      this.keys.add(e.code);
    };
    this._onUp = (e) => this.keys.delete(e.code);
    this._onBlur = () => this.keys.clear();

    document.addEventListener("mousemove", this._onMove);
    document.addEventListener("pointerlockchange", this._onLock);
    document.addEventListener("keydown", this._onDown);
    document.addEventListener("keyup", this._onUp);
    window.addEventListener("blur", this._onBlur);
  }

  dispose() {
    document.removeEventListener("mousemove", this._onMove);
    document.removeEventListener("pointerlockchange", this._onLock);
    document.removeEventListener("keydown", this._onDown);
    document.removeEventListener("keyup", this._onUp);
    window.removeEventListener("blur", this._onBlur);
    this.setOwner("world");
  }

  requestLock() {
    this.dom.requestPointerLock?.();
  }

  // -- projection ownership -------------------------------------------------
  /**
   * @param {string} owner   "world" or "plate:NN"
   * @param {object} [spec]  { fov, eye } — required for a plate owner
   */
  setOwner(owner, spec = null) {
    this.owner = owner;
    const fov = owner === "world" ? WORLD_FOV : spec.fov;
    this.eye = owner === "world" ? WALK_EYE : spec.eye;
    if (Math.abs(this.camera.fov - fov) > 1e-4) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Blend fov during a handoff. Anything that touches fov must also touch
   *  the projection matrix, so it lives in exactly one place. */
  _setFov(fov) {
    if (Math.abs(this.camera.fov - fov) < 1e-4) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  // -- explicit handoff -----------------------------------------------------
  /**
   * @param {object} target { position:Vector3, quaternion:Quaternion, fov:number,
   *                          owner:string, eye:number }
   * @param {number} seconds
   * @param {function} [then]
   */
  handoff(target, seconds = 1.4, then = null) {
    this.hand = {
      t: 0,
      dur: Math.max(0.001, seconds),
      p0: this.camera.position.clone(),
      q0: this.camera.quaternion.clone(),
      f0: this.camera.fov,
      p1: target.position.clone(),
      q1: target.quaternion.clone(),
      f1: target.fov ?? this.camera.fov,
      owner: target.owner ?? this.owner,
      eye: target.eye ?? this.eye,
      then,
    };
    this.mode = "handoff";
  }

  _stepHandoff(dt) {
    const h = this.hand;
    h.t = Math.min(1, h.t + dt / h.dur);
    const e = 1 - Math.pow(1 - h.t, 1.8);
    this.camera.position.lerpVectors(h.p0, h.p1, e);
    this.camera.quaternion.copy(h.q0).slerp(h.q1, e);
    this._setFov(THREE.MathUtils.lerp(h.f0, h.f1, e));
    if (h.t >= 1) {
      this.owner = h.owner;
      this.eye = h.eye;
      this.hand = null;
      const then = h.then;
      this.mode = then ? "tour" : "walk";
      if (this.mode === "walk") {
        const eu = new THREE.Euler().setFromQuaternion(this.camera.quaternion, "YXZ");
        this.yaw = eu.y;
        this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, eu.x));
      }
      then && then();
    }
  }

  // -- free walk ------------------------------------------------------------
  _stepWalk(dt) {
    _q.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
    this.camera.quaternion.copy(_q);

    if (!this.locked) return;
    const k = this.keys;
    const run = k.has("ShiftLeft") || k.has("ShiftRight");
    const speed = (run ? SPEED_RUN : SPEED_WALK) * dt;

    this.camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-8) _fwd.set(0, 0, -1);
    _fwd.normalize();
    _right.crossVectors(_fwd, UP).normalize().multiplyScalar(-1);

    _v.set(0, 0, 0);
    if (k.has("KeyW") || k.has("ArrowUp")) _v.add(_fwd);
    if (k.has("KeyS") || k.has("ArrowDown")) _v.sub(_fwd);
    if (k.has("KeyA") || k.has("ArrowLeft")) _v.add(_right);
    if (k.has("KeyD") || k.has("ArrowRight")) _v.sub(_right);
    if (_v.lengthSq() > 0) this.camera.position.addScaledVector(_v.normalize(), speed);

    // Spatial constraint is a separate layer from input, on purpose.
    let eye = this.eye ?? WALK_EYE;
    if (k.has("KeyQ")) eye -= 0.75;
    if (k.has("KeyE")) eye += 1.1;
    this.camera.position.y += (this.groundY + eye - this.camera.position.y) * Math.min(1, dt * 9);

    if (this.bounds) {
      const b = this.bounds;
      this.camera.position.x = Math.max(b.minX, Math.min(b.maxX, this.camera.position.x));
      this.camera.position.z = Math.max(b.minZ, Math.min(b.maxZ, this.camera.position.z));
    }
  }

  // -- the guided tour ------------------------------------------------------
  /**
   * @param {Array} stops  [{ key, n, label, view:{pos:Vector3, look:Vector3,
   *                          fov:number, eye:number, owner:string}, dwell:number }]
   * @param {THREE.Curve} curve  the road, for travelling between stops
   */
  startTour(stops, curve, fromIndex = 0) {
    this.tour = {
      stops,
      curve,
      i: fromIndex,
      phase: "arrive",
      t: 0,
      paused: false,
      speed: 1,
    };
    document.exitPointerLock?.();
    this._tourArrive(fromIndex, 2.0);
  }

  stopTour() {
    this.tour = null;
    const p = this.camera.position.clone();
    p.y = this.groundY + WALK_EYE;
    this.handoff(
      { position: p, quaternion: this.camera.quaternion.clone(), fov: WORLD_FOV, owner: "world", eye: WALK_EYE },
      0.9
    );
    this.onTourEvent({ type: "tour-end" });
  }

  /** How long the flight to the next stop should take. On the emblem route the
   *  stops are 26 m apart and this is a step; on the process route the tour can
   *  jump the length of the course, and a 500 m hop taken in two seconds is
   *  nauseating rather than cinematic. So the duration follows the distance. */
  _flightTime(target, base) {
    const d = this.camera.position.distanceTo(target);
    return Math.max(base, Math.min(7.5, base + d / 110));
  }

  _tourArrive(i, seconds) {
    const s = this.tour.stops[i];
    this.tour.i = i;
    this.tour.phase = "arriving";
    seconds = this._flightTime(s.view.pos, seconds);
    this.handoff(
      {
        position: s.view.pos,
        quaternion: lookQuat(s.view.pos, s.view.look),
        fov: s.view.fov,
        owner: s.view.owner,
        eye: s.view.eye,
      },
      seconds,
      () => {
        this.tour.phase = "dwell";
        this.tour.t = 0;
        this.onTourEvent({ type: "arrive", index: i, stop: s, total: this.tour.stops.length });
      }
    );
  }

  tourNext() {
    if (!this.tour) return;
    const n = Math.min(this.tour.stops.length - 1, this.tour.i + 1);
    if (n === this.tour.i && this.tour.i === this.tour.stops.length - 1) {
      this.onTourEvent({ type: "tour-complete" });
      return;
    }
    this._tourArrive(n, 2.6);
  }

  tourPrev() {
    if (!this.tour) return;
    this._tourArrive(Math.max(0, this.tour.i - 1), 2.0);
  }

  tourJump(i) {
    if (!this.tour) return;
    this._tourArrive(Math.max(0, Math.min(this.tour.stops.length - 1, i)), 1.8);
  }

  _stepTour(dt) {
    const t = this.tour;
    if (!t || t.phase !== "dwell") return;
    if (t.paused) return;
    t.t += dt;
    const s = t.stops[t.i];
    // A slow truck forward during the dwell, so a still frame is never still.
    this.camera.getWorldDirection(_fwd);
    this.camera.position.addScaledVector(_fwd, dt * 0.045);
    if (t.t >= (s.dwell ?? 12)) this.tourNext();
  }

  // -- frame ----------------------------------------------------------------
  update(dt) {
    dt = Math.min(dt, 0.1); // clamp across stalls; the springs are explicit Euler
    if (this.mode === "handoff") {
      this._stepHandoff(dt);
      return;                      // ONE interpolation stage. Nothing else runs.
    }
    if (this.mode === "tour") this._stepTour(dt);
    else this._stepWalk(dt);
  }

  /** Everything a diagnostic overlay needs, and nothing it has to guess. */
  debug() {
    return {
      mode: this.mode,
      owner: this.owner,
      fov: +this.camera.fov.toFixed(2),
      eye: +(this.eye ?? WALK_EYE).toFixed(3),
      locked: this.locked,
      pos: this.camera.position.toArray().map((v) => +v.toFixed(1)),
      tour: this.tour ? { i: this.tour.i, phase: this.tour.phase, t: +this.tour.t.toFixed(1) } : null,
      handoff: this.hand ? +this.hand.t.toFixed(2) : null,
    };
  }
}

export { lookQuat };
