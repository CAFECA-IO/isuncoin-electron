import { app, BrowserWindow, ipcMain, protocol, net, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import * as si from 'systeminformation';

let appTray: Tray | null = null;

// Register privileged scheme for FIDO2/Secure Context
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true } }
]);

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

  // Serve via custom protocol to ensure Secure Context for WebAuthn
  mainWindow.loadURL('app://./index.html');
}

app.whenReady().then(() => {
  ipcMain.handle('get-flops', async () => {
    return await runFlopsBenchmark();
  });

  ipcMain.handle('check-docker', async () => {
    return new Promise((resolve) => {
      const process = spawn('docker', ['--version']);
      process.on('close', (code) => {
        resolve(code === 0);
      });
      process.on('error', () => {
        resolve(false);
      });
    });
  });

  // Info: (20251214 - AI) Stats History Buffer
  // 24 hours * 60 minutes = 1440 points
  const MAX_HISTORY_POINTS = 1440;
  const statsHistory: any[] = [];

  const collectStats = async () => {
    try {
      const cpuLoad = await si.currentLoad();
      const mem = await si.mem();
      const network = await si.networkStats();
      const fs = await si.fsSize();
      // Info: (20251214 - AI) GPU Load is experimental/platform dependent in systeminformation
      // const graphics = await si.graphics();
      // const gpuLoad = graphics.controllers.length > 0 ? (graphics.controllers[0].utilizationGpu || 0) : 0;
      // Using placeholder for GPU for now as it's unreliable without specific tools suitable for Electron/Mac
      const gpuLoad = 0;

      // Simple aggregation or picking primary interface/disk
      const netRx = network.length > 0 ? network[0].rx_sec : 0;
      const netTx = network.length > 0 ? network[0].tx_sec : 0;
      const diskUsed = fs.length > 0 ? fs[0].use : 0;

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

  // Start collection loop (every 60s for history, but frontend might poll faster for realtime)
  // For simplicity, we'll collect every 60s for history. 
  // Realtime requests from frontend will get fresh data + we save it if enough time passed?
  // Let's separate history collection from realtime check or just rely on the buffer for history 
  // and realtime calls for instant.
  setInterval(collectStats, 60 * 1000);
  collectStats(); // Initial collect

  ipcMain.handle('get-system-stats', async () => {
    // Return fresh stats
    return await collectStats();
  });

  ipcMain.handle('get-stats-history', async () => {
    return statsHistory;
  });

  ipcMain.handle('get-docker-containers', async () => {
    return new Promise((resolve) => {
      // Info: (20251213 - AI) Output format: ID::Image::Names::Status::Ports
      const process = spawn('docker', ['ps', '-a', '--format', '{{.ID}}::{{.Image}}::{{.Names}}::{{.Status}}::{{.Ports}}']);
      let data = '';

      process.stdout.on('data', (chunk) => {
        data += chunk.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          resolve([]);
          return;
        }
        const lines = data.split('\n').filter(line => line.trim() !== '');
        const containers = lines.map(line => {
          const [id, image, names, status, ports] = line.split('::');
          return { id, image, names, status, ports };
        });
        resolve(containers);
      });

      process.on('error', () => {
        resolve([]);
      });
    });
  });

  ipcMain.handle('get-defined-services', async () => {
    // Info: (20251213 - AI) Scan services/ directory for available service definitions
    const servicesPath = path.join(__dirname, '..', 'services');
    try {
      const files: string[] = await fs.promises.readdir(servicesPath);
      // Info: (20251213 - AI) Return file names as service names (ignoring hidden files)
      return files.filter((f: string) => !f.startsWith('.'));
    } catch (error) {
      console.error('Error reading services directory:', error);
      return [];
    }
  });

  ipcMain.handle('docker-start', async (_event, id) => {
    return new Promise((resolve) => {
      const process = spawn('docker', ['start', id]);
      process.on('close', (code) => resolve(code === 0));
      process.on('error', () => resolve(false));
    });
  });

  ipcMain.handle('docker-stop', async (_event, id) => {
    return new Promise((resolve) => {
      const process = spawn('docker', ['stop', id]);
      process.on('close', (code) => resolve(code === 0));
      process.on('error', () => resolve(false));
    });
  });



  ipcMain.handle('get-isuncoin-version', async () => {
    try {
      // Info: (20251214 - AI) Resolve binary path.
      // In Dev: dist/../extra/isuncoin -> root/extra/isuncoin
      // In Prod: resources/extra/isuncoin
      let binaryPath = path.join(__dirname, '../extra/isuncoin');
      if (process.env.NODE_ENV === 'production' || app.isPackaged) {
        binaryPath = path.join(process.resourcesPath, 'extra/isuncoin');
      }

      // Info: (20251214 - AI) Exec command
      // On Mac/Linux make sure it's executable
      if (process.platform !== 'win32') {
        try {
          require('child_process').execSync(`chmod +x "${binaryPath}"`);
        } catch (e) { /* ignore if already executable or permission denied */ }
      }

      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec(`"${binaryPath}" version`, (error: any, stdout: string) => {
          if (error) {
            console.error('Failed to get version:', error);
            resolve('Unknown');
            return;
          }
          // Info: (20251214 - AI) Extract "Version: 1.12.3-stable" -> "v1.12.3-stable"
          const versionLine = stdout.split('\n').find(line => line.startsWith('Version:'));
          if (versionLine) {
            const version = versionLine.split(':')[1]?.trim();
            if (version) {
              resolve(`v${version}`);
              return;
            }
          }
          resolve(stdout.trim());
        });
      });
    } catch (e) {
      console.error('Version check error:', e);
      return 'Error';
    }
  });

  ipcMain.handle('docker-deploy', async (_event, serviceName) => {
    // Info: (20251213 - AI) 1. Build Image
    // Info: (20251213 - AI) docker build -f services/<name> -t <name> .
    const buildSuccess = await new Promise<boolean>((resolve) => {
      const dockerfile = path.join(__dirname, '..', 'services', serviceName);
      // Info: (20251213 - AI) Context is root (..)
      const buildCtx = path.join(__dirname, '..');
      const process = spawn('docker', ['build', '-f', dockerfile, '-t', serviceName, buildCtx]);
      process.on('close', (code) => resolve(code === 0));
      process.on('error', () => resolve(false));
    });

    if (!buildSuccess) return { success: false, error: 'Build failed' };

    // Info: (20251213 - AI) 2. Run Container
    // Info: (20251213 - AI) docker run -d --name <name> <name>
    return new Promise((resolve) => {
      // Info: (20251213 - AI) Remove existing container with same name if exists (optional but good for dev)
      spawn('docker', ['rm', '-f', serviceName]).on('close', () => {
        const runProcess = spawn('docker', ['run', '-d', '--name', serviceName, serviceName]);
        runProcess.on('close', (code) => resolve({ success: code === 0 }));
        runProcess.on('error', (err) => resolve({ success: false, error: err.message }));
      });
    });
  });

  // Handle Custom Protocol
  protocol.handle('app', (req) => {
    const url = req.url.replace('app://./', '').split('?')[0]; // Strip scheme
    // If it's the root index.html
    const filename = url === 'index.html' ? 'index.html' : url;
    const filePath = path.join(__dirname, '../dist_renderer', filename);

    return net.fetch('file://' + filePath);
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
    // appTray.setContextMenu(contextMenu); // Optional: if we want right-click menu. User asked for "Click to launch", usually left click.

    appTray.on('click', () => {
      const wins = BrowserWindow.getAllWindows();
      if (wins.length === 0) {
        createWindow();
      } else {
        wins[0].show();
        wins[0].focus();
      }
    });

    // Polling for Tooltip
    const updateTooltip = async () => {
      const result = await runFlopsBenchmark();
      if (result.success && result.data) {
        const match = result.data.match(/Total Compute Power:\s*([\d.]+)\s*TFLOPS/);
        const flops = match ? `${match[1]} TFLOPS` : 'Unknown';
        appTray?.setToolTip(`Computing Power: ${flops}`);
      }
    };

    updateTooltip();
    setInterval(updateTooltip, 60000); // Update every minute
  };

  initTray();
});

// Helper for FLOPs
const runFlopsBenchmark = async () => {
  return new Promise<{ success: boolean, data?: string, error?: string }>((resolve) => {
    let binaryPath = path.join(__dirname, '../extra/isuncoin');
    if (process.env.NODE_ENV === 'production' || app.isPackaged) {
      binaryPath = path.join(process.resourcesPath, 'extra/isuncoin');
    }

    if (process.platform !== 'win32') {
      try {
        require('child_process').execSync(`chmod +x "${binaryPath}"`);
      } catch (e) { }
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

app.on('window-all-closed', function () {
  // Do not quit on Mac when windows close, keep tray active
  // if (process.platform !== 'darwin') app.quit(); 
  // User wants tray persistent, so we shouldn't quit even on non-mac?
  // Standard electron behavior for tray apps is usually to stay open.
});
