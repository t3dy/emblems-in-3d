/**
 * RollUpHUD — All four UI elements for Roll Up mode
 *
 * 1. Size gauge (bottom-left): 0 → 18 m bar with metal stage icons
 * 2. Stage/metal display (top-left): current metal + countdown to next
 * 3. Collection counter (top-right): "Items: X" with +1 float animation
 * 4. Wedding score screen: shown at r ≥ 18 m
 */

export class RollUpHUD {
  constructor(rollUpSystem) {
    this.rollUp = rollUpSystem;
    this.itemFloatQueue = [];
    this.weddingActive = false;

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'rollup-hud';
    this.container.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      color: #e8ddc4;
      z-index: 100;
    `;
    document.body.appendChild(this.container);

    // Build HUD elements
    this.sizeGauge = this.createSizeGauge();
    this.stageDisplay = this.createStageDisplay();
    this.collectionCounter = this.createCollectionCounter();
    this.weddingScreen = this.createWeddingScreen();

    // Listen for events
    window.addEventListener('itemCollected', (e) => this.onItemCollected(e));
    window.addEventListener('weddingStarted', (e) => this.onWeddingStarted(e));
  }

  /**
   * Create size gauge (bottom-left)
   * Vertical bar from 0 → 18 m with metal stage icons
   */
  createSizeGauge() {
    const gaugeContainer = document.createElement('div');
    gaugeContainer.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 16px;
      width: 80px;
      height: 280px;
      display: flex;
      flex-direction: column-reverse;
      gap: 8px;
      pointer-events: none;
    `;

    const gaugeBar = document.createElement('div');
    gaugeBar.id = 'size-gauge-bar';
    gaugeBar.style.cssText = `
      flex: 1;
      background: linear-gradient(to top, #d4534f 0%, #f4d03f 33%, #f5e6d3 66%, #1b1410 100%);
      border: 2px solid #8b7355;
      border-radius: 4px;
      box-shadow: inset 0 0 8px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column-reverse;
      overflow: hidden;
    `;

    const gaugeFill = document.createElement('div');
    gaugeFill.id = 'size-gauge-fill';
    gaugeFill.style.cssText = `
      height: 0%;
      background: rgba(212, 83, 79, 0.7);
      transition: height 0.05s linear;
      border-radius: 2px;
    `;
    gaugeBar.appendChild(gaugeFill);

    const stageLabels = document.createElement('div');
    stageLabels.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 280px;
      display: flex;
      flex-direction: column-reverse;
      pointer-events: none;
    `;

    // Stage boundaries at 4.5, 9.0, 13.5, 18.0 m
    const boundaries = [
      { m: 4.5, label: '▲', color: '#f5e6d3' },
      { m: 9.0, label: '▲', color: '#f4d03f' },
      { m: 13.5, label: '▲', color: '#d4534f' },
      { m: 18.0, label: '★', color: '#ffd700' },
    ];

    for (const b of boundaries) {
      const icon = document.createElement('span');
      const percent = (b.m / 18.0) * 100;
      icon.textContent = b.label;
      icon.style.cssText = `
        position: absolute;
        bottom: ${percent}%;
        left: 50%;
        transform: translateX(-50%) translateY(50%);
        color: ${b.color};
        font-size: 16px;
        font-weight: bold;
        text-shadow: 0 0 4px rgba(0,0,0,0.8);
        transition: color 0.3s ease;
      `;
      icon.dataset.boundary = b.m;
      stageLabels.appendChild(icon);
    }

    const label = document.createElement('div');
    label.textContent = 'SIZE';
    label.style.cssText = `
      position: absolute;
      top: -24px;
      left: 0;
      font-size: 11px;
      letter-spacing: 1px;
      color: #8b7355;
      text-transform: uppercase;
    `;

    const radiusDisplay = document.createElement('div');
    radiusDisplay.id = 'radius-display';
    radiusDisplay.textContent = '0.2 m';
    radiusDisplay.style.cssText = `
      position: absolute;
      bottom: -24px;
      left: 0;
      font-size: 12px;
      color: #b08d4a;
      font-weight: bold;
    `;

    gaugeContainer.appendChild(label);
    gaugeContainer.appendChild(gaugeBar);
    gaugeContainer.appendChild(stageLabels);
    gaugeContainer.appendChild(radiusDisplay);

    this.container.appendChild(gaugeContainer);
    return { container: gaugeContainer, fill: gaugeFill, icons: stageLabels, radiusDisplay };
  }

  /**
   * Create stage/metal display (top-left)
   * Shows current metal + countdown to next transmutation
   */
  createStageDisplay() {
    const display = document.createElement('div');
    display.id = 'stage-display';
    display.style.cssText = `
      position: fixed;
      top: 16px;
      left: 16px;
      text-align: left;
      pointer-events: none;
    `;

    const stageName = document.createElement('div');
    stageName.id = 'stage-name';
    stageName.style.cssText = `
      font-size: 20px;
      font-weight: bold;
      letter-spacing: 2px;
      color: #c4a86a;
      text-transform: uppercase;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
      margin-bottom: 4px;
      transition: color 0.3s ease;
    `;

    const nextStage = document.createElement('div');
    nextStage.id = 'next-stage';
    nextStage.style.cssText = `
      font-size: 13px;
      color: #8b7355;
      letter-spacing: 0.5px;
      text-shadow: 0 1px 4px rgba(0,0,0,0.6);
    `;

    display.appendChild(stageName);
    display.appendChild(nextStage);
    this.container.appendChild(display);

    return { container: display, stageName, nextStage };
  }

  /**
   * Create collection counter (top-right)
   * "Items: X" with +1 float animation
   */
  createCollectionCounter() {
    const counter = document.createElement('div');
    counter.id = 'collection-counter';
    counter.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      text-align: right;
      pointer-events: none;
    `;

    const countDisplay = document.createElement('div');
    countDisplay.id = 'count-display';
    countDisplay.style.cssText = `
      font-size: 20px;
      font-weight: bold;
      letter-spacing: 1px;
      color: #c4a86a;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
    `;
    countDisplay.textContent = 'Items: 0';

    counter.appendChild(countDisplay);
    this.container.appendChild(counter);

    return { container: counter, countDisplay };
  }

