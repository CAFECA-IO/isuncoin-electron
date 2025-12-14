import { app, BrowserWindow, ipcMain, protocol, net, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import * as si from 'systeminformation';
import { registerIsuncoinHandlers, getIsuncoinRunArgs, configureIsuncoinPostStart } from './handlers/isuncoin';

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

app.whenReady().then(() => {
  const servicesRoot = path.join(__dirname, '..', 'services');

  // Register Service Handlers
  registerIsuncoinHandlers(ipcMain, servicesRoot);

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
    try {
      const files: string[] = await fs.promises.readdir(servicesRoot);
      const serviceNames = files.filter((f: string) => !f.startsWith('.'));

      // Info: (20251214 - AI) Sort services: with Dockerfile first, then without (e.g. placeholders)
      const servicesWithStatus = await Promise.all(serviceNames.map(async (name) => {
        const dockerfilePath = path.join(servicesRoot, name, 'Dockerfile');
        let hasDockerfile = false;
        try {
          await fs.promises.access(dockerfilePath);
          hasDockerfile = true;
        } catch { }
        return { name, hasDockerfile };
      }));

      servicesWithStatus.sort((a, b) => {
        if (a.hasDockerfile && !b.hasDockerfile) return -1;
        if (!a.hasDockerfile && b.hasDockerfile) return 1;
        return a.name.localeCompare(b.name); // Alphabetical tie-break
      });

      return servicesWithStatus.map(s => s.name);
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

  // Old get-isuncoin-balance and get-isuncoin-version handlers removed (logic moved to handler)

  ipcMain.handle('get-service-config', async (_event, serviceName) => {
    try {
      const configPath = path.join(servicesRoot, serviceName, 'config.json');
      // check if exists
      try {
        await fs.promises.access(configPath);
      } catch {
        return {}; // Return empty if not exists
      }

      const content = await fs.promises.readFile(configPath, 'utf-8');
      try {
        return JSON.parse(content);
      } catch (e) {
        console.error(`Failed to parse config for ${serviceName}:`, e);
        return {};
      }
    } catch (e) {
      console.error(`Failed to read config for ${serviceName}:`, e);
      return {};
    }
  });

  // Helper: Deploy Service
  const deployService = async (serviceName: string) => {
    const servicePath = path.join(servicesRoot, serviceName);

    // Check if Dockerfile exists
    const dockerfilePath = path.join(servicePath, 'Dockerfile');
    try {
      await fs.promises.access(dockerfilePath);
    } catch {
      // Info: (20251214 - Luphia) Skip deployment if no Dockerfile
      return { success: false, error: 'No Dockerfile' };
    }

    let tag = `${serviceName.toLowerCase()}:latest`;

    console.log(`Building docker image for ${serviceName} with tag ${tag}...`);

    const buildSuccess = await new Promise<boolean>((resolve) => {
      // Command: docker build -t <tag> <path>
      const process = spawn('docker', ['build', '-t', tag, servicePath]);

      process.stdout.on('data', (data) => console.log(`[Docker Build] ${data}`));
      process.stderr.on('data', (data) => console.error(`[Docker Build Error] ${data}`));

      process.on('close', (code) => resolve(code === 0));
      process.on('error', (err) => {
        console.error('Docker build spawn error:', err);
        resolve(false);
      });
    });

    if (!buildSuccess) return { success: false, error: 'Build failed' };

    return new Promise<{ success: boolean, error?: string }>(async (resolve) => {
      // Remove existing container
      await new Promise<void>(res => {
        const rm = spawn('docker', ['rm', '-f', serviceName]);
        rm.on('close', () => res());
      });

      // Prepare Run Args
      const runArgs = ['run', '-d', '--name', serviceName, tag];

      // Info: (20251214 - AI) Apply Config via Handler for iSunCoin
      if (serviceName === 'iSunCoin') {
        const handlerArgs = await getIsuncoinRunArgs(servicesRoot);
        runArgs.push(...handlerArgs);
      }

      // Run new container
      const runProcess = spawn('docker', runArgs);
      runProcess.stdout.on('data', (d) => console.log(`[Docker Run] ${d}`));
      runProcess.stderr.on('data', (d) => console.error(`[Docker Run Err] ${d}`));

      runProcess.on('close', async (code) => {
        if (code === 0) {
          // Success
          // Info: (20251214 - AI) Post-start configuration via Handler for iSunCoin
          if (serviceName === 'iSunCoin') {
            await configureIsuncoinPostStart(servicesRoot);
          }
          resolve({ success: true });
        } else {
          resolve({ success: false, error: 'Docker run failed' });
        }
      });
      runProcess.on('error', (err) => resolve({ success: false, error: err.message }));
    });
  };

  ipcMain.handle('save-service-config', async (_event, serviceName, config) => {
    try {
      const configPath = path.join(servicesRoot, serviceName, 'config.json');
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

      // Info: (20251214 - AI) Trigger redeploy to apply new args
      console.log(`Config saved for ${serviceName}, triggering redeploy...`);
      const result = await deployService(serviceName);

      if (!result.success) {
        return { success: true, warning: 'Config saved but redeploy failed: ' + result.error };
      }
      return { success: true };
    } catch (e) {
      console.error(`Failed to save config for ${serviceName}:`, e);
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('docker-deploy', async (_event, serviceName) => {
    return await deployService(serviceName);
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
  const servicesPath = path.join(__dirname, '..', 'services');

  try {
    const files = await fs.promises.readdir(servicesPath);
    const services = files.filter((f: string) => !f.startsWith('.'));

    // Stop all services concurrently
    await Promise.all(services.map(async (serviceName: string) => {
      return new Promise<void>((resolve) => {
        console.log(`Stopping service: ${serviceName}...`);
        // Use shorter timeout for faster shutdown
        const process = spawn('docker', ['stop', '-t', '2', serviceName]);
        process.on('close', (code) => {
          console.log(`Service ${serviceName} stopped with code ${code}`);
          resolve();
        });
        process.on('error', (err) => {
          console.error(`Failed to stop ${serviceName}:`, err);
          resolve();
        });
      });
    }));
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
