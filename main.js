const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let isuncoinProcess;
const homeDir = app.getPath('home');
const isuncoinPath = path.join(__dirname, '/../extra/', 'isuncoin');

/*
async function downloadIsuncoin() {
  mainWindow?.webContents.send('isuncoin-stdout', '初始化 iSunCoin 執行環境 ...');
  if (fs.existsSync(isuncoinPath)) {
    mainWindow?.webContents.send('isuncoin-stdout', 'iSunCoin 初始化完成');
    return;
  }
  return new Promise((resolve, reject) => {

    const isuncoinUrl = {
      darwin: 'https://isuncloud.com/download/latest/isuncoin-mac',
      linux: 'https://isuncloud.com/download/latest/isuncoin-linux',
      windows: 'https://isuncloud.com/download/latest/isuncoin-windows.exe',
    };

    const platform = process.platform;
    const url = isuncoinUrl[platform];

    progress(request(url), {
      throttle: 2000, // Throttle the progress event to 2000ms, defaults to 1000ms
      delay: 1000,    // Only start to emit after 1000ms delay, defaults to 0ms
      lengthHeader: 'x-transfer-length'  // Length header to use, defaults to content-length
    })
      .on('progress', function (state) {
        mainWindow?.webContents.send('isuncoin-stdout', `初始化進度: ${state.percent * 100}%`);
      })
      .on('error', function (err) {
        mainWindow?.webContents.send('isuncoin-stderr', err);
        reject(err);
      })
      .on('end', function () {
        mainWindow?.webContents.send('isuncoin-stdout', 'iSunCoin 初始化完成');
        resolve();
      })
      .pipe(fs.createWriteStream(isuncoinPath));
  });
}
*/

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
  });

  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => {
    if (isuncoinProcess) {
      isuncoinProcess.kill();
    }
    mainWindow = null;
    app.quit();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('start-mining', async (event, address) => {
  // get home directory
  const datadir = path.join(homeDir, 'isuncoin-miner');

  // console current directory
  mainWindow?.webContents.send('isuncoin-stdout', __dirname);

  try {
    fs.rmSync(datadir, { recursive: true });
  } catch (error) {}

  const command = `${isuncoinPath} --datadir ${datadir} --mine --miner.threads=1 --miner.etherbase ${address}`;
  // check if isuncoinProcess is running
  if (!isuncoinProcess) {
    isuncoinProcess = spawn(command, [], { shell: true });
  }

  isuncoinProcess.stdout.on('data', (data) => {
    mainWindow?.webContents.send('isuncoin-stdout', data.toString());
  });

  isuncoinProcess.stderr.on('data', (data) => {
    mainWindow?.webContents.send('isuncoin-stderr', data.toString());
  });

  isuncoinProcess.on('close', (code) => {
    mainWindow?.webContents.send('isuncoin-close', code);
  });
});