  /**
   * Create wedding score screen (centered)
   */
  createWeddingScreen() {
    const screen = document.createElement('div');
    screen.id = 'wedding-screen';
    screen.style.cssText = `
      position: fixed;
      inset: 0;
      background: radial-gradient(ellipse at center, rgba(40,32,20,0.8) 0%, rgba(12,10,7,0.96) 80%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      pointer-events: auto;
      opacity: 0;
      transition: opacity 0.8s ease;
      visibility: hidden;
    `;
    screen.style.backdropFilter = 'blur(4px)';

    const content = document.createElement('div');
    content.style.cssText = `
      text-align: center;
      max-width: 600px;
      padding: 3rem;
      border: 2px solid rgba(200,170,110,0.4);
      background: rgba(20,16,10,0.8);
      box-shadow: 0 0 120px rgba(0,0,0,0.9) inset;
      border-radius: 8px;
    `;

    const title = document.createElement('h1');
    title.textContent = '✦ THE WEDDING ✦';
    title.style.cssText = `
      font-size: 2.4rem;
      font-weight: 300;
      letter-spacing: 4px;
      color: #f4d03f;
      margin-bottom: 2rem;
      text-shadow: 0 4px 20px rgba(0,0,0,0.9);
    `;

    const stats = document.createElement('div');
    stats.id = 'wedding-stats';
    stats.style.cssText = `
      margin: 1.5rem 0;
      line-height: 2;
      font-size: 16px;
      color: #e8ddc4;
    `;

    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      margin-top: 2.5rem;
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    `;

    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'RESTART';
    restartBtn.style.cssText = `
      padding: 0.75rem 1.5rem;
      background: rgba(196, 168, 106, 0.2);
      border: 1px solid #c4a86a;
      color: #c4a86a;
      font-family: inherit;
      font-size: 14px;
      letter-spacing: 1px;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.3s ease;
    `;
    restartBtn.onmouseover = () => {
      restartBtn.style.background = 'rgba(196, 168, 106, 0.4)';
      restartBtn.style.boxShadow = '0 0 16px rgba(196, 168, 106, 0.3)';
    };
    restartBtn.onmouseout = () => {
      restartBtn.style.background = 'rgba(196, 168, 106, 0.2)';
      restartBtn.style.boxShadow = 'none';
    };
    restartBtn.onclick = () => location.reload();

    const menuBtn = document.createElement('button');
    menuBtn.textContent = 'MENU';
    menuBtn.style.cssText = `
      padding: 0.75rem 1.5rem;
      background: rgba(139, 115, 85, 0.2);
      border: 1px solid #8b7355;
      color: #8b7355;
      font-family: inherit;
      font-size: 14px;
      letter-spacing: 1px;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.3s ease;
    `;
    menuBtn.onmouseover = () => {
      menuBtn.style.background = 'rgba(139, 115, 85, 0.4)';
      menuBtn.style.boxShadow = '0 0 16px rgba(139, 115, 85, 0.3)';
    };
    menuBtn.onmouseout = () => {
      menuBtn.style.background = 'rgba(139, 115, 85, 0.2)';
      menuBtn.style.boxShadow = 'none';
    };
    menuBtn.onclick = () => location.href = '/EmblemsIn3d/';

    buttonsContainer.appendChild(restartBtn);
    buttonsContainer.appendChild(menuBtn);

    content.appendChild(title);
    content.appendChild(stats);
    content.appendChild(buttonsContainer);
    screen.appendChild(content);

    this.container.appendChild(screen);
    return { screen, stats };
  }

  /**
   * Update all HUD elements each frame
   */
  update() {
    // Size gauge
    const fillPercent = (this.rollUp.r / 18.0) * 100;
    this.sizeGauge.fill.style.height = fillPercent + '%';
    this.sizeGauge.radiusDisplay.textContent = this.rollUp.r.toFixed(1) + ' m';

    // Update stage icon colors
    const currentStage = this.rollUp.getCurrentStage();
    const icons = this.sizeGauge.icons.querySelectorAll('span');
    icons.forEach(icon => {
      const boundary = parseFloat(icon.dataset.boundary);
      if (boundary <= this.rollUp.r) {
        icon.style.opacity = '1';
        icon.style.textShadow = `0 0 8px ${icon.style.color}`;
      } else {
        icon.style.opacity = '0.4';
        icon.style.textShadow = '0 0 4px rgba(0,0,0,0.8)';
      }
    });

    // Stage display
    this.stageDisplay.stageName.textContent = currentStage.name;
    this.stageDisplay.stageName.style.color = this.stageToColor(currentStage.name);

    const nextStage = this.rollUp.getNextStage();
    const distToNext = (nextStage.boundary - this.rollUp.r).toFixed(1);
    this.stageDisplay.nextStage.textContent = `+${distToNext} m → ${nextStage.name}`;

    // Collection counter
    this.collectionCounter.countDisplay.textContent = `Items: ${this.rollUp.itemsCollected}`;

    // Process item float animations
    this.updateItemFloats();
  }

  /**
   * Handle item collected event
   */
  onItemCollected(event) {
    const detail = event.detail;
    this.itemFloatQueue.push({
      count: detail.count,
      startTime: Date.now(),
      duration: 1.5,
    });
  }

  /**
   * Update item float animations
   */
  updateItemFloats() {
    const now = Date.now();
    this.itemFloatQueue = this.itemFloatQueue.filter((float) => {
      const elapsed = (now - float.startTime) / 1000;
      if (elapsed > float.duration) return false;

      const progress = elapsed / float.duration;

      // Create floating "+1" if not already rendered
      if (!float.element) {
        float.element = document.createElement('div');
        float.element.textContent = '+1';
        float.element.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 18px;
          font-weight: bold;
          color: #f4d03f;
          pointer-events: none;
          text-shadow: 0 2px 8px rgba(0,0,0,0.8);
        `;
        this.container.appendChild(float.element);
      }

