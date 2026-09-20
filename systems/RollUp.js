import * as THREE from "three";

/**
 * RollUp — The growing ball system for Roll Up mode.
 *
 * The player's avatar is a ball that rolls uphill and accumulates mass.
 * The camera maintains a dynamic distance based on ball radius.
 * At r ≥ 18 m, the wedding ending is triggered.
 */

export class RollUp {
  constructor(scene, camera, options = {}) {
    this.scene = scene;
    this.camera = camera;

    // Ball state
    this.r = options.initialRadius || 0.2;        // radius in meters
    this.rMax = 18.0;                              // max radius before wedding
    this.pos = new THREE.Vector3(0, this.r, 0);   // position (center of world)
    this.vel = new THREE.Vector3(0, 0, 0);        // velocity
    this.mass = Math.pow(this.r, 3);              // mass ∝ r³ (sphere volume)

    // Physics
    this.gravity = options.gravity || 9.81;
    this.friction = options.friction || 0.15;
    this.restitution = options.restitution || 0.6;
    this.rollResistance = options.rollResistance || 0.05;
    this.slopeAngle = options.slopeAngle || 0.15;  // radians, ~8.6°

    // Camera tuning
    this.tune = {
      camBase: options.tune?.camBase ?? 1.2,
      camScale: options.tune?.camScale ?? 2.0,
      quickTurnBoost: options.tune?.quickTurnBoost ?? 1.2,
      weddingZoomDuration: options.tune?.weddingZoomDuration ?? 2.0,
      weddingZoomScale: options.tune?.weddingZoomScale ?? 40.0,
    };

    // Wedding state
    this.weddingTriggered = false;
    this.weddingStartTime = null;

    // Metrics
    this.itemsCollected = 0;
    this.timeElapsed = 0;
    this.startTime = Date.now();
    this.distanceTraveled = 0;

    // Rendering
    this.ballGeometry = new THREE.IcosahedronGeometry(this.r, 5);
    this.ballMaterial = new THREE.MeshPhongMaterial({
      color: 0xc4a86a,
      emissive: 0x2a2418,
      specular: 0x8b7355,
      shininess: 32,
    });
    this.ball = new THREE.Mesh(this.ballGeometry, this.ballMaterial);
    this.ball.position.copy(this.pos);
    this.ball.castShadow = true;
    this.ball.receiveShadow = true;
    this.scene.add(this.ball);

    // Ground plane for collision
    this.groundY = 0;
  }

  /**
   * Update ball physics and camera each frame
   */
  update(dt) {
    if (this.weddingTriggered) {
      this.updateWedding(dt);
      return;
    }

    // Apply gravity and slope force
    const slopeForce = this.gravity * Math.sin(this.slopeAngle);
    this.vel.z += slopeForce * dt;

    // Apply friction/roll resistance
    this.vel.z *= Math.pow(1 - this.rollResistance, dt);

    // Update position
    this.pos.z += this.vel.z * dt;
    this.distanceTraveled += this.vel.z * dt;
    this.pos.y = this.r;  // ball always sits on ground

    // Collision with ground (shouldn't happen but safety check)
    if (this.pos.y < this.r) {
      this.pos.y = this.r;
      if (this.vel.y < 0) {
        this.vel.y *= -this.restitution;
      }
    }

    // Grow ball based on distance traveled (transmutation through rolling)
    // Target: reach 18m at ~150m distance
    const targetMaxDist = 150;
    const targetMaxRadius = 18.0;
    const growthRate = targetMaxRadius / targetMaxDist;
    const newRadius = Math.min(0.2 + this.distanceTraveled * growthRate, targetMaxRadius);

    // Update ball mesh if radius changed
    if (Math.abs(newRadius - this.r) > 0.001) {
      this.updateBallMesh(newRadius);
    }
    this.r = newRadius;

    // Update ball rendering
    this.ball.position.copy(this.pos);

    // Update metrics
    this.timeElapsed = (Date.now() - this.startTime) / 1000;

    // Update camera
    this.updateCamera();

    // Check wedding trigger
    if (this.r >= this.rMax) {
      this.triggerWedding();
    }
  }

  /**
   * Update camera to follow ball at dynamic distance
   */
  updateCamera() {
    const targetDistance = this.tune.camBase + this.r * this.tune.camScale;
    const targetHeight = this.r + 2.0;

    // Ease camera toward target position
    const ease = 0.08;
    const currentDistance = this.camera.position.distanceTo(this.pos);
    const newDistance = THREE.MathUtils.lerp(currentDistance, targetDistance, ease);

    // Position camera above and behind the ball
    const direction = new THREE.Vector3(0, 0, 1).normalize();
    const cameraOffset = direction.multiplyScalar(newDistance).add(new THREE.Vector3(0, targetHeight, 0));

    this.camera.position.lerp(this.pos.clone().add(cameraOffset), ease);
    this.camera.lookAt(this.pos.clone().add(new THREE.Vector3(0, this.r, 0)));
  }

