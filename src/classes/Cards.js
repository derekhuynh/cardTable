import * as THREE from 'three';
import { GameObject } from './GameObject.js';

export class Cards extends GameObject {
  constructor() {
    super();
    this.text = '';
    
    // Add any Cards-specific properties or initialization here
  }

  // Optionally override Update for per-frame logic
  Update(deltaTime) {
    // Cards-specific update logic
    // super.Update(deltaTime); // Call base if needed
  }
}