      // Animate
      const yOffset = progress * 40;
      const opacity = 1 - progress;
      float.element.style.transform = `translate(-50%, calc(-50% - ${yOffset}px))`;
      float.element.style.opacity = opacity;

      return true;
    });
  }

  /**
   * Handle wedding started event
   */
  onWeddingStarted(event) {
    const detail = event.detail;
    this.weddingActive = true;

    const statsHtml = `
      <div>Final Radius: <strong>${detail.finalRadius.toFixed(1)} m</strong></div>
      <div>Items Collected: <strong>${detail.itemsCollected}</strong></div>
      <div>Time Elapsed: <strong>${detail.timeElapsed.toFixed(1)} s</strong></div>
      <div style="margin-top: 1rem; font-size: 14px; color: #8b7355;">
        NIGREDO → ALBEDO → CITRINITAS → RUBEDO
      </div>
    `;

    this.weddingScreen.stats.innerHTML = statsHtml;

    // Show screen after a short delay (time for zoom to complete)
    setTimeout(() => {
      this.weddingScreen.screen.style.opacity = '1';
      this.weddingScreen.screen.style.visibility = 'visible';
    }, (this.rollUp.tune.weddingZoomDuration + 0.5) * 1000);
  }

  /**
   * Map stage name to color
   */
  stageToColor(stageName) {
    const colors = {
      'NIGREDO': '#1b1410',
      'ALBEDO': '#f5e6d3',
      'CITRINITAS': '#f4d03f',
      'RUBEDO': '#d4534f',
    };
    return colors[stageName] || '#c4a86a';
  }

  /**
   * Dispose
   */
  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

export default RollUpHUD;
