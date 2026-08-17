/**
 * Developer Tools and Debugging Utilities
 * Herramientas para debugging y desarrollo
 */

import { devLog } from './core/devLog.js';
import GameRegistry from './core/gameRegistry.js';
import Favorites from './favoritesManager.js';
import Leaderboard from './leaderboardManager.js';
import uiSoundEffects from './uiSoundEffects.js';
import { triggerConfetti } from './confettiEffect.js';

interface DevToolCommand {
  name: string;
  description: string;
  handler: (...args: string[]) => string | void;
}

class DevTools {
  private commands: Map<string, DevToolCommand> = new Map();
  private enabled: boolean = false;
  private history: string[] = [];
  private maxHistory: number = 50;

  constructor() {
    this.setupDefaultCommands();
    this.setupKeyboardShortcut();
  }

  private setupKeyboardShortcut(): void {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+D para toggle dev tools
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  private setupDefaultCommands(): void {
    this.registerCommand('help', 'Show all available commands', () => {
      return this.getHelpText();
    });

    this.registerCommand('clear', 'Clear console', () => {
      // eslint-disable-next-line no-console -- acción explícita del comando, no una traza
      console.clear();
      return 'Console cleared';
    });

    this.registerCommand('games', 'List all registered games', () => {
      const games = GameRegistry.visible();
      return games.map((g) => `${g.id}: ${g.name}`).join('\n');
    });

    this.registerCommand('game', 'Get game details', (id: string) => {
      const game = GameRegistry.get(id);
      if (!game) return `Game '${id}' not found`;
      
      return JSON.stringify(game, null, 2);
    });

    this.registerCommand('vitals', 'Show Core Web Vitals', () => {
      const vitals = window.getWebVitals?.();
      if (!vitals) return 'Performance monitor not available';
      return JSON.stringify(vitals, null, 2);
    });

    this.registerCommand('perf', 'Export performance report', () => {
      const report = window.exportPerformanceReport?.();
      return report ?? 'Performance monitor not available';
    });

    this.registerCommand('errors', 'Show error statistics', () => {
      const stats = window.ErrorLogger?.recent();
      if (!stats) return 'Error tracker not available';
      
      return JSON.stringify(stats, null, 2);
    });

    this.registerCommand('error-report', 'Export error report', () => {
      const recent = window.ErrorLogger?.recent();
      if (!recent) return 'Error tracker not available';
      
      return JSON.stringify(recent, null, 2);
    });

    this.registerCommand('clear-errors', 'Clear error history', () => {
      if (!window.ErrorLogger) return 'Error tracker not available';
      
      window.ErrorLogger.clear();
      return 'Error history cleared';
    });

    this.registerCommand('storage', 'Show localStorage contents', () => {
      const storage: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          storage[key] = localStorage.getItem(key) || '';
        }
      }
      return JSON.stringify(storage, null, 2);
    });

    this.registerCommand('storage-get', 'Get localStorage value', (key: string) => {
      const value = localStorage.getItem(key);
      return value !== null ? value : `Key '${key}' not found`;
    });

    this.registerCommand('storage-set', 'Set localStorage value', (key: string, value: string) => {
      localStorage.setItem(key, value);
      return `Set '${key}' = '${value}'`;
    });

    this.registerCommand('storage-remove', 'Remove localStorage value', (key: string) => {
      localStorage.removeItem(key);
      return `Removed '${key}'`;
    });

    this.registerCommand('storage-clear', 'Clear all localStorage', () => {
      localStorage.clear();
      return 'localStorage cleared';
    });

    this.registerCommand('theme', 'Set theme', (theme: string) => {
      const validThemes = ['dark', 'winter'];
      if (!validThemes.includes(theme)) {
        return `Invalid theme. Valid: ${validThemes.join(', ')}`;
      }
      
      document.body.setAttribute('data-theme', theme);
      return `Theme set to '${theme}'`;
    });

    this.registerCommand('high-contrast', 'Toggle high contrast mode', () => {
      document.body.classList.toggle('high-contrast');
      const isActive = document.body.classList.contains('high-contrast');
      return `High contrast mode: ${isActive ? 'ON' : 'OFF'}`;
    });

    this.registerCommand('reduced-motion', 'Toggle reduced motion', () => {
      document.body.classList.toggle('reduced-motion');
      const isActive = document.body.classList.contains('reduced-motion');
      return `Reduced motion: ${isActive ? 'ON' : 'OFF'}`;
    });

    this.registerCommand('view', 'Navigate to view', (viewId: string) => {
      const showView = window.showView;
      if (!showView) return 'ViewManager not available';
      
      showView(viewId);
      return `Navigated to '${viewId}'`;
    });

    this.registerCommand('favorites', 'List favorite games', () => {
      const favorites = Favorites.getAll();
      return favorites.join('\n');
    });

    this.registerCommand('leaderboard', 'Show leaderboard for game', (gameId: string) => {
      const record = Leaderboard.get(gameId);
      if (!record || record.length === 0) return `No record for '${gameId}'`;
      
      return JSON.stringify(record, null, 2);
    });

    this.registerCommand('confetti', 'Trigger confetti effect', () => {
      triggerConfetti();
      return 'Confetti triggered!';
    });

