import { app, BrowserWindow, ipcMain, protocol, net, Tray, nativeImage, Menu, shell } from 'electron';
import * as path from 'path';

import * as fs from 'fs';
import { spawn, execSync } from 'child_process';
import * as si from 'systeminformation';
import { registerIsuncoinHandlers } from '@/handlers/isuncoin';
import { registerDockerHandlers, stopAllServices, resetService } from '@/handlers/docker';
import { registerGatewayHandlers } from '@/handlers/gateway';

// Info: (20251215 - AI) Binary Resolution Helper
const resolveExtraBinary = (name: string): string => {
  let resourcesPath = path.join(__dirname, '../extra');
  if (app.isPackaged) {
    resourcesPath = path.join(process.resourcesPath, 'extra');
  }
  const platform = process.platform;
  let binaryName = name;
  if (platform === 'win32') {
    binaryName = `${name}.exe`;
  }
  const fullPath = path.join(resourcesPath, binaryName);

  // Ensure executable on mac/linux
  if (platform !== 'win32') {
    try {
      fs.chmodSync(fullPath, '755');
    } catch { }
  }
  return fullPath;
};


// Global reference to dockerd process




let appTray: Tray | null = null;

// Register privileged scheme for FIDO2/Secure Context
// https is already privileged, so we don't need to register it manually for 'secure' status.

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    title: 'iSunCloud',
    icon: path.join(__dirname, '../src/assets/icon.png')
  });

  // Auto-grant permissions for local device access if needed
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL();
    if (url.startsWith('https://isuncloud.local/')) {
      return callback(true);
    }
    callback(false);
  });

  // Apply a custom certificate verification handler for our internal domain if needed
  mainWindow.webContents.session.setCertificateVerifyProc((request, callback) => {
    if (request.hostname === 'isuncloud.local') {
      callback(0); // Success
    } else {
      callback(-3); // Use default verification
    }
  });

  // Serve via intercepted HTTPS to ensure Secure Context for WebAuthn and consistency
  mainWindow.loadURL('https://isuncloud.local/index.html');
}

// Info: (20251215 - AI) Forward Console Logs to Renderer
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendToRenderer = (level: string, args: any[]) => {
  const wins = BrowserWindow.getAllWindows();
  wins.forEach(w => {
    try {
      w.webContents.send('debug-log-message', {
        timestamp: new Date().toLocaleTimeString(),
        level,
        source: 'main',
        args
      });
    } catch {
      // Window might be destroyed
    }
  });
};

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

console.log = (...args) => {
  originalConsole.log(...args);
  sendToRenderer('log', args);
};

console.warn = (...args) => {
  originalConsole.warn(...args);
  sendToRenderer('warn', args);
};

console.error = (...args) => {
  originalConsole.error(...args);
  sendToRenderer('error', args);
};

console.info = (...args) => {
  originalConsole.info(...args);
  sendToRenderer('info', args);
};

console.debug = (...args) => {
  originalConsole.debug(...args);
  sendToRenderer('debug', args);
};

process.on('uncaughtException', (error) => {
  originalConsole.error('Uncaught Exception:', error);
  sendToRenderer('error', ['Uncaught Exception:', error.message, error.stack]);
});

process.on('unhandledRejection', (reason) => {
  originalConsole.error('Unhandled Rejection:', reason);
  sendToRenderer('error', ['Unhandled Rejection:', reason]);
});

