import * as THREE from 'three';

export class GameObject {
  public id: string;
  public transform: THREE.Object3D;
  public isActive: boolean;

  constructor() {
    this.transform = new THREE.Object3D();
    this.id = this.generateId();
    this.isActive = true; // Default to active
  }

  // Override this in subclasses for per-frame logic
  Update(_deltaTime: number): void {
    // Default: do nothing
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
}0