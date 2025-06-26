import * as THREE from 'three';

export class GameObject {
  constructor() {
    this.transform = new THREE.Object3D();
    this.id = '';
    this.isActive = true; // Default to active
  }

  // Override this in subclasses for per-frame logic
  Update(deltaTime) {
    // Default: do nothing
  }
}0