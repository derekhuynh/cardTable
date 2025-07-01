import * as THREE from 'three';
import { GameObject, GAME_OBJECT_TYPES } from './GameObject.js';

interface SquareUserData {
  isIntersecting: boolean;
}

export class Square extends GameObject {
  private mesh: THREE.Mesh;
  private _size: number;
  public height: number;
  public userData: SquareUserData;

  constructor(x: number, y: number, size: number = 60, height: number = 20, color: number = 0x3498db, gameId?: string) {
    super(GAME_OBJECT_TYPES.SQUARE);
    
    // Override the generated ID if one is provided
    if (gameId) {
      this.gameId = gameId;
    }

    const geometry = new THREE.BoxGeometry(size, size, height);
    const material = new THREE.MeshBasicMaterial({ color });
    this.mesh = new THREE.Mesh(geometry, material);

    this._size = size;
    this.height = height;
    this.userData = { isIntersecting: false };
    
    // Add mesh as child to this GameObject
    this.add(this.mesh);
    
    // Set position directly on this GameObject
    this.position.set(x, y, 0);
  }

  // Override GameObject's size getter
  get size(): number {
    return this._size;
  }

  // Access to mesh properties
  get material(): THREE.MeshBasicMaterial {
    return this.mesh.material as THREE.MeshBasicMaterial;
  }

  setIntersecting(isIntersecting: boolean): void {
    this.userData.isIntersecting = isIntersecting;
    this.material.color.set(isIntersecting ? 0xe74c3c : 0x3498db);
  }

  setRenderOrder(value: number) {
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