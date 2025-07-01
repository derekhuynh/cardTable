import * as THREE from 'three';

export const GAME_OBJECT_TYPES = {
  SQUARE: 'square'
} as const;

export type GameObjectType = typeof GAME_OBJECT_TYPES[keyof typeof GAME_OBJECT_TYPES];

export class GameObject {
  public id: string;
  public transform: THREE.Object3D;
  public isActive: boolean;
  public type: GameObjectType;

  constructor(type: GameObjectType = GAME_OBJECT_TYPES.SQUARE) {
    this.transform = new THREE.Object3D();
    this.id = this.generateId();
    this.isActive = true; // Default to active
    this.type = type;
  }

  // Override this in subclasses for per-frame logic
  Update(_deltaTime: number): void {
    // Default: do nothing
  }

  // Override this in subclasses to provide size for collision detection
  get size(): number {
    return 0;
  }

  // Override this in subclasses to provide position for collision detection
  get position(): THREE.Vector3 {
    return this.transform.position;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
}0