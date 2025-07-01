# Claude Code Memory

## Project Overview
This is a peer-to-peer card table application built with Three.js and WebRTC. Users can create and move game objects (squares/cards) that sync in real-time across multiple peers.

## Recent Changes - GameObject THREE.Object3D Inheritance (v0.3.0)
Refactored GameObject to extend THREE.Object3D directly for cleaner architecture and better THREE.js integration.

### Files Modified:
- `src/classes/GameObject.ts`: Now extends THREE.Object3D, uses gameId instead of id
- `src/classes/Square.ts`: Updated for new inheritance, mesh added as child with this.add()
- `src/main.js`: Simplified scene management and updated raycasting for hierarchy

### Key Implementation Details:
- GameObject extends THREE.Object3D directly (no more composition via transform property)
- Uses `gameId: string` to avoid conflict with THREE.js's numeric `id` property
- Scene management: `scene.add(gameObject)` instead of `scene.add(gameObject.mesh)`
- Raycasting uses recursive intersection with GameObject hierarchy
- Better memory efficiency by eliminating redundant Object3D instances
- Natural THREE.js integration with full Object3D API available

### Previous Changes - GameObject Architecture & SYNC System (v0.2.0)
- Generic GameObject architecture and peer synchronization system for late-joining peers
- Factory pattern: `createGameObject(type, x, y, remote, gameId)` for extensible object creation
- SYNC system: Host sends complete game state to newly connected peers
- Type-safe message interfaces with GameObjectData structure
- Message types: `{ type: "spawn", x, y, id, objectType }`, `{ type: "move", id, x, y }`, `{ type: "sync", objects: [...] }`

## Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build project (includes TypeScript compilation)

## Known Issues
- TypeScript warning about unused `getMousePos` function
- Console.ts has import declaration issue (non-blocking)

## Architecture
- WebRTC for peer-to-peer communication via Firebase signaling
- Three.js for 3D rendering
- Host/peer architecture where host relays messages between peers