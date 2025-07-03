import * as THREE from 'three';

export const GAME_OBJECT_TYPES = {
  SQUARE: 'square',
  CARD: 'card'
} as const;

export type GameObjectType = typeof GAME_OBJECT_TYPES[keyof typeof GAME_OBJECT_TYPES];

export class GameObject extends THREE.Object3D {
  public gameId: string;
  public isActive: boolean;
  public type: GameObjectType;

  constructor(type: GameObjectType = GAME_OBJECT_TYPES.SQUARE) {
    super();
    this.gameId = this.generateId();
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

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  }
}0