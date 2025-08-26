const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const YTDlpWrap = require('yt-dlp-wrap').default;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 750,
    minWidth: 600,
    minHeight: 650,
    icon: path.join(__dirname, 'assets/icon.icns'), // Add when you have icon
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    show: false
  });

  mainWindow.loadFile('index.html');
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('select-download-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath: path.join(os.homedir(), 'Downloads')
  });
  
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('download-video', async (event, { url, format, quality, outputPath }) => {
  try {
    const ytDlp = new YTDlpWrap();
    
    let formatSelector;
    let outputTemplate;
    
    // Clean filename template to avoid special characters
    const cleanTemplate = '%(title).100s.%(ext)s';
    
    if (format === 'mp3') {
      formatSelector = 'bestaudio/best';
      outputTemplate = path.join(outputPath, cleanTemplate);
    } else {
      formatSelector = 'best[ext=mp4]/best';
      outputTemplate = path.join(outputPath, cleanTemplate);
    }

    const options = [
      url,
      '--format', formatSelector,
      '--output', outputTemplate,
      '--restrict-filenames' // Restrict to ASCII characters
    ];

    if (format === 'mp3') {
      options.push('--extract-audio');
      options.push('--audio-format', 'mp3');
      options.push('--audio-quality', quality || '320k');
    }

    const ytDlpProcess = ytDlp.exec(options);
    
    ytDlpProcess.on('progress', (progress) => {
      event.sender.send('download-progress', {
        percent: progress.percent,
        eta: progress.eta,
        speed: progress.speed
      });
    });

    ytDlpProcess.on('youtubeDL', (data) => {
      if (data.includes('[download]') && data.includes('%')) {
        const match = data.match(/(\d+(?:\.\d+)?)%/);
        if (match) {
          const percent = parseFloat(match[1]);
          event.sender.send('download-progress', { percent });
        }
      }
    });

    await ytDlpProcess;
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-video-info', async (event, url) => {
  try {
    const ytDlp = new YTDlpWrap();
    const info = await ytDlp.getVideoInfo(url);
    
    return {
      title: info.title || 'Ukjent tittel',
      duration: info.duration || 'Ukjent varighet',
      thumbnail: info.thumbnail || '',
      uploader: info.uploader || 'Ukjent kanal',
      success: true
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});