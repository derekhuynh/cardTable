import * as THREE from 'three';

interface SquareUserData {
  isIntersecting: boolean;
}

export class Square extends THREE.Mesh{
  public size: number;
  public height: number;
  public userData: SquareUserData;

  constructor(x: number, y: number, size: number = 60, height: number = 20, color: number = 0x3498db) {
    const geometry = new THREE.BoxGeometry(size, size, height);
    const material = new THREE.MeshBasicMaterial({ color });
    super(geometry, material);

    this.size = size;
    this.height = height;
    this.userData = { isIntersecting: false };
    // Set the position after calling super to ensure 'position' exists
    this.position.set(x, y, 0);
  }

  setIntersecting(isIntersecting: boolean): void {
    this.userData.isIntersecting = isIntersecting;
    (this.material as THREE.MeshBasicMaterial).color.set(isIntersecting ? 0xe74c3c : 0x3498db);
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