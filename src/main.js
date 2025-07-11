import * as THREE from 'three';
import { Square } from './classes/Square.js';
import { sendMessage, setOnMessage } from './rtc.js';
import {handleMessage} from './messageReducer.ts';

const SQUARE_SIZE = 60;
const SQUARE_HEIGHT = 20;
let squares = [];
let dragging = null;
let offset = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

const renderer = new THREE.WebGLRenderer({ antialias: false, canvas: document.getElementById('canvas') });
renderer.setClearColor(0xf0f0f0);
renderer.setSize(800, 600);

// Camera Arguments: left, right, top, bottom, near, far
let cameraSettings = {
  left: 0,
  right: 800,
  top: 600,
  bottom: 0,
  near: .1,
  far: 1000
}

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(
  cameraSettings.left,
  cameraSettings.right,
  cameraSettings.top,
  cameraSettings.bottom,
  cameraSettings.near,
  cameraSettings.far
);
camera.position.z = 100;

// camera.rotateOnAxis(new THREE.Vector3(5, 5, 0), .05);

// Helper: check if two squares intersect (2D)
function squaresIntersect(a, b) {
  return (
    a.position.x < b.position.x + SQUARE_SIZE &&
    a.position.x + SQUARE_SIZE > b.position.x &&
    a.position.y < b.position.y + SQUARE_SIZE &&
    a.position.y + SQUARE_SIZE > b.position.y
  );
}

// Create a square mesh using the Square class
function createSquare(x, y, remote = false, id = null) {
  const mesh = new Square(x, y, SQUARE_SIZE, SQUARE_HEIGHT, 0x3498db, id);
  scene.add(mesh.mesh);
  if (!remote) {
    sendMessage({ type: "spawn", x, y, id: mesh.id });
  }
  return mesh;
}

// Helper function to find a square by its ID
function findSquareById(id) {
  return squares.find(square => square.id === id);
}

// Update colors based on intersection
function updateIntersections() {
  squares.forEach(sq => {
    sq.setIntersecting(false);
  });

  for (let i = 0; i < squares.length; i++) {
    for (let j = i + 1; j < squares.length; j++) {
      if (squaresIntersect(squares[i], squares[j])) {
        squares[i].setIntersecting(true);
        squares[j].setIntersecting(true);
      }
    }
  }
}

// Animation loop
function animate() {
  updateIntersections();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// Mouse helpers
function getMousePos(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function getSquareAt(mx, my) {
  raycaster.setFromCamera(new THREE.Vector2(
    (mx / cameraSettings.right) * 2 - 1,
    -(my / cameraSettings.top) * 2 + 1
  ), camera);
  const meshes = squares.map(square => square.mesh);
  const intersects = raycaster.intersectObjects(meshes);
  if (intersects.length > 0) {
    // Find the square that owns this mesh
    const hitMesh = intersects[0].object;
    return squares.find(square => square.mesh === hitMesh);
  }
  return null;
}

// Mouse events
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return; // Only respond to left mouse button
  const rect = renderer.domElement.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  // Use latest cameraSettings.top
  const hit = getSquareAt(mx, my);
  if (hit) {
    hit.update()
    dragging = hit;
    hit.renderOrder = 1; // Bring to front
    squares = squares.filter(sq => sq !== hit);
    squares.push(hit);
    offset.x = mx - (hit.position.x);
    offset.y = (cameraSettings.top - my) - (hit.position.y);
  } else {
    const sq = createSquare(mx, (cameraSettings.top - my));
    squares.push(sq);
  }
});

renderer.domElement.addEventListener('mousemove', (e) => {
  if (dragging) {
    const rect = renderer.domElement.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    dragging.position.x = mx - offset.x;
    dragging.position.y = (cameraSettings.top - my) - offset.y;
  }
});

renderer.domElement.addEventListener('mouseup', () => {
  if (dragging) {
    // Send move message to peers when drag ends
    sendMessage({ 
      type: "move", 
      id: dragging.id, 
      x: dragging.position.x, 
      y: dragging.position.y 
    });
  }
  dragging = null;
});

renderer.domElement.addEventListener('mouseleave', () => {
  if (dragging) {
    // Send move message to peers when drag ends due to mouse leave
    sendMessage({ 
      type: "move", 
      id: dragging.id, 
      x: dragging.position.x, 
      y: dragging.position.y 
    });
  }
  dragging = null;
});

// Handle incoming RTC messages
setOnMessage((msg, peerId) => {
  if (msg.type === "spawn") {
    const sq = createSquare(msg.x, msg.y, true, msg.id);
    squares.push(sq);
  } else if (msg.type === "move") {
    const sq = findSquareById(msg.id);
    if (sq) {
      sq.position.x = msg.x;
      sq.position.y = msg.y;
    }
  } else if (msg.type === "chat") {
    // window.log && window.log(`[${peerId || "peer"}]: ${msg.text}`);
    window.log && handleMessage({...msg, userId: peerId || "peer"});
  }
});

// Ensure camera and renderer always match the viewport size

function resizeCameraAndRenderer() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height);

  camera.left = 0;
  camera.right = width;
  camera.top = height;
  camera.bottom = 0;
  camera.updateProjectionMatrix();

  // Update cameraSettings as well
  cameraSettings.left = 0;
  cameraSettings.right = width;
  cameraSettings.top = height;
  cameraSettings.bottom = 0;
}

resizeCameraAndRenderer();
window.addEventListener('resize', resizeCameraAndRenderer);