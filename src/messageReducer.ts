export const MESSAGE_TYPES = {
  SPAWN: 'spawn',
  MOVE: 'move',
  DELETE: 'delete',
  CHAT: 'chat',
  SYNC: 'sync',
  USER_JOIN: 'user_join',
  USER_LEAVE: 'user_leave'
} as const;

export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];

export interface SpawnPayload {
  x: number;
  y: number;
  id: string;
}

export interface MovePayload {
  id: string;
  x: number;
  y: number;
}

export interface DeletePayload {
  id: string;
}

export interface ChatPayload {
  text: string;
}

export interface SyncPayload {
  [key: string]: any; // Flexible for sync data
}

export interface UserJoinPayload {
  name?: string;
}

export interface UserLeavePayload {
  reason?: string;
}

export type MessagePayload = 
  | SpawnPayload 
  | MovePayload 
  | DeletePayload 
  | ChatPayload 
  | SyncPayload 
  | UserJoinPayload 
  | UserLeavePayload;

export interface Message{
  type: MessageType;
  payload: MessagePayload;
  text?: string;
  senderId?: string; // Optional user ID for the message sender
}

declare function log(msg: string): void;

export function handleMessage(message: Message): void {
  const { type, payload, senderId } = message;
  console.log(message)

  switch (type) {
    case MESSAGE_TYPES.SPAWN:
      // Handle square creation
      const spawnPayload = payload as SpawnPayload;
      console.log(`Creating square at (${spawnPayload.x}, ${spawnPayload.y}) with ID: ${spawnPayload.id}`);
      // Add your square creation logic here
      break;

    case MESSAGE_TYPES.MOVE:
      // Handle square movement
      const movePayload = payload as MovePayload;
      console.log(`Moving square ${movePayload.id} to (${movePayload.x}, ${movePayload.y})`);
      // Add your square movement logic here
      break;

    case MESSAGE_TYPES.DELETE:
      // Handle square deletion
      const deletePayload = payload as DeletePayload;
      console.log(`Deleting square with ID: ${deletePayload.id}`);
      // Add your square deletion logic here
      break;

    case MESSAGE_TYPES.CHAT:
      // Handle chat message
      window.log && window.log(`[${senderId}]: ${message.text}`);
      break;

    case MESSAGE_TYPES.SYNC:
      // Handle state synchronization
      window.log && window.log(`Syncing state from ${senderId}`);
      // Add your sync logic here
      break;

    case MESSAGE_TYPES.USER_JOIN:
      // Handle user joining
      console.log(`User ${senderId} joined`);
      // Add your user join logic here
      break;

    case MESSAGE_TYPES.USER_LEAVE:
      // Handle user leaving
      console.log(`User ${senderId} left`);
      // Add your user leave logic here
      break;

    default:
      console.warn(`Unknown message type: ${type}`);
      break;
  }
}

// Helper function to create typed messages
export function createMessage<T extends MessageType>(
  type: T,
  payload: T extends 'spawn' ? SpawnPayload :
          T extends 'move' ? MovePayload :
          T extends 'delete' ? DeletePayload :
          T extends 'chat' ? ChatPayload :
          T extends 'sync' ? SyncPayload :
          T extends 'user_join' ? UserJoinPayload :
          T extends 'user_leave' ? UserLeavePayload :
          never,
  senderId?: string
): Message {
  return {
    type,
    payload,
    senderId
  };
}