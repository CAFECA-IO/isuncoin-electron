import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const SERVICE_NAME = 'Gateway'; // Matches directory name services/Gateway

export const registerGatewayHandlers = (ipc: typeof ipcMain) => {
  // Placeholder for future Gateway specific IPC handlers
  // e.g. reload config, get status, etc.
  ipc.handle('reload-gateway', async () => {
    // Logic to reload gateway
    console.log('[Gateway Handler] Reload requested (not implemented)');
    return true;
  });
};

export const getGatewayRunArgs = async (servicesPath: string): Promise<Record<string, string>> => {
  try {
    const configPath = path.join(servicesPath, SERVICE_NAME, 'config.json');
    try {
      await fs.promises.access(configPath);
    } catch {
      return {}; // No config file
    }

    const content = await fs.promises.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    const env: Record<string, string> = {};

    if (config.port) {
      env['GATEWAY_PORT'] = config.port.toString();
      console.log(`[Gateway Handler] Setting GATEWAY_PORT to ${config.port}`);
    }

    return env;
  } catch (e) {
    console.warn('[Gateway Handler] Failed to read config for run args:', e);
    return {};
  }
};

export const configureGatewayPostStart = async () => {
  // Post-start logic if needed
};
