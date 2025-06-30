# Claude Code Memory

## Project Overview
This is a peer-to-peer card table application built with Three.js and WebRTC. Users can create and move squares/cards that sync in real-time across multiple peers.

## Recent Changes - Square Movement Synchronization
Fixed issue where square movements were not syncing between peers.

### Files Modified:
- `src/classes/Square.ts`: Added unique `squareId` system
- `src/main.js`: Added move message broadcasting and proper message handling

### Key Implementation Details:
- Squares now have unique `squareId` property to track across peers
- Move messages are sent when dragging ends (mouseup/mouseleave)
- `findSquareById()` function locates squares for updates
- Messages include: `{ type: "spawn", x, y, id }` and `{ type: "move", id, x, y }`

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