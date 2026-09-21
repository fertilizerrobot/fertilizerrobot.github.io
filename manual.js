// manual.js - Three.js logic for Manual Driving Mode

let scene, camera, renderer, robotGroup;
let driveState = {
  up: false,
  down: false,
  left: false,
  right: false,
  dispense1: false,
  dispense2: false,
  dispense3: false
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

  // Draw the individual rows and crops
  const cropGeo = new THREE.ConeGeometry(0.3, 0.8, 4); // 4-sided pyramid for "crops"
  const cropMat = new THREE.MeshPhongMaterial({ color: 0x00aa00, flatShading: true }); // Bright green crops

  for(let i = 0; i < count; i++) {
    const rowX = spacing * (i + 1);
    
    // Create a wider strip for the dirt row (1.5m wide)
    const rowGeo = new THREE.PlaneGeometry(1.5, len);
    const rowMat = new THREE.MeshBasicMaterial({ color: 0x003300, side: THREE.DoubleSide }); // Dark dirt-green track
    const rowMesh = new THREE.Mesh(rowGeo, rowMat);
    
    rowMesh.rotation.x = -Math.PI / 2;
    rowMesh.position.set(rowX, 0.01, len / 2); // Slightly above ground
    fieldGroup.add(rowMesh);

    // Spawn 3D crops along the row densely (every 0.5 meters)
    for (let zOffset = 0.5; zOffset < len; zOffset += 0.5) {
      // Small random variations so it looks organic
      const offsetX = (Math.random() - 0.5) * 1.0; // wider spread across the 1.5m row
      const scale = 1.0 + Math.random() * 0.8; // larger crops
      
      const crop = new THREE.Mesh(cropGeo, cropMat);
      crop.position.set(rowX + offsetX, 0.4 * scale, zOffset);
      crop.scale.set(scale, scale, scale);
      crop.rotation.y = Math.random() * Math.PI;
      fieldGroup.add(crop);

      // 30% chance to have a mini flower on the crop
      if (Math.random() > 0.7) {
        const flowerGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        // Randomly yellow or white
        const color = Math.random() > 0.5 ? 0xffff00 : 0xffffff;
        const flowerMat = new THREE.MeshBasicMaterial({ color: color });
        const flower = new THREE.Mesh(flowerGeo, flowerMat);
        
        // Put flower near the top of the crop
        flower.position.set(rowX + offsetX, (0.8 * scale) + 0.1, zOffset);
        // Random tilt
        flower.rotation.set(Math.random(), Math.random(), Math.random());
        fieldGroup.add(flower);
      }
    }
  }

  // Scatter mud pebbles/rocks randomly across the empty spaces
  const pebbleGeo = new THREE.DodecahedronGeometry(0.15, 0); // low-poly rock shape
  const pebbleMat = new THREE.MeshPhongMaterial({ color: 0x3d2817, flatShading: true }); // muddy brown
  
  // Spawn several hundred pebbles based on field size
  const numPebbles = Math.floor((totalWidth * len) / 3); 
  
  for (let p = 0; p < numPebbles; p++) {
    const rx = Math.random() * totalWidth;
    const rz = Math.random() * len;
    
    const pebble = new THREE.Mesh(pebbleGeo, pebbleMat);
    pebble.position.set(rx, 0.05, rz); // half-buried in ground
    
    // Random rotation and scale
    pebble.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    const scale = 0.3 + Math.random() * 1.2;
    pebble.scale.set(scale, scale, scale);
    
    fieldGroup.add(pebble);
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
  
  // They are rotated 45 degrees by default due to 4 segments, we rotate Y by PI/4 to make them square with the chassis
  // We'll place all 3 side-by-side in a single row across the back, colored to match their fertilizer
  const hoppers = [
    { x: -0.9, z: -1.6, color: 0xcc3333 }, // Left (Red)
    { x: 0.0, z: -1.6, color: 0x33cc33 },  // Center (Green)
    { x: 0.9, z: -1.6, color: 0x3333cc }   // Right (Blue)
  ];
  
  hoppers.forEach(pos => {
    const hopperMat = new THREE.MeshPhongMaterial({ color: pos.color, flatShading: true });
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

function setDispensing(id, isDispensing) {
  if (id === 1) driveState.dispense1 = isDispensing;
  if (id === 2) driveState.dispense2 = isDispensing;
  if (id === 3) driveState.dispense3 = isDispensing;
  
  const btn = document.getElementById('btnDisp' + id);
  if (!btn) return;
  
  const colors = { 1: '#ff5555', 2: '#55ff55', 3: '#5555ff' };
  
  if (isDispensing) {
    btn.style.backgroundColor = colors[id];
    btn.style.color = '#000';
  } else {
    btn.style.backgroundColor = 'transparent';
    btn.style.color = colors[id];
  }
}

function handleKey(e, isDown) {
  if (!window.isManualModeActive) return;
  const key = e.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') driveState.up = isDown;
  if (key === 's' || key === 'arrowdown') driveState.down = isDown;
  if (key === 'a' || key === 'arrowleft') driveState.left = isDown;
  if (key === 'd' || key === 'arrowright') driveState.right = isDown;
  
  const code = e.code || '';
  const keyCode = e.keyCode || e.which || 0;
  
  if (key === '1' || code === 'Digit1' || code === 'Numpad1' || keyCode === 49 || keyCode === 97) setDispensing(1, isDown);
  if (key === '2' || code === 'Digit2' || code === 'Numpad2' || keyCode === 50 || keyCode === 98) setDispensing(2, isDown);
  if (key === '3' || code === 'Digit3' || code === 'Numpad3' || keyCode === 51 || keyCode === 99) setDispensing(3, isDown);
}

// Shared geometries and materials for particles to prevent memory leak
const fertGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const fertMat1 = new THREE.MeshBasicMaterial({ color: 0xff3333 });
const fertMat2 = new THREE.MeshBasicMaterial({ color: 0x33ff33 });
const fertMat3 = new THREE.MeshBasicMaterial({ color: 0x3333ff });

function createParticle(id) {
  let mat = fertMat2;
  let offsetX = 0;
  
  if (id === 1) { mat = fertMat1; offsetX = -0.9; }
  else if (id === 2) { mat = fertMat2; offsetX = 0.0; }
  else if (id === 3) { mat = fertMat3; offsetX = 0.9; }

  const mesh = new THREE.Mesh(fertGeo, mat);
  
  // Drop from back of robot directly under the respective hopper
  const offset = new THREE.Vector3(offsetX, 1.0, -1.6);
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), robotHeading);
  
  mesh.position.set(robotPos.x + offset.x, offset.y, robotPos.z + offset.z);
  
  scene.add(mesh);
  particles.push({ mesh, velocity: 0 });
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    
    // Only update falling particles
    if (p.mesh.position.y > 0.05) {
      p.velocity += 0.01; // Gravity
      p.mesh.position.y -= p.velocity;
      
      // Hit ground
      if (p.mesh.position.y <= 0.05) {
        p.mesh.position.y = 0.05;
      }
    }
  }
  
  // Cleanup old particles safely outside the loop
  if (particles.length > 50000) {
     scene.remove(particles[0].mesh);
     particles.shift();
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
  if (driveState.dispense1 && Math.random() > 0.5) createParticle(1);
  if (driveState.dispense2 && Math.random() > 0.5) createParticle(2);
  if (driveState.dispense3 && Math.random() > 0.5) createParticle(3);
  
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
