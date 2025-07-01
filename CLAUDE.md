# Claude Code Memory

## Project Overview
This is a peer-to-peer card table application built with Three.js and WebRTC. Users can create and move game objects (squares/cards) that sync in real-time across multiple peers.

## Recent Changes - GameObject Architecture & SYNC System (v0.2.0)
Implemented generic GameObject architecture and peer synchronization system for late-joining peers.

### Files Modified:
- `src/classes/GameObject.ts`: Added type system, size/position getters, and GAME_OBJECT_TYPES enum
- `src/classes/Square.ts`: Now extends GameObject with proper type property and size override
- `src/main.js`: Complete refactor to use gameObjects array with factory pattern
- `src/messageReducer.ts`: Updated interfaces for object types and SYNC messages
- `src/rtc.js`: Added SYNC message sending when peers connect

### Key Implementation Details:
- GameObject base class with `id`, `type`, `size`, and `position` properties
- Factory pattern: `createGameObject(type, x, y, remote, id)` for extensible object creation
- SYNC system: Host sends complete game state to newly connected peers
- Generic collision detection and mouse interaction that works with any GameObject
- Backward compatibility maintained with wrapper functions
- Type-safe message interfaces with GameObjectData structure

### Previous Changes - Square Movement Synchronization
- GameObject ID system (formerly squareId) for tracking across peers
- Move messages sent when dragging ends (mouseup/mouseleave)
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