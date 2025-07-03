import * as THREE from 'three';
import { Square } from './classes/Square.js';
import { Card } from './classes/Card.js';
import { GameObject, GAME_OBJECT_TYPES } from './classes/GameObject.js';
import { sendMessage, setOnMessage } from './rtc.js';
import {handleMessage} from './messageReducer.ts';

const SQUARE_SIZE = 60;
const SQUARE_HEIGHT = 20;
let gameObjects = [];
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

// Helper: check if two game objects intersect (2D)
function gameObjectsIntersect(a, b) {
  return (
    a.position.x < b.position.x + b.size &&
    a.position.x + a.size > b.position.x &&
    a.position.y < b.position.y + b.size &&
    a.position.y + a.size > b.position.y
  );
}

// Create a game object using the factory pattern
function createGameObject(type, x, y, remote = false, gameId = null, cardId = null) {
  let gameObject;
  
  switch (type) {
    case GAME_OBJECT_TYPES.SQUARE:
      gameObject = new Square(x, y, SQUARE_SIZE, SQUARE_HEIGHT, 0x3498db, gameId);
      scene.add(gameObject);
      break;
    case GAME_OBJECT_TYPES.CARD:
      if (!cardId) {
        throw new Error('cardId is required for CARD type');
      }
      gameObject = new Card(x, y, cardId, gameId);
      scene.add(gameObject);
      break;
    default:
      throw new Error(`Unknown game object type: ${type}`);
  }
  
  // Add object to gameObjects array for tracking
  gameObjects.push(gameObject);
  
  if (!remote) {
    const message = { type: "spawn", x, y, id: gameObject.gameId, objectType: type };
    if (cardId) {
      message.cardId = cardId;
    }
    sendMessage(message);
  }
  return gameObject;
}

// Backward compatibility wrapper
function createSquare(x, y, remote = false, gameId = null) {
  return createGameObject(GAME_OBJECT_TYPES.SQUARE, x, y, remote, gameId);
}

// Card creation helper
function createCard(x, y, cardId, remote = false, gameId = null) {
  return createGameObject(GAME_OBJECT_TYPES.CARD, x, y, remote, gameId, cardId);
}

// Export for console commands
window.createCard = createCard;
window.gameObjects = gameObjects;

// Helper function to find a game object by its ID
function findGameObjectById(gameId) {
  return gameObjects.find(gameObject => gameObject.gameId === gameId);
}

// Backward compatibility wrapper
function findSquareById(gameId) {
  return findGameObjectById(gameId);
}

// Update colors based on intersection
function updateIntersections() {
  gameObjects.forEach(obj => {
    if (obj.setIntersecting) {
      obj.setIntersecting(false);
    }
  });

  for (let i = 0; i < gameObjects.length; i++) {
    for (let j = i + 1; j < gameObjects.length; j++) {
      if (gameObjectsIntersect(gameObjects[i], gameObjects[j])) {
        if (gameObjects[i].setIntersecting) {
          gameObjects[i].setIntersecting(true);
        }
        if (gameObjects[j].setIntersecting) {
          gameObjects[j].setIntersecting(true);
        }
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

function getGameObjectAt(mx, my) {
  raycaster.setFromCamera(new THREE.Vector2(
    (mx / cameraSettings.right) * 2 - 1,
    -(my / cameraSettings.top) * 2 + 1
  ), camera);
  const intersects = raycaster.intersectObjects(gameObjects, true); // true for recursive
  if (intersects.length > 0) {
    // Find the game object that owns this mesh (traverse up the parent hierarchy)
    let object = intersects[0].object;
    while (object && !gameObjects.includes(object)) {
      object = object.parent;
    }
    return object || null;
  }
  return null;
}

// Backward compatibility wrapper
function getSquareAt(mx, my) {
  return getGameObjectAt(mx, my);
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
    hit.setRenderOrder(1); // Bring to front
    gameObjects = gameObjects.filter(obj => obj !== hit);
    gameObjects.push(hit);
    offset.x = mx - (hit.position.x);
    offset.y = (cameraSettings.top - my) - (hit.position.y);
  } else {
    const obj = createSquare(mx, (cameraSettings.top - my));
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
      id: dragging.gameId, 
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
      id: dragging.gameId, 
      x: dragging.position.x, 
      y: dragging.position.y 
    });
  }
  dragging = null;
});

// Handle incoming RTC messages
setOnMessage((msg, peerId) => {
  if (msg.type === "spawn") {
    const objectType = msg.objectType || GAME_OBJECT_TYPES.SQUARE;
    const obj = createGameObject(objectType, msg.x, msg.y, true, msg.id, msg.cardId);
  } else if (msg.type === "move") {
    const obj = findGameObjectById(msg.id);
    if (obj) {
      obj.position.x = msg.x;
      obj.position.y = msg.y;
    }
  } else if (msg.type === "sync") {
    // Handle sync message with multiple objects
    if (msg.objects && Array.isArray(msg.objects)) {
      msg.objects.forEach(objData => {
        const obj = createGameObject(objData.type, objData.x, objData.y, true, objData.id, objData.cardId);
      });
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

// Function to sync all current game objects to a new peer
export function syncAllObjects() {
  const objectsData = gameObjects.map(obj => {
    const data = {
      id: obj.gameId,
      type: obj.type,
      x: obj.position.x,
      y: obj.position.y,
      size: obj.size,
      height: obj.height || 20,
      color: obj.material && obj.material.color ? obj.material.color.getHex() : 0x3498db
    };
    
    // Add cardId for cards
    if (obj.type === GAME_OBJECT_TYPES.CARD && obj.cardId) {
      data.cardId = obj.cardId;
    }
    
    return data;
  });
  
  return {
    type: "sync",
    objects: objectsData
  };
}

resizeCameraAndRenderer();
window.addEventListener('resize', resizeCameraAndRenderer);