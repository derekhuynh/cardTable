import * as THREE from 'three';
import { GameObject } from './GameObject.js';

interface SquareUserData {
  isIntersecting: boolean;
}

export class Square extends GameObject {
  public mesh: THREE.Mesh;
  public size: number;
  public height: number;
  public userData: SquareUserData;

  constructor(x: number, y: number, size: number = 60, height: number = 20, color: number = 0x3498db, id?: string) {
    super();
    
    // Override the generated ID if one is provided
    if (id) {
      this.id = id;
    }

    const geometry = new THREE.BoxGeometry(size, size, height);
    const material = new THREE.MeshBasicMaterial({ color });
    this.mesh = new THREE.Mesh(geometry, material);

    this.size = size;
    this.height = height;
    this.userData = { isIntersecting: false };
    
    // Set the position after creating mesh
    this.mesh.position.set(x, y, 0);
    
    // Add mesh to transform
    this.transform.add(this.mesh);
  }

  // Delegate position access to the mesh for compatibility
  get position(): THREE.Vector3 {
    return this.mesh.position;
  }

  get material(): THREE.Material | THREE.Material[] {
    return this.mesh.material;
  }

  setIntersecting(isIntersecting: boolean): void {
    this.userData.isIntersecting = isIntersecting;
    (this.material as THREE.MeshBasicMaterial).color.set(isIntersecting ? 0xe74c3c : 0x3498db);
  }

  set renderOrder(value: number) {
    this.mesh.renderOrder = value;
  }

  update(): void {
    if (window.log) {
      window.log('hit');
    }
  }
}

// Extend the Window interface to include the log function
declare global {
  interface Window {
    log?: (msg: string) => void;
  }
}