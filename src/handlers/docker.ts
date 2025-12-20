import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, execSync } from 'child_process';
import { getIsuncoinRunArgs, configureIsuncoinPostStart } from '@/handlers/isuncoin';

// Info: (20251219 - AI) Helper: Get defined services from docker-compose
const getDefinedComposeServices = async (servicesPath: string, dockerBin: string): Promise<string[]> => {
  return new Promise((resolve) => {
    const process = spawn(dockerBin, ['compose', 'config', '--services'], {
      cwd: servicesPath
    });
    let output = '';
    process.stdout.on('data', (d) => output += d.toString());
    process.on('close', (code) => {
      if (code === 0) {
        resolve(output.split('\n').map(s => s.trim()).filter(s => s.length > 0));
      } else {
        resolve([]);
      }
    });
    process.on('error', () => resolve([]));
  });
};

// Info: (20251219 - AI) Deploy Service Logic extracted for reuse
export const deployService = async (serviceName: string, servicesPath: string, dockerBin: string) => {
  // Info: (20251219 - AI) Check if service is defined in docker-compose
  const definedServices = await getDefinedComposeServices(servicesPath, dockerBin);
  if (!definedServices.includes(serviceName.toLowerCase())) {
    return { success: true, skipped: true };
  }

  const servicePath = path.join(servicesPath, serviceName);

  // Check if Dockerfile exists
  const dockerfilePath = path.join(servicePath, 'Dockerfile');
  try {
    await fs.promises.access(dockerfilePath);
  } catch {
    console.log(`[${serviceName}] No Dockerfile, assuming image-based deployment.`);
  }

  console.log(`[${serviceName}] Deploying using docker-compose...`);

  return new Promise<{ success: boolean, error?: string, skipped?: boolean }>(async (resolve) => {
    // Info: (20251219 - AI) Prepare Environment Logic
    const env = { ...process.env };

    if (serviceName === 'iSunCoin') {
      const handlerArgs = await getIsuncoinRunArgs(servicesPath);
      if (handlerArgs.length > 0) {
        env.ISUNCOIN_CMD = handlerArgs.join(' ');
      }
    }

    if (serviceName.toLowerCase() === 'tidebit') {
      const configPath = path.join(servicesPath, serviceName, 'config.json');
      try {
        const content = await fs.promises.readFile(configPath, 'utf-8');
        const config = JSON.parse(content);
        if (config.branch) {
          env.TIDEBIT_BRANCH = config.branch;
        }
      } catch { /* config might not exist yet */ }
    }

    if (serviceName.toLowerCase() === 'ollama') {
      const configPath = path.join(servicesPath, serviceName, 'config.json');
      try {
        const content = await fs.promises.readFile(configPath, 'utf-8');
        const config = JSON.parse(content);
        if (config.model) {
          env.OLLAMA_MODEL = config.model;
        }
      } catch { /* config might not exist yet */ }
    }

    // Info: (20251219 - AI) Gateway Env Hook
    if (serviceName.toLowerCase() === 'gateway') {
      const { getGatewayRunArgs } = await import('@/handlers/gateway');
      const gatewayEnv = await getGatewayRunArgs(servicesPath);
      Object.assign(env, gatewayEnv);
    }

    const composeArgs = ['compose', 'up', '-d', '--build', serviceName.toLowerCase()];

    console.log(`[${serviceName}] Executing: docker ${composeArgs.join(' ')}`);

    const runProcess = spawn(dockerBin, composeArgs, {
      cwd: servicesPath,
      env
    });

    runProcess.stdout.on('data', (d) => console.log(`[${serviceName}] ${d}`));
    runProcess.stderr.on('data', (d) => console.error(`[${serviceName}] ${d}`));

    runProcess.on('close', async (code) => {
      if (code === 0) {
        console.log(`[${serviceName}] Service deployed successfully.`);
        if (serviceName === 'iSunCoin') {
          await configureIsuncoinPostStart(servicesPath, dockerBin);
        }
        resolve({ success: true });
      } else {
        console.error(`[${serviceName}] Deployment failed with code ${code}.`);
        resolve({ success: false, error: 'Docker compose failed' });
      }
    });
    runProcess.on('error', (err) => {
      console.error(`[${serviceName}] Spawn error:`, err);
      resolve({ success: false, error: err.message })
    });
  });
};

export const resetService = async (serviceName: string, servicesPath: string, dockerBin: string): Promise<{ success: boolean; error?: string }> => {
  const composeService = serviceName.toLowerCase();

  // 1. Get Image ID (before removal)
  let imageId = '';
  try {
    // Info: (20251219 - AI) capture image ID to remove it later
    const output = execSync(`"${dockerBin}" compose images -q ${composeService}`, { cwd: servicesPath }).toString().trim();
    if (output) {
      // If multiple lines (unexpected for single service but possible), take unique ones
      imageId = output.split('\n')[0].trim();
    }
    console.log(`[${serviceName}] Found image: ${imageId}`);
  } catch {
    console.log(`[${serviceName}] Could not determine image (might not exist yet).`);
  }

  // 2. Stop and Remove Container + Volumes
  try {
    console.log(`[${serviceName}] Resetting: Stopping and removing...`);
    // 'rm -f -s -v': force, stop if running, remove anonymous volumes
    const cmd = `"${dockerBin}" compose rm -f -s -v ${composeService}`;
    execSync(cmd, { cwd: servicesPath });
    console.log(`[${serviceName}] Service removed.`);
  } catch (error) {
    console.warn(`[${serviceName}] Warning during reset removal: ${(error as Error).message}`);
  }

  // 3. Remove Image if found
  if (imageId) {
    try {
      console.log(`[${serviceName}] Removing image ${imageId}...`);
      const cmd = `"${dockerBin}" rmi ${imageId}`;
      execSync(cmd, { cwd: servicesPath });
      console.log(`[${serviceName}] Image ${imageId} removed.`);
    } catch (error) {
      console.warn(`[${serviceName}] Warning: Failed to remove image ${imageId}: ${(error as Error).message}`);
    }
  }

  console.log(`[${serviceName}] Redeploying...`);
  return await deployService(serviceName, servicesPath, dockerBin);
};

