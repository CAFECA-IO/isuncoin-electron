const { ipcRenderer } = require('electron');
const download = require('electron-dl');

function startMining() {
  const errorElement = document.getElementById('error');
  const address = document.getElementById('address').value;
  if (!isValidEthereumAddress(address)) {
    errorElement.textContent = '請輸入有效的陽光幣地址 (如: 0xCAFECA05eB2686e2D7e78449F35d8F6D2Faee174)';
    return;
  }

  errorElement.textContent = ''; // 清空錯誤訊息

  ipcRenderer.send('start-mining', address);

  ipcRenderer.on('isuncoin-stdout', (event, data) => {
    writeToLog(data);
  });

  ipcRenderer.on('isuncoin-stderr', (event, data) => {
    writeToLog(data);
  });

  ipcRenderer.on('isuncoin-close', (event, code) => {
    writeToLog(`iSunCoin 意外關閉: ${code}`);
  });
}

function writeToLog(message) {
  const logTextarea = document.getElementById('log');
  logTextarea.value += message + '\n';
  logTextarea.scrollTop = logTextarea.scrollHeight; // 自動捲動到最後一行
}

function isValidEthereumAddress(address) {
  return /^(0x)?[0-9a-fA-F]{40}$/.test(address);
}