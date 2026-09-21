// State
const state = {
  rowLength: 50,
  rowWidth: 7,
  rowCount: 3
};

let canvas, ctx;

// Init
document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('fieldCanvas');
  ctx = canvas.getContext('2d');

  window.addEventListener('resize', () => {
    resizeCanvas();
    drawField();
  });

  resizeCanvas();
  updateField();
});

// Canvas sizing
function resizeCanvas() {
  const container = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = container.clientWidth * dpr;
  canvas.height = Math.max(400, container.clientHeight) * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Sync slider <-> number input
function syncSlider(inputId, sliderId) {
  const slider = document.getElementById(sliderId);
  const input = document.getElementById(inputId);
  input.value = slider.value;
  updateField();
}

// Row stepper
function changeRows(delta) {
  const input = document.getElementById('rowCount');
  let val = parseInt(input.value, 10) || 3;
  val = Math.max(1, Math.min(20, val + delta));
  input.value = val;
  updateField();
}

// Main update function
function updateField() {
  state.rowLength = parseFloat(document.getElementById('fieldLength').value) || 50;
  state.rowWidth = parseFloat(document.getElementById('fieldWidth').value) || 7;
  state.rowCount = parseInt(document.getElementById('rowCount').value, 10) || 3;

  // Sync sliders
  document.getElementById('fieldLengthSlider').value = state.rowLength;
  document.getElementById('fieldWidthSlider').value = state.rowWidth;

  // Update readouts
  document.getElementById('lengthReadout').textContent = state.rowLength;
  document.getElementById('widthReadout').textContent = state.rowWidth;
  document.getElementById('rowReadout').textContent = state.rowCount;

  // Compute derived values
  const spacing = state.rowWidth;
  const totalFieldWidth = spacing * (state.rowCount + 1);
  const area = state.rowLength * totalFieldWidth;
  const trajectory = (state.rowLength * state.rowCount).toFixed(2);
  const timeSeconds = Math.round(parseFloat(trajectory) / 0.5);
  const minutes = Math.floor(timeSeconds / 60);
  const seconds = timeSeconds % 60;

  // Status bar
  document.getElementById('rowLengthDisplay').textContent = state.rowLength + ' m';
  document.getElementById('rowSpacingDisplay').textContent = spacing + ' m';
  document.getElementById('rowCountDisplay').textContent = state.rowCount;
  document.getElementById('trajectoryDisplay').textContent = trajectory + ' m';
  document.getElementById('timeDisplay').textContent = minutes + ' min ' + seconds + ' sec';

  // Summary table
  document.getElementById('summaryRows').textContent = state.rowCount;
  document.getElementById('summarySpacing').textContent = spacing + ' m';
  document.getElementById('summaryTrajectory').textContent = trajectory + ' m';
  document.getElementById('summaryTime').textContent = minutes + ' min ' + seconds + ' sec';


  drawField();
}

// Draw the field path preview — clean, sharp, nof1.ai aesthetic
function drawField() {
  if (!canvas || !ctx) return;

  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);

  // Clear
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, w, h);

  // Margins
  const margin = 50;
  const fieldDrawW = w - margin * 2;
  const fieldDrawH = h - margin * 2;

  const totalFieldWidth = state.rowWidth * (state.rowCount + 1);
  const scaleX = fieldDrawW / state.rowLength;
  const scaleY = fieldDrawH / totalFieldWidth;

  // Grid dots (subtle)
  ctx.fillStyle = '#333333';
  for (let gx = 0; gx <= fieldDrawW; gx += 20) {
    for (let gy = 0; gy <= fieldDrawH; gy += 20) {
      ctx.fillRect(margin + gx, margin + gy, 1, 1);
    }
  }

  // Field boundary — thick grey border
  ctx.strokeStyle = '#575757';
  ctx.lineWidth = 2;
  ctx.strokeRect(margin, margin, fieldDrawW, fieldDrawH);

  // Dimension labels — Top dimension (length)
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 11px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(state.rowLength + 'm', margin + fieldDrawW / 2, margin - 12);

  // Row guidelines
  const spacing = state.rowWidth;

  for (let r = 0; r < state.rowCount; r++) {
    const rowY = margin + (r + 1) * spacing * scaleY;

    // Row guide line
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(margin, rowY);
    ctx.lineTo(margin + fieldDrawW, rowY);
    ctx.stroke();

    // Row label
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '500 9px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('R' + (r + 1), margin - 6, rowY + 3);
  }

  // Planned path — dashed blue line, boustrophedon pattern
  ctx.strokeStyle = '#66b2ff';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();

  const waypoints = [];
  for (let r = 0; r < state.rowCount; r++) {
    const rowY = margin + (r + 1) * spacing * scaleY;
    if (r % 2 === 0) {
      waypoints.push({ x: margin + 4, y: rowY });
      waypoints.push({ x: margin + fieldDrawW - 4, y: rowY });
    } else {
      waypoints.push({ x: margin + fieldDrawW - 4, y: rowY });
      waypoints.push({ x: margin + 4, y: rowY });
    }
  }

  waypoints.forEach((pt, i) => {
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // Waypoint markers — small squares
  ctx.fillStyle = '#ffffff';
  waypoints.forEach((pt) => {
    ctx.fillRect(pt.x - 3, pt.y - 3, 6, 6);
  });

  // Robot start position — filled circle with label
  if (waypoints.length > 0) {
    const start = waypoints[0];
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(start.x, start.y, 7, 0, Math.PI * 2);
    ctx.fill();

    // Dark inner dot
    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.arc(start.x, start.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // START label
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 8px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('START', start.x + 12, start.y + 3);
  }

  // End marker
  if (waypoints.length > 1) {
    const end = waypoints[waypoints.length - 1];
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(end.x, end.y, 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 8px "IBM Plex Mono", monospace';
    ctx.textAlign = end.x > margin + fieldDrawW / 2 ? 'right' : 'left';
    const endLabelX = end.x > margin + fieldDrawW / 2 ? end.x - 12 : end.x + 12;
    ctx.fillText('END', endLabelX, end.y + 3);
  }

  // Spacing annotation — right side (sized as big as top dimension label)
  if (state.rowCount >= 2) {
    const y1 = margin + spacing * scaleY;
    const y2 = margin + 2 * spacing * scaleY;
    const annotX = margin + fieldDrawW + 12;

    ctx.strokeStyle = '#aaaaaa';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    // Bracket lines
    ctx.beginPath();
    ctx.moveTo(annotX, y1);
    ctx.lineTo(annotX + 8, y1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(annotX, y2);
    ctx.lineTo(annotX + 8, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(annotX + 4, y1);
    ctx.lineTo(annotX + 4, y2);
    ctx.stroke();

    // Label — enlarged font (600 11px #ffffff) matching top length label
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(spacing + 'm', annotX + 14, (y1 + y2) / 2 + 4);
  }

  // Store waypoints globally for animation
  state.waypoints = waypoints;
}

// ============================================================
// ANIMATED PATH TRACER — Glowing bot traces the serpentine path
// ============================================================
let animationId = null;
let botProgress = 0;        // 0 to 1 across entire path
const BOT_SPEED = 0.003;    // How fast the bot moves per frame
let trailPoints = [];        // Trail behind the bot
const MAX_TRAIL = 60;        // Trail length

function startPathAnimation() {
  if (animationId) cancelAnimationFrame(animationId);
  botProgress = 0;
  trailPoints = [];
  animateBot();
}

function stopPathAnimation() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

function getBotPosition(progress) {
  const wps = state.waypoints;
  if (!wps || wps.length < 2) return null;

  // Calculate total path length
  let totalLen = 0;
  const segLengths = [];
  for (let i = 1; i < wps.length; i++) {
    const dx = wps[i].x - wps[i - 1].x;
    const dy = wps[i].y - wps[i - 1].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segLengths.push(len);
    totalLen += len;
  }

  // Find position along path
  let targetDist = progress * totalLen;
  for (let i = 0; i < segLengths.length; i++) {
    if (targetDist <= segLengths[i]) {
      const t = targetDist / segLengths[i];
      return {
        x: wps[i].x + (wps[i + 1].x - wps[i].x) * t,
        y: wps[i].y + (wps[i + 1].y - wps[i].y) * t
      };
    }
    targetDist -= segLengths[i];
  }
  return wps[wps.length - 1];
}

function animateBot() {
  if (!canvas || !ctx || !state.waypoints || state.waypoints.length < 2) return;

  // Redraw static field
  drawField();

  const pos = getBotPosition(botProgress);
  if (!pos) return;

  // Add to trail
  trailPoints.push({ x: pos.x, y: pos.y, alpha: 1.0 });
  if (trailPoints.length > MAX_TRAIL) trailPoints.shift();

  // Draw trail — fading cyan glow
  for (let i = 0; i < trailPoints.length; i++) {
    const tp = trailPoints[i];
    const alpha = (i / trailPoints.length) * 0.6;
    const radius = 2 + (i / trailPoints.length) * 2;

    ctx.beginPath();
    ctx.arc(tp.x, tp.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(102, 178, 255, ${alpha})`;
    ctx.fill();
  }

  // Draw bot — bright glowing dot with halo
  // Outer glow
  const glowGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 18);
  glowGrad.addColorStop(0, 'rgba(102, 178, 255, 0.4)');
  glowGrad.addColorStop(0.5, 'rgba(102, 178, 255, 0.1)');
  glowGrad.addColorStop(1, 'rgba(102, 178, 255, 0)');
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
  ctx.fillStyle = glowGrad;
  ctx.fill();

  // Core dot
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#66b2ff';
  ctx.fill();

  // Bright center
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Advance progress
  botProgress += BOT_SPEED;
  if (botProgress >= 1) {
    botProgress = 0;
    trailPoints = [];
  }

  animationId = requestAnimationFrame(animateBot);
}

// Apply config button
function applyConfig() {
  updateField();
  document.getElementById('robotStatus').textContent = 'CONFIGURED — AWAITING MISSION';
  document.getElementById('robotStatus').className = 'terminal-data terminal-positive';
}

// Reset to defaults
function resetConfig() {
  document.getElementById('fieldLength').value = 50;
  document.getElementById('fieldWidth').value = 7;
  document.getElementById('rowCount').value = 3;
  updateField();
  document.getElementById('robotStatus').textContent = 'IDLE — READY';
}

// Navigation Logic
let currentStep = 'setup';
let selectedMode = 'auto'; // default

function selectMode(mode) {
  selectedMode = mode;
  document.getElementById('currentMode').textContent = mode.toUpperCase();
  
  const btnAuto = document.getElementById('btnModeAuto');
  const btnManual = document.getElementById('btnModeManual');
  const msgNotBuilt = document.getElementById('manualNotBuilt');
  const btnNext = document.getElementById('btnNext');

  if (mode === 'auto') {
    btnAuto.classList.add('btn-primary');
    btnManual.classList.remove('btn-primary');
    msgNotBuilt.style.display = 'none';
  } else {
    btnManual.classList.add('btn-primary');
    btnAuto.classList.remove('btn-primary');
    msgNotBuilt.style.display = 'none'; // Manual is built now
  }
  
  btnNext.style.opacity = '1';
  btnNext.style.pointerEvents = 'auto';
}

function goToStep(step) {
  currentStep = step;
  
  // Stop animation when leaving any view
  stopPathAnimation();
  
  // Hide all views
  const setupView = document.getElementById('view-setup');
  const pathView = document.getElementById('view-path');
  const fertView = document.getElementById('view-fert');
  const revView = document.getElementById('view-rev');
  const manView = document.getElementById('view-manual');
  
  if (setupView) setupView.style.display = 'none';
  if (pathView) pathView.style.display = 'none';
  if (fertView) fertView.style.display = 'none';
  if (revView) revView.style.display = 'none';
  if (manView) manView.style.display = 'none';
  
  window.isManualModeActive = false; // Turn off ThreeJS rendering

  // Reset all tabs
  document.querySelectorAll('.nof1-tab').forEach(t => t.classList.remove('active-tab'));
  
  const btnNext = document.getElementById('btnNext');
  const btnPrev = document.getElementById('btnPrev');

  if (step === 'setup') {
    if (setupView) setupView.style.display = 'block';
    document.querySelector('.tab-setup').classList.add('active-tab');
    if (btnPrev) btnPrev.style.display = 'none';
    if (btnNext) btnNext.textContent = 'NEXT ➔';
    // Restore button state based on mode
    selectMode(selectedMode); 
  } else if (step === 'path') {
    if (pathView) pathView.style.display = 'block';
    document.querySelector('.tab-path').classList.add('active-tab');
    if (btnPrev) btnPrev.style.display = 'block';
    if (btnNext) {
      btnNext.textContent = 'NEXT ➔';
      btnNext.style.opacity = '1';
      btnNext.style.pointerEvents = 'auto';
    }
    // Re-draw canvas and start path animation
    setTimeout(() => {
      resizeCanvas();
      drawField();
      startPathAnimation();
    }, 0);
  } else if (step === 'fert') {
    if (fertView) fertView.style.display = 'block';
    document.querySelector('.tab-fert').classList.add('active-tab');
    if (btnPrev) btnPrev.style.display = 'block';
    if (btnNext) {
      btnNext.textContent = 'REVIEW ➔';
      btnNext.style.opacity = '1';
      btnNext.style.pointerEvents = 'auto';
    }
  } else if (step === 'rev') {
    if (revView) revView.style.display = 'block';
    document.querySelector('.tab-rev').classList.add('active-tab');
    if (btnPrev) btnPrev.style.display = 'block';
    if (btnNext) {
      btnNext.textContent = 'START BOT';
      btnNext.style.opacity = '1';
      btnNext.style.pointerEvents = 'auto';
    }
    
    // Populate dynamic data in Review view
    document.getElementById('revMode').textContent = selectedMode.toUpperCase();
    document.getElementById('revLength').textContent = state.rowLength + ' m';
    document.getElementById('revSpacing').textContent = state.rowWidth + ' m';
    document.getElementById('revRows').textContent = state.rowCount;
    document.getElementById('revTrajectory').textContent = document.getElementById('trajectoryDisplay').textContent;
    document.getElementById('revTime').textContent = document.getElementById('timeDisplay').textContent;
  } else if (step === 'manual') {
    if (manView) manView.style.display = 'block';
    // Highlight Setup tab as it's technically still the setup flow
    document.querySelector('.tab-setup').classList.add('active-tab');
    if (btnPrev) btnPrev.style.display = 'block';
    if (btnNext) {
      btnNext.textContent = 'FINISH DRIVING';
      btnNext.style.opacity = '1';
      btnNext.style.pointerEvents = 'auto';
    }
    window.isManualModeActive = true; // Turn on ThreeJS rendering
    
    // Force Three.js to recalculate canvas size now that it's visible
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 0);
  }
}

function nextStep() {
  if (currentStep === 'setup') {
    if (selectedMode === 'auto') goToStep('path');
    else goToStep('manual');
  } else if (currentStep === 'path') {
    goToStep('fert');
  } else if (currentStep === 'fert') {
    goToStep('rev');
  } else if (currentStep === 'rev') {
    alert('Deploying configuration to robot...');
  } else if (currentStep === 'manual') {
    alert('Manual driving session complete!');
    goToStep('setup');
  }
}

function prevStep() {
  if (currentStep === 'rev') {
    goToStep('fert');
  } else if (currentStep === 'fert') {
    goToStep('path');
  } else if (currentStep === 'path') {
    goToStep('setup');
  } else if (currentStep === 'manual') {
    goToStep('setup');
  }
}