export const registerDockerHandlers = (ipc: typeof ipcMain, servicesPath: string, dockerBin: string) => {
  ipc.handle('check-docker', async () => {
    return new Promise((resolve) => {
      const versionProcess = spawn(dockerBin, ['--version']);
      let versionCheckSuccess = false;

      versionProcess.on('close', (code) => {
        versionCheckSuccess = code === 0;
        if (!versionCheckSuccess) {
          return resolve({ installed: false, running: false });
        }
        const infoProcess = spawn(dockerBin, ['info']);
        infoProcess.on('close', (infoCode) => {
          resolve({ installed: true, running: infoCode === 0 });
        });
        infoProcess.on('error', () => {
          resolve({ installed: true, running: false });
        });
      });

      versionProcess.on('error', () => {
        resolve({ installed: false, running: false });
      });
    });
  });

  ipc.handle('get-docker-containers', async () => {
    return new Promise((resolve) => {
      const process = spawn(dockerBin, ['ps', '-a', '--format', '{{.ID}}::{{.Image}}::{{.Names}}::{{.Status}}::{{.Ports}}']);
      let data = '';
      process.stdout.on('data', (chunk) => { data += chunk.toString(); });
      process.on('close', (code) => {
        if (code !== 0) { resolve([]); return; }
        const lines = data.split('\n').filter(line => line.trim() !== '');
        const containers = lines.map(line => {
          const [id, image, names, status, ports] = line.split('::');
          return { id, image, names, status, ports };
        });
        resolve(containers);
      });
      process.on('error', () => { resolve([]); });
    });
  });

  ipc.handle('get-defined-services', async () => {
    // Info: (20251219 - AI) Scan services/ directory for available service definitions
    try {
      const files = await fs.promises.readdir(servicesPath, { withFileTypes: true });
      const serviceNames = files
        .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
        .map(dirent => dirent.name);

      const servicesWithStatus = await Promise.all(serviceNames.map(async (name) => {
        const dockerfilePath = path.join(servicesPath, name, 'Dockerfile');
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
        return a.name.localeCompare(b.name);
      });

      return servicesWithStatus.map(s => s.name);
    } catch (error) {
      console.error('[Docker Handler] Error reading services directory:', error);
      return [];
    }
  });

  ipc.handle('docker-start', async (_event, id) => {
    console.log(`[Docker Handler] Starting container ${id}...`);
    return new Promise((resolve) => {
      const process = spawn(dockerBin, ['start', id]);
      process.on('close', (code) => {
        console.log(`[Docker Handler] Container ${id} start result: ${code}`);
        resolve(code === 0)
      });
      process.on('error', (err) => {
        console.error(`[Docker Handler] Failed to start container ${id}:`, err);
        resolve(false)
      });
    });
  });

  ipc.handle('docker-stop', async (_event, id) => {
    console.log(`[Docker Handler] Stopping container ${id}...`);
    return new Promise((resolve) => {
      const process = spawn(dockerBin, ['stop', id]);
      process.on('close', (code) => {
        console.log(`[Docker Handler] Container ${id} stop result: ${code}`);
        resolve(code === 0)
      });
      process.on('error', (err) => {
        console.error(`[Docker Handler] Failed to stop container ${id}:`, err);
        resolve(false)
      });
    });
  });

  ipc.handle('get-service-config', async (_event, serviceName) => {
    try {
      const configPath = path.join(servicesPath, serviceName, 'config.json');
      try {
        await fs.promises.access(configPath);
      } catch {
        return {};
      }
      const content = await fs.promises.readFile(configPath, 'utf-8');
      try {
        return JSON.parse(content);
      } catch (e) {
        console.error(`[Docker Handler] Failed to parse config for ${serviceName}:`, e);
        return {};
      }
    } catch (e) {
      console.error(`[Docker Handler] Failed to read config for ${serviceName}:`, e);
      return {};
    }
  });

  ipc.handle('save-service-config', async (_event, serviceName, config) => {
    try {
      const configPath = path.join(servicesPath, serviceName, 'config.json');
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

      console.log(`[${serviceName}] Config saved, triggering redeploy...`);
      const result = await deployService(serviceName, servicesPath, dockerBin);

      if (!result.success) {
        return { success: true, warning: 'Config saved but redeploy failed: ' + result.error };
      }
      return { success: true };
    } catch (e) {
      console.error(`[Docker Handler] Failed to save config for ${serviceName}:`, e);
      return { success: false, error: (e as Error).message };
    }
  });

  ipc.handle('docker-deploy', async (_event, serviceName) => {
    return await deployService(serviceName, servicesPath, dockerBin);
  });
};

export const stopAllServices = async (servicesPath: string, dockerBin: string) => {
  console.log('[Docker Handler] Stopping all services via docker-compose down...');
  return new Promise<void>((resolve) => {
    const process = spawn(dockerBin, ['compose', 'down'], {
      cwd: servicesPath
    });

    process.on('close', (code) => {
      console.log(`[Docker Handler] docker-compose down finished with core ${code}`);
      resolve();
    });

    process.on('error', (err) => {
      console.error('[Docker Handler] Failed to run docker-compose down:', err);
      resolve();
    });
  });
};
