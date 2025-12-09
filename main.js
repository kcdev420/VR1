// Clean, complete main.js: Three.js point cloud + MediaPipe hands
// Ensure dependencies are loaded
if(typeof THREE === 'undefined'){
  const dbg = document.getElementById('debug');
  if(dbg){ dbg.style.display='block'; dbg.textContent += 'ERROR: Three.js no está cargado.\n'; }
  throw new Error('Three.js not loaded');
}

const video = document.getElementById('video');
const canvas = document.getElementById('three-canvas');
const statusEl = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.z = 120;

const group = new THREE.Group();
scene.add(group);

const PARTICLES = 2000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLES * 3);
const base = new Float32Array(PARTICLES * 3);
const colors = new Float32Array(PARTICLES * 3);

for(let i=0;i<PARTICLES;i++){
  const r = 40 * Math.pow(Math.random(), 1/3);
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2*Math.random()-1);
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(phi);
  base[i*3] = x; base[i*3+1] = y; base[i*3+2] = z;
  positions[i*3] = x; positions[i*3+1] = y; positions[i*3+2] = z;

  // pastel-ish color based on vertical position for aesthetics
  const t = (y + 50) / 100; // normalize roughly -50..50
  const rcol = 0.35 + 0.65 * t;
  const gcol = 0.6 + 0.4 * (1-t);
  const bcol = 0.8 - 0.4 * Math.abs(t-0.5);
  colors[i*3] = rcol; colors[i*3+1] = gcol; colors[i*3+2] = bcol;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
const material = new THREE.PointsMaterial({vertexColors:true, size:0.9, sizeAttenuation:true, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending});
const points = new THREE.Points(geometry, material);
group.add(points);

let targetRot = new THREE.Euler(0,0,0);
let targetPos = new THREE.Vector3(0,0,0);
let targetScale = 1.0;

let timeStart = performance.now();

function animate(){
  requestAnimationFrame(animate);
  const t = (performance.now()-timeStart)/1000;

  // gentle breathing movement
  for(let i=0;i<PARTICLES;i++){
    const ix = i*3, iy = ix+1, iz = ix+2;
    const bx = base[ix], by = base[iy], bz = base[iz];
    positions[ix] = bx + Math.sin(t*0.6 + bx*0.1 + i)*0.35;
    positions[iy] = by + Math.cos(t*0.5 + by*0.09 + i)*0.35;
    positions[iz] = bz + Math.sin(t*0.4 + bz*0.07 + i)*0.2;
  }
  geometry.attributes.position.needsUpdate = true;

  // smooth transforms
  group.rotation.x += (targetRot.x - group.rotation.x) * 0.08;
  group.rotation.y += (targetRot.y - group.rotation.y) * 0.08;
  group.rotation.z += (targetRot.z - group.rotation.z) * 0.08;
  group.position.lerp(targetPos, 0.08);
  const s = THREE.MathUtils.lerp(group.scale.x || 1, targetScale, 0.06);
  group.scale.set(s,s,s);

  renderer.render(scene, camera);
}
animate();

function onWindowResize(){
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);

// MediaPipe Hands setup
const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});
hands.setOptions({
  maxNumHands:1,
  modelComplexity:1,
  minDetectionConfidence:0.7,
  minTrackingConfidence:0.6
});
hands.onResults(onResults);

const mpCamera = new Camera(video, {
  onFrame: async () => { await hands.send({image: video}); },
  width: 640, height: 480
});

async function startCamera(){
  try{
    await mpCamera.start();
    statusEl.innerText = 'Cámara activa. Coloca tu mano frente a la cámara.';
  }catch(e){
    statusEl.innerText = 'Error al acceder a la cámara. Permisos denegados o no hay cámara.';
    console.error(e);
  }
}
startCamera();

function onResults(results){
  if(!results.multiHandLandmarks || results.multiHandLandmarks.length===0){
    statusEl.innerText = 'Mano no detectada';
    // slowly return to neutral
    targetPos.lerp(new THREE.Vector3(0,0,0), 0.03);
    targetRot.x *= 0.98; targetRot.y *= 0.98; targetRot.z *= 0.98;
    targetScale += (1.0 - targetScale) * 0.04;
    return;
  }

  statusEl.innerText = 'Mano detectada';
  const lm = results.multiHandLandmarks[0];

  // landmarks are normalized [0..1], origin top-left
  const wrist = lm[0];
  const indexTip = lm[8];
  const middleMcp = lm[9];
  const thumbTip = lm[4];

  // Map wrist position to scene coordinates
  const x = (0.5 - wrist.x) * 120; // left/right
  const y = (0.5 - wrist.y) * 80;  // INVERTED up/down (user requested inversion)
  const z = (0.5 - wrist.z) * 200; // depth
  targetPos.set(x, y, z*0.6);

  // orientation from wrist -> middle_mcp
  const dx = middleMcp.x - wrist.x;
  const dy = wrist.y - middleMcp.y;
  const dz = wrist.z - middleMcp.z;
  const yaw = Math.atan2(dx, dz);
  const pitch = Math.atan2(dy, dz);
  targetRot.set(pitch*1.6, yaw*1.6, 0);

  // Openness / fist detection: average distance from wrist to fingertips (index, middle, ring, pinky)
  const tips = [8,12,16,20];
  let sum = 0;
  for(const idx of tips){
    const f = lm[idx];
    const dx2 = f.x - wrist.x;
    const dy2 = f.y - wrist.y;
    sum += Math.hypot(dx2, dy2);
  }
  const avg = sum / tips.length; // normalized distance

  // map avg to scale: larger avg -> more open -> expand; smaller avg -> fist -> contract
  // baseline around ~0.20 (tweakable). Multiplier controls sensitivity.
  const baseline = 0.20;
  const scaleTarget = THREE.MathUtils.clamp(1 + (avg - baseline) * 6.0, 0.5, 1.8);
  targetScale += (scaleTarget - targetScale) * 0.2;
}