  /**
   * Trigger the wedding ending cinematic
   */
  triggerWedding() {
    this.weddingTriggered = true;
    this.weddingStartTime = Date.now();

    // Pause ball physics
    this.vel.z = 0;

    // Dispatch event for HUD to show score screen
    window.dispatchEvent(new CustomEvent('weddingStarted', {
      detail: {
        finalRadius: this.r,
        itemsCollected: this.itemsCollected,
        timeElapsed: this.timeElapsed,
      }
    }));
  }

  /**
   * Update camera during wedding cinematic
   */
  updateWedding(dt) {
    const weddingElapsed = (Date.now() - this.weddingStartTime) / 1000;
    const weddingProgress = Math.min(weddingElapsed / this.tune.weddingZoomDuration, 1.0);

    // Ease out zoom
    const easeProgress = 1 - Math.pow(1 - weddingProgress, 3);
    const targetDistance = this.tune.camBase + this.r * this.tune.camScale;
    const finalDistance = THREE.MathUtils.lerp(targetDistance, this.tune.weddingZoomScale, easeProgress);

    const direction = new THREE.Vector3(0, 0, 1).normalize();
    const cameraOffset = direction.multiplyScalar(finalDistance).add(new THREE.Vector3(0, this.r + 2.0, 0));

    this.camera.position.copy(this.pos.clone().add(cameraOffset));
    this.camera.lookAt(this.pos.clone().add(new THREE.Vector3(0, this.r, 0)));
  }

  /**
   * Update ball mesh when radius changes
   */
  updateBallMesh(newRadius) {
    this.scene.remove(this.ball);
    this.ballGeometry.dispose();
    this.ballGeometry = new THREE.IcosahedronGeometry(newRadius, 5);
    this.ball = new THREE.Mesh(this.ballGeometry, this.ballMaterial);
    this.ball.position.copy(this.pos);
    this.ball.castShadow = true;
    this.ball.receiveShadow = true;
    this.scene.add(this.ball);
  }

  /**
   * Add mass to the ball (collection or growth)
   */
  addMass(amount) {
    this.mass += amount;
    // Update radius based on mass (assuming constant density)
    // volume = mass / density, and volume = (4/3)*pi*r³
    // so r = (3*mass / (4*pi*density))^(1/3)
    this.r = Math.cbrt((3 * this.mass) / (4 * Math.PI));
    this.updateBallMesh(this.r);
  }

  /**
   * Collect an item
   */
  collectItem() {
    this.itemsCollected += 1;
    // Small mass increase per item
    this.addMass(0.01);

    // Dispatch event for HUD animation
    window.dispatchEvent(new CustomEvent('itemCollected', {
      detail: { count: this.itemsCollected }
    }));
  }

  /**
   * Get current stage (NIGREDO, ALBEDO, CITRINITAS, RUBEDO)
   */
  getCurrentStage() {
    const stages = [
      { name: 'NIGREDO', color: 0x1b1410, boundary: 0 },
      { name: 'ALBEDO', color: 0xf5e6d3, boundary: 4.5 },
      { name: 'CITRINITAS', color: 0xf4d03f, boundary: 9.0 },
      { name: 'RUBEDO', color: 0xd4534f, boundary: 13.5 },
    ];

    for (let i = stages.length - 1; i >= 0; i--) {
      if (this.r >= stages[i].boundary) {
        return stages[i];
      }
    }

    return stages[0];
  }

  /**
   * Get next stage info
   */
  getNextStage() {
    const stages = [
      { name: 'NIGREDO', boundary: 0 },
      { name: 'ALBEDO', boundary: 4.5 },
      { name: 'CITRINITAS', boundary: 9.0 },
      { name: 'RUBEDO', boundary: 13.5 },
      { name: 'COMPLETION', boundary: 18.0 },
    ];

    for (let i = 0; i < stages.length; i++) {
      if (this.r < stages[i].boundary) {
        return {
          name: stages[i].name,
          boundary: stages[i].boundary,
          progress: this.r / stages[i].boundary,
        };
      }
    }

    return {
      name: 'COMPLETION',
      boundary: 18.0,
      progress: 1.0,
    };
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.scene.remove(this.ball);
    this.ballGeometry.dispose();
    this.ballMaterial.dispose();
  }
}

export default RollUp;
