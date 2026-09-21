// manual.js - Three.js logic for Manual Driving Mode

let scene, camera, renderer, robotGroup;
let driveState = {
  up: false,
  down: false,
  left: false,
  right: false,
  dispense: false
};
let robotPos = { x: 0, y: 0, z: 0 };
let robotHeading = 0; // angle in radians
let currentSpeed = 0;
const MAX_SPEED = 0.2; // was 0.5
const ACCEL = 0.005; // was 0.02
const TURN_SPEED = 0.02; // was 0.05

let particles = []; // For fertilizer effect

function initThreeJS() {
  const container = document.getElementById('manual-canvas-container');
  if (!container) return;

  // 1. Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x121212); // Match background
  scene.fog = new THREE.FogExp2(0x121212, 0.03); // Add mood

  // 2. Camera setup
  camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
  
  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // 4. Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  // 5. Custom Field Layout based on Config
  const fieldGroup = new THREE.Group();
  
  // Use state from app.js
  const len = (typeof state !== 'undefined' && state.rowLength) ? state.rowLength : 50;
  const count = (typeof state !== 'undefined' && state.rowCount) ? state.rowCount : 3;
  const spacing = (typeof state !== 'undefined' && state.rowWidth) ? state.rowWidth : 7;
  const totalWidth = spacing * (count + 1);

  // Field boundary (Dark Grey Border)
  const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(totalWidth, len));
  const borderMat = new THREE.LineBasicMaterial({ color: 0x555555 });
  const boundary = new THREE.LineSegments(borderGeo, borderMat);
  boundary.rotation.x = -Math.PI / 2;
  boundary.position.set(totalWidth / 2, 0, len / 2);
  fieldGroup.add(boundary);

  // Draw the individual rows as subtle green tracks
  for(let i = 0; i < count; i++) {
    const rowX = spacing * (i + 1);
    
    // Create a thin strip for the row (0.5m wide)
    const rowGeo = new THREE.PlaneGeometry(0.5, len);
    const rowMat = new THREE.MeshBasicMaterial({ color: 0x005500, side: THREE.DoubleSide });
    const rowMesh = new THREE.Mesh(rowGeo, rowMat);
    
    rowMesh.rotation.x = -Math.PI / 2;
    rowMesh.position.set(rowX, 0.01, len / 2); // Slightly above ground to prevent Z-fighting
    fieldGroup.add(rowMesh);
  }

  scene.add(fieldGroup);
  
  // Reset bot position to the start of the first row
  robotPos = { x: spacing, y: 0, z: 0 };
  robotHeading = 0;

  // 6. Brutalist Placeholder Robot
  robotGroup = new THREE.Group();
  
  // Main Chassis Board (Light Grey / White)
  const chassisGeo = new THREE.BoxGeometry(2.2, 0.1, 3.6);
  const chassisMat = new THREE.MeshPhongMaterial({ color: 0xdddddd });
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.position.y = 0.6;
  robotGroup.add(chassis);

  // Electronics - Battery at the front right
  const batteryGeo = new THREE.BoxGeometry(0.8, 0.5, 0.6);
  const batteryMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
  const battery = new THREE.Mesh(batteryGeo, batteryMat);
  battery.position.set(-0.5, 0.9, 1.2);
  // Add a blue label to battery
  const labelGeo = new THREE.PlaneGeometry(0.6, 0.3);
  const labelMat = new THREE.MeshBasicMaterial({ color: 0x0044cc });
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.26, 0);
  battery.add(label);
  robotGroup.add(battery);

  // Electronics - Circuit Board at the front left
  const boardGeo = new THREE.BoxGeometry(0.6, 0.05, 0.8);
  const boardMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.set(0.5, 0.65, 1.0);
  
  // Tiny components on board
  const compGeo = new THREE.BoxGeometry(0.1, 0.1, 0.2);
  const compMat = new THREE.MeshPhongMaterial({ color: 0x888888 });
  const comp1 = new THREE.Mesh(compGeo, compMat);
  comp1.position.set(-0.1, 0.05, 0);
  board.add(comp1);
  const comp2 = new THREE.Mesh(compGeo, new THREE.MeshPhongMaterial({ color: 0x0000ff }));
  comp2.position.set(0.1, 0.05, 0.2);
  board.add(comp2);
  robotGroup.add(board);

  // 3 Square Hoppers/Funnels at the back
  const hopperGeo = new THREE.CylinderGeometry(0.45, 0.1, 0.6, 4);
  const hopperMat = new THREE.MeshPhongMaterial({ color: 0x444444, flatShading: true });
  
  // They are rotated 45 degrees by default due to 4 segments, we rotate Y by PI/4 to make them square with the chassis
  // We'll place all 3 side-by-side in a single row across the back
  const hoppers = [
    { x: -0.9, z: -1.6 }, // Left
    { x: 0.0, z: -1.6 },  // Center
    { x: 0.9, z: -1.6 }   // Right
  ];
  
  hoppers.forEach(pos => {
    const hopper = new THREE.Mesh(hopperGeo, hopperMat);
    hopper.rotation.y = Math.PI / 4; 
    hopper.position.set(pos.x, 1.2, pos.z);
    
    // Create a thin frame outline for each hopper (simulating the metal rack)
    const edges = new THREE.EdgesGeometry(hopperGeo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x888888 }));
    hopper.add(line);
    
    robotGroup.add(hopper);
  });

  // Large Off-Road Wheels (Black tires, silver rims)
  const wheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.5, 24);
  const wheelMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
  const rimGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.52, 12);
  const rimMat = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, flatShading: true });
  
  const positions = [
    [-1.3, 0.7, 1.4], [1.3, 0.7, 1.4],
    [-1.3, 0.7, -1.4], [1.3, 0.7, -1.4]
  ];
  
  positions.forEach(pos => {
    const wheelGroup = new THREE.Group();
    
    const tire = new THREE.Mesh(wheelGeo, wheelMat);
    tire.rotation.z = Math.PI / 2;
    wheelGroup.add(tire);
    
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);
    
    wheelGroup.position.set(...pos);
    robotGroup.add(wheelGroup);
  });

  scene.add(robotGroup);

  // 7. Input Listeners
  window.addEventListener('keydown', (e) => handleKey(e, true));
  window.addEventListener('keyup', (e) => handleKey(e, false));
  
  // Resize handler
  window.addEventListener('resize', () => {
    if (window.isManualModeActive) {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
  });

  // Start Loop
  animateThreeJS();
}