    this.registerCommand('sound', 'Play UI sound', (sound: string) => {
      const validSounds = ['click', 'hover', 'success', 'error', 'notification', 'filter', 'type'] as const;
      type ValidSound = typeof validSounds[number];
      if (!validSounds.includes(sound as ValidSound)) {
        return `Invalid sound. Valid: ${validSounds.join(', ')}`;
      }
      
      uiSoundEffects[sound as ValidSound]();
      return `Played '${sound}' sound`;
    });

    this.registerCommand('volume', 'Set sound volume', (volume: string) => {
      const vol = parseFloat(volume);
      if (isNaN(vol) || vol < 0 || vol > 1) {
        return 'Volume must be between 0 and 1';
      }
      
      uiSoundEffects.setVolume(vol);
      return `Volume set to ${vol}`;
    });
  }

  registerCommand(name: string, description: string, handler: (...args: string[]) => string | void): void {
    this.commands.set(name, { name, description, handler });
  }

  unregisterCommand(name: string): void {
    this.commands.delete(name);
  }

  executeCommand(input: string): string {
    this.addToHistory(input);
    
    const parts = input.trim().split(/\s+/);
    const commandName = parts[0];
    const args = parts.slice(1);
    
    const command = this.commands.get(commandName);
    
    if (!command) {
      return `Unknown command: ${commandName}. Type 'help' for available commands.`;
    }
    
    try {
      const result = command.handler(...args);
      return result !== undefined ? String(result) : 'Command executed';
    } catch (error) {
      return `Error executing command: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private getHelpText(): string {
    const lines = ['Available commands:'];
    this.commands.forEach((cmd, name) => {
      lines.push(`  ${name.padEnd(20)} - ${cmd.description}`);
    });
    return lines.join('\n');
  }

  private addToHistory(command: string): void {
    this.history.push(command);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  getHistory(): string[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  toggle(): void {
    this.enabled = !this.enabled;
    
    if (this.enabled) {
      this.createDevToolsUI();
      devLog('%c[DevTools] Enabled', 'color: #00ff00; font-weight: bold');
    } else {
      this.removeDevToolsUI();
      devLog('%c[DevTools] Disabled', 'color: #ff0000; font-weight: bold');
    }
  }

  private createDevToolsUI(): void {
    // Crear panel de dev tools
    const panel = document.createElement('div');
    panel.id = 'dev-tools-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 200px;
      background: #1a1a1a;
      border-top: 2px solid #ff6600;
      color: #ffffff;
      font-family: monospace;
      font-size: 12px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 8px 12px;
      background: #2a2a2a;
      border-bottom: 1px solid #444;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <span style="color: #ff6600; font-weight: bold;">DevTools Console</span>
      <button id="dev-tools-close" style="background: #ff0000; color: white; border: none; padding: 4px 8px; cursor: pointer;">Close</button>
    `;

    // Output area
    const output = document.createElement('div');
    output.id = 'dev-tools-output';
    output.style.cssText = `
      flex: 1;
      padding: 8px 12px;
      overflow-y: auto;
      background: #0a0a0a;
      white-space: pre-wrap;
    `;

    // Input area
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
      padding: 8px 12px;
      background: #2a2a2a;
      border-top: 1px solid #444;
      display: flex;
      gap: 8px;
    `;

    const prompt = document.createElement('span');
    prompt.textContent = '>';
    prompt.style.color = '#ff6600';

    const input = document.createElement('input');
    input.id = 'dev-tools-input';
    input.type = 'text';
    input.style.cssText = `
      flex: 1;
      background: #1a1a1a;
      border: 1px solid #444;
      color: #ffffff;
      padding: 4px 8px;
      font-family: monospace;
    `;

    inputContainer.appendChild(prompt);
    inputContainer.appendChild(input);

    panel.appendChild(header);
    panel.appendChild(output);
    panel.appendChild(inputContainer);

    document.body.appendChild(panel);

    // Event listeners
    const closeBtn = header.querySelector('#dev-tools-close') as HTMLButtonElement;
    closeBtn.onclick = () => this.toggle();

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const command = input.value;
        input.value = '';
        
        this.appendOutput(`> ${command}`, '#ff6600');
        const result = this.executeCommand(command);
        this.appendOutput(result, '#ffffff');
      }
    });

    input.focus();

    // Log inicial
    this.appendOutput('DevTools Console ready. Type "help" for commands.', '#00ff00');
  }

  private removeDevToolsUI(): void {
    const panel = document.getElementById('dev-tools-panel');
    if (panel) {
      document.body.removeChild(panel);
    }
  }

  private appendOutput(text: string, color: string): void {
    const output = document.getElementById('dev-tools-output');
    if (!output) return;

    const line = document.createElement('div');
    line.style.color = color;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  log(message: string, type: 'info' | 'warn' | 'error' = 'info'): void {
    const colors = {
      info: '#00ff00',
      warn: '#ffff00',
      error: '#ff0000'
    };
    
    if (this.enabled) {
      this.appendOutput(`[${type.toUpperCase()}] ${message}`, colors[type]);
    }
  }
}

// Singleton instance
export const devTools = new DevTools();

// Exponer en window
if (typeof window !== 'undefined') {
  window.devTools = devTools;
  window.dev = (command: string) => devTools.executeCommand(command);
}

export default devTools;
