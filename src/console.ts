import { sendMessage } from './rtc.js';
import cardDataTest from './classes/cardDataTest.json';

window.log = function (msg) {
  const el = document.getElementById('consoleWindow');
  if (!el) return;
  const line = document.createElement('div');
  line.textContent = typeof msg === 'string' ? msg : JSON.stringify(msg);
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
  // Limit to last 100 messages
  while (el.children.length > 100 && el.firstChild) el.removeChild(el.firstChild);
};

// Attach event listener to the input box for typing commands/messages
(function setupConsoleInput() {
  const input = document.getElementById('consoleInput') as HTMLInputElement | null;
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      const message = input.value.trim();
      
      // Check if it's a command
      if (message.startsWith('/')) {
        handleCommand(message);
      } else {
        // Regular chat message
        window.log && window.log(`[me]: ${message}`);
        sendMessage({ type: "chat", text: message });
      }
      
      input.value = '';
    }
  });
})();

// Handle console commands
function handleCommand(message: string): void {
  const parts = message.split(' ');
  const command = parts[0].toLowerCase();
  
  switch (command) {
    case '/createcard':
      if (parts.length < 2) {
        window.log && window.log('Usage: /createcard <cardId>');
        window.log && window.log('Available cards: ' + cardDataTest.map(card => card.cardId).join(', '));
        return;
      }
      
      const cardId = parts[1];
      const cardExists = cardDataTest.some(card => card.cardId === cardId);
      
      if (!cardExists) {
        window.log && window.log(`Card "${cardId}" not found. Available cards: ${cardDataTest.map(card => card.cardId).join(', ')}`);
        return;
      }
      
      try {
        // Create card at center of screen
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        if (window.createCard) {
          const card = window.createCard(centerX, centerY, cardId);
          window.log && window.log(`Created card: ${cardId}`);
        } else {
          window.log && window.log('Error: createCard function not available');
        }
      } catch (error) {
        window.log && window.log(`Error creating card: ${error instanceof Error ? error.message : String(error)}`);
      }
      break;
      
    case '/help':
      window.log && window.log('Available commands:');
      window.log && window.log('/createcard <cardId> - Create a card');
      window.log && window.log('/help - Show this help message');
      break;
      
    default:
      window.log && window.log(`Unknown command: ${command}. Type /help for available commands.`);
      break;
  }
}

// Extend window interface for TypeScript
declare global {
  interface Window {
    createCard?: (x: number, y: number, cardId: string, remote?: boolean, gameId?: string | null) => any;
    gameObjects?: any[];
  }
}