// UI Buttons hook here
function setDrive(dir, isDown) {
  if (dir === 'up') driveState.up = isDown;
  if (dir === 'down') driveState.down = isDown;
  if (dir === 'left') driveState.left = isDown;
  if (dir === 'right') driveState.right = isDown;
}

function setDispensing(isDispensing) {
  driveState.dispense = isDispensing;
  const btn = document.getElementById('btnDispense');
  if (isDispensing) {
    btn.style.backgroundColor = 'var(--terminal-yellow)';
    btn.style.color = '#000';
  } else {
    btn.style.backgroundColor = 'transparent';
    btn.style.color = 'var(--terminal-yellow)';
  }
}

function handleKey(e, isDown) {
  if (!window.isManualModeActive) return;
  const key = e.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') driveState.up = isDown;
  if (key === 's' || key === 'arrowdown') driveState.down = isDown;
  if (key === 'a' || key === 'arrowleft') driveState.left = isDown;
  if (key === 'd' || key === 'arrowright') driveState.right = isDown;
  if (key === ' ') {
    setDispensing(isDown);
    if(isDown) e.preventDefault(); // Prevent page scroll
  }
}

function createParticle() {
  const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00cc00 }); // Green fertilizer
  const mesh = new THREE.Mesh(geo, mat);
  
  // Drop from back of robot
  const offset = new THREE.Vector3(0, 0.6, -1.2);
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), robotHeading);
  
  mesh.position.set(robotPos.x + offset.x, offset.y, robotPos.z + offset.z);
  
  scene.add(mesh);
  particles.push({ mesh, velocity: 0 });
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.velocity += 0.01; // Gravity
    p.mesh.position.y -= p.velocity;
    
    // Hit ground
    if (p.mesh.position.y < 0.05) {
      p.mesh.position.y = 0.05;
    }
    
    // Cleanup old particles 
    if (particles.length > 200) {
       scene.remove(particles[0].mesh);
       particles.shift();
    }
  }
}

function animateThreeJS() {
  requestAnimationFrame(animateThreeJS);
  
  if (!window.isManualModeActive) return; // Pause rendering if tab hidden

  // Physics & Logic
  if (driveState.up) currentSpeed = Math.min(currentSpeed + ACCEL, MAX_SPEED);
  else if (driveState.down) currentSpeed = Math.max(currentSpeed - ACCEL, -MAX_SPEED);
  else currentSpeed *= 0.9; // Friction

  if (driveState.left) robotHeading += TURN_SPEED;
  if (driveState.right) robotHeading -= TURN_SPEED;

  robotPos.x += Math.sin(robotHeading) * currentSpeed;
  robotPos.z += Math.cos(robotHeading) * currentSpeed;

  robotGroup.position.set(robotPos.x, 0, robotPos.z);
  robotGroup.rotation.y = robotHeading;

  // Dispense logic
  if (driveState.dispense && Math.random() > 0.5) {
    createParticle();
  }
  updateParticles();

  // Chase Camera
  const camOffset = new THREE.Vector3(0, 4, -8); // Behind and above
  camOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), robotHeading);
  
  camera.position.x = robotPos.x + camOffset.x;
  camera.position.y = robotPos.y + camOffset.y;
  camera.position.z = robotPos.z + camOffset.z;
  camera.lookAt(robotPos.x, robotPos.y, robotPos.z);

  // Update Telemetry UI
  document.getElementById('manSpeed').textContent = Math.abs(currentSpeed * 10).toFixed(1);
  document.getElementById('manPosX').textContent = robotPos.x.toFixed(2);
  document.getElementById('manPosZ').textContent = robotPos.z.toFixed(2);

  renderer.render(scene, camera);
}

// Start
document.addEventListener('DOMContentLoaded', () => {
  initThreeJS();
});
