import * as THREE from 'three';
import { GameObject, GAME_OBJECT_TYPES } from './GameObject.js';
import cardDataTest from './cardDataTest.json';

interface CardData {
  cardTitle: string;
  cardDescription: string;
  cardId: string;
  cardImage: string;
}

export class Card extends GameObject {
  private cardGroup: THREE.Group;
  private cardData: CardData;
  private cardWidth: number = 140;
  private cardHeight: number = 200;

  constructor(x: number, y: number, cardId: string, gameId?: string) {
    super(GAME_OBJECT_TYPES.CARD);
    
    // Override the generated ID if one is provided
    if (gameId) {
      this.gameId = gameId;
    }

    // Find card data
    const foundCardData = cardDataTest.find(card => card.cardId === cardId);
    if (!foundCardData) {
      throw new Error(`Card with cardId "${cardId}" not found in cardDataTest`);
    }
    this.cardData = foundCardData;

    this.cardGroup = new THREE.Group();
    this.add(this.cardGroup);

    this.createCardVisual();
    this.position.set(x, y, 0);
  }

  // Override GameObject's size getter for collision detection
  get size(): number {
    return Math.max(this.cardWidth, this.cardHeight);
  }

  get width(): number {
    return this.cardWidth;
  }

  get height(): number {
    return this.cardHeight;
  }

  get cardId(): string {
    return this.cardData.cardId;
  }

  get cardTitle(): string {
    return this.cardData.cardTitle;
  }

  private createCardVisual(): void {
    // Create card base
    const cardGeometry = new THREE.PlaneGeometry(this.cardWidth, this.cardHeight);
    const cardMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      side: THREE.DoubleSide 
    });
    const cardMesh = new THREE.Mesh(cardGeometry, cardMaterial);
    this.cardGroup.add(cardMesh);

    // Create card border
    const borderGeometry = new THREE.PlaneGeometry(this.cardWidth + 2, this.cardHeight + 2);
    const borderMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x000000, 
      side: THREE.DoubleSide 
    });
    const borderMesh = new THREE.Mesh(borderGeometry, borderMaterial);
    borderMesh.position.z = -0.1;
    this.cardGroup.add(borderMesh);

    // Create title text
    this.createTitleText();

    // Create description text
    this.createDescriptionText();

    // Create image area (placeholder for now, will load async)
    this.createImageArea();

    // Load card image asynchronously
    if (this.cardData.cardImage) {
      this.loadCardImage();
    }
  }

  private createTitleText(): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size
    canvas.width = 512;
    canvas.height = 128;

    // Set font and style
    context.fillStyle = '#000000';
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Clear canvas and draw text
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillText(this.cardData.cardTitle, canvas.width / 2, canvas.height / 2);

    // Create texture and material
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    const titleMaterial = new THREE.MeshBasicMaterial({ 
      map: texture, 
      transparent: true,
      side: THREE.DoubleSide
    });

    // Create title mesh
    const titleGeometry = new THREE.PlaneGeometry(this.cardWidth * 0.9, 30);
    const titleMesh = new THREE.Mesh(titleGeometry, titleMaterial);
    titleMesh.position.set(0, this.cardHeight * 0.35, 0.1);
    this.cardGroup.add(titleMesh);
  }

  private createDescriptionText(): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size
    canvas.width = 512;
    canvas.height = 256;

    // Set font and style
    context.fillStyle = '#000000';
    context.font = '32px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Clear canvas and draw text
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Handle text wrapping for longer descriptions
    const words = this.cardData.cardDescription.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    const maxWidth = canvas.width * 0.9;

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = context.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    // Draw each line
    const lineHeight = 40;
    const startY = (canvas.height - (lines.length - 1) * lineHeight) / 2;
    
    lines.forEach((line, index) => {
      context.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });

    // Create texture and material
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    const descMaterial = new THREE.MeshBasicMaterial({ 
      map: texture, 
      transparent: true,
      side: THREE.DoubleSide
    });

    // Create description mesh
    const descGeometry = new THREE.PlaneGeometry(this.cardWidth * 0.9, 60);
    const descMesh = new THREE.Mesh(descGeometry, descMaterial);
    descMesh.position.set(0, -this.cardHeight * 0.35, 0.1);
    this.cardGroup.add(descMesh);
  }

  private createImageArea(): void {
    // Create placeholder gray rectangle for image area
    const imageGeometry = new THREE.PlaneGeometry(this.cardWidth * 0.8, this.cardHeight * 0.4);
    const imageMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xcccccc, 
      side: THREE.DoubleSide 
    });
    const imageMesh = new THREE.Mesh(imageGeometry, imageMaterial);
    imageMesh.position.set(0, 0, 0.1);
    imageMesh.name = 'cardImage'; // Name it so we can replace it later
    this.cardGroup.add(imageMesh);
  }

  private loadCardImage(): void {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    
    loader.load(
      this.cardData.cardImage,
      (texture) => {
        // Image loaded successfully
        this.replaceImagePlaceholder(texture);
      },
      (progress) => {
        // Loading progress
        console.log('Loading card image progress:', progress);
      },
      (error) => {
        // Error loading image
        console.warn('Failed to load card image:', error);
        // Keep the gray placeholder
      }
    );
  }

  private replaceImagePlaceholder(texture: THREE.Texture): void {
    // Find and remove the placeholder
    const placeholder = this.cardGroup.getObjectByName('cardImage');
    if (placeholder) {
      this.cardGroup.remove(placeholder);
    }

    // Create new image mesh with loaded texture
    const imageGeometry = new THREE.PlaneGeometry(this.cardWidth * 0.8, this.cardHeight * 0.4);
    const imageMaterial = new THREE.MeshBasicMaterial({ 
      map: texture, 
      side: THREE.DoubleSide 
    });
    const imageMesh = new THREE.Mesh(imageGeometry, imageMaterial);
    imageMesh.position.set(0, 0, 0.1);
    imageMesh.name = 'cardImage';
    this.cardGroup.add(imageMesh);
  }

  setRenderOrder(value: number): void {
    this.cardGroup.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        child.renderOrder = value;
      }
    });
  }

  update(): void {
    if (window.log) {
      window.log(`Card: ${this.cardData.cardTitle} (${this.cardData.cardId})`);
    }
  }
}