app.whenReady().then(async () => {
  let servicesRoot = path.join(__dirname, '..', 'services');
  if (app.isPackaged) {
    servicesRoot = path.join(process.resourcesPath, 'services');
  }




  // Register Service Handlers
  registerIsuncoinHandlers(ipcMain, servicesRoot, resolveExtraBinary('docker'));
  registerDockerHandlers(ipcMain, servicesRoot, resolveExtraBinary('docker'));
  registerGatewayHandlers(ipcMain);

  ipcMain.handle('docker-reset', async (_event, serviceName) => {
    return await resetService(serviceName, servicesRoot, resolveExtraBinary('docker'));
  });

  // Ollama Chat
  const { handleOllamaChat } = await import('@/handlers/ollama');
  ipcMain.on('ollama-chat', handleOllamaChat);



  ipcMain.handle('quit-app', () => {
    app.quit();
  });

  // Info: (20251214 - AI) Stats History Buffer
  // 24 hours * 60 minutes = 1440 points
  const MAX_HISTORY_POINTS = 1440;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statsHistory: any[] = [];

  const collectStats = async () => {
    try {
      const cpuLoad = await si.currentLoad();
      const mem = await si.mem();
      const network = await si.networkStats();
      const fsData = await si.fsSize();
      // Info: (20251214 - AI) GPU Load is experimental/platform dependent in systeminformation
      // Using placeholder for GPU for now as it's unreliable without specific tools suitable for Electron/Mac
      const gpuLoad = 0;

      // Simple aggregation or picking primary interface/disk
      const netRx = network.length > 0 ? network[0].rx_sec : 0;
      const netTx = network.length > 0 ? network[0].tx_sec : 0;
      const diskUsed = fsData.length > 0 ? fsData[0].use : 0;

      const stats = {
        cpu: cpuLoad.currentLoad,
        ram: (mem.active / mem.total) * 100,
        gpu: gpuLoad,
        disk: diskUsed,
        networkRx: netRx,
        networkTx: netTx,
        timestamp: Date.now()
      };

      statsHistory.push(stats);
      if (statsHistory.length > MAX_HISTORY_POINTS) {
        statsHistory.shift();
      }
      return stats;
    } catch (error) {
      console.error("Error collecting system stats:", error);
      return null;
    }
  };

  // Start collection loop (every 60s for history)
  setInterval(collectStats, 60 * 1000);
  collectStats(); // Initial collect

  ipcMain.handle('get-system-stats', async () => {
    // Return fresh stats
    return await collectStats();
  });

  ipcMain.handle('get-stats-history', async () => {
    return statsHistory;
  });

  ipcMain.handle('open-external', async (event, url) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('check-url', async (event, url) => {
    try {
      const response = await net.fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  });










  // Handle Custom Protocol (HTTPS Interception)
  protocol.handle('https', (req) => {
    const url = req.url;
    if (url.startsWith('https://isuncloud.local/')) {
      const pathName = url.replace('https://isuncloud.local/', '').split('?')[0];
      const filename = pathName === '' || pathName === '/' ? 'index.html' : pathName;
      // Basic protection against directory traversal (though unlikely with this logic)
      if (filename.includes('..')) return new Response('Not Found', { status: 404 });

      const filePath = path.join(__dirname, '../dist_renderer', filename);
      return net.fetch('file://' + filePath);
    }
    // Passthrough other HTTPS requests
    return net.fetch(req, { bypassCustomProtocolHandlers: true });
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Tray Logic
  const initTray = async () => {
    const iconPath = path.join(__dirname, '../src/assets/icon.png');
    // Resize for tray if needed, but nativeImage handles high-dpi mostly. 
    // Ideally use a smaller template image for macOS, but original icon is okay for MVP.
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

    appTray = new Tray(trayIcon);
    appTray.setToolTip('iSunCloud Gateway');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Dashboard', click: () => {
          const wins = BrowserWindow.getAllWindows();
          if (wins.length === 0) {
            createWindow();
          } else {
            wins[0].show();
            wins[0].focus();
          }
        }
      },
      { type: 'separator' },
      { label: 'Quit', role: 'quit' }
    ]);
    appTray.setContextMenu(contextMenu); // Optional: if we want right-click menu. User asked for "Click to launch", usually left click.

    appTray.on('click', () => {
      const wins = BrowserWindow.getAllWindows();
      if (wins.length === 0) {
        createWindow();
      } else {
        wins[0].show();
        wins[0].focus();
      }
    });

    // Initial Update
    updateFlopsCache();
    // Poll every 5 minutes
    setInterval(updateFlopsCache, 5 * 60 * 1000);
  };

  initTray();
});

// Helper for FLOPs
// --------------------------------------------------------------------------
// Centralized FLOPs Manager
// --------------------------------------------------------------------------
let flopsCache: { success: boolean, data?: string, error?: string } | null = null;
let flopsUpdatePromise: Promise<void> | null = null;

const runFlopsBenchmark = async () => {
  return new Promise<{ success: boolean, data?: string, error?: string }>((resolve) => {
    let binaryPath = path.join(__dirname, '../extra/isuncoin');
    if (process.env.NODE_ENV === 'production' || app.isPackaged) {
      binaryPath = path.join(process.resourcesPath, 'extra/isuncoin');
    }

    if (process.platform !== 'win32') {
      try {
        execSync(`chmod +x "${binaryPath}"`);
      } catch { }
    }

    const processProc = spawn(binaryPath, ['flops']);
    let output = '';
    let error = '';

    processProc.stdout.on('data', (data) => output += data.toString());
    processProc.stderr.on('data', (data) => error += data.toString());

    processProc.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: error || `Exited with ${code}` });
      } else {
        resolve({ success: true, data: output.trim() });
      }
    });
    processProc.on('error', (err) => resolve({ success: false, error: err.message }));
  });
};

const updateFlopsCache = async () => {
  // If already updating, join that promise
  if (flopsUpdatePromise) return flopsUpdatePromise;

  flopsUpdatePromise = (async () => {
    try {
      const result = await runFlopsBenchmark();
      flopsCache = result;

      // Update Tray Tooltip immediately
      if (appTray && result.success && result.data) {
        const match = result.data.match(/Total Compute Power:\s*([\d.]+)\s*TFLOPS/);
        const flops = match ? `${match[1]} TFLOPS` : 'Unknown';
        appTray.setToolTip(`Computing Power: ${flops}`);
      }
    } finally {
      flopsUpdatePromise = null;
    }
  })();
  return flopsUpdatePromise;
};

// Updated: get-flops returns cached value or triggers update if empty
ipcMain.handle('get-flops', async () => {
  if (flopsCache) return flopsCache;
  await updateFlopsCache();
  return flopsCache;
});



app.on('before-quit', async (event) => {
  event.preventDefault(); // Prevent default quit to allow async cleanup

  console.log('Cleaning up services before quit...');
  const servicesRoot = path.join(__dirname, '..', 'services');

  // Info: (20251215 - AI) Stop dockerd (if managed, but we just want to stop services now)

  try {
    // Info: (20251219 - AI) Use docker-compose down to clean up
    await stopAllServices(servicesRoot, resolveExtraBinary('docker'));
  } catch (error) {
    console.error('Error during cleanup:', error);
  }

  app.exit(0); // Proceed with quit
});

app.on('window-all-closed', function () {
  // Do not quit on Mac when windows close, keep tray active
  // if (process.platform !== 'darwin') app.quit(); 
  // User wants tray persistent, so we shouldn't quit even on non-mac?
  // Standard electron behavior for tray apps is usually to stay open.
});
