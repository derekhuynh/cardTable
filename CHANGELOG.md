# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2025-07-01

### Changed
- **BREAKING**: GameObject now extends THREE.Object3D directly instead of composition
- GameObject uses `gameId` property instead of `id` to avoid THREE.js conflicts
- Square class updated to work with new GameObject inheritance architecture
- Scene management simplified - GameObjects added directly to scene
- Raycasting updated to work with GameObject hierarchy using recursive intersection
- Render order handling improved with proper method instead of property setter

### Improved
- Better memory usage by eliminating redundant Object3D instances
- Cleaner API with natural THREE.js integration
- Simplified codebase with fewer delegation patterns
- More maintainable architecture for future GameObject types

## [0.2.0] - 2025-07-01

### Added
- Generic GameObject architecture for extensible game object types
- SYNC message system for peer synchronization on join
- Type-safe message interfaces with GameObjectData structure
- Factory pattern for creating different game object types
- Real-time state synchronization for late-joining peers

### Changed
- Refactored main.js to use gameObjects array instead of squares-specific code
- Updated Square class to properly extend GameObject with type system
- Enhanced collision detection to work with any GameObject size
- Improved message handling to support object types and SYNC messages

### Fixed
- GameObject ID system now consistent across all object types
- Peer synchronization now handles complete game state transfer

## [0.1.0] - 2025-07-01

### Added
- Initial peer-to-peer card table application with Three.js and WebRTC
- Real-time square/card movement synchronization across peers
- Host/peer architecture with Firebase signaling
- Project documentation and development setup

### Fixed
- Square movement sync across peers with unique `squareId` system
- Peer name display in console window

### Changed
- Improved message handling for spawn and move events
- Enhanced square tracking with unique identifiers

[unreleased]: https://github.com/username/cardTable/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/username/cardTable/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/username/cardTable/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/username/cardTable/releases/tag/v0.1.0