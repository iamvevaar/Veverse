import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import electronSquirrelStartup from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (electronSquirrelStartup) {
  app.quit();
}

// We'll initialize this after app is ready
let ffmpegService;

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Initialize ffmpeg service after app is ready
  // Using dynamic import for CommonJS module in ESM context
  const ffmpegModule = await import('./services/ffmpegService.js');
  ffmpegService = ffmpegModule.default || ffmpegModule;
  
  // Register all IPC handlers after app is ready
  registerIPCHandlers();
  
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Function to register all IPC handlers
function registerIPCHandlers() {
  // Dialog handlers
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Videos', extensions: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      return null;
    }
    
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:saveFile', async (event, defaultName) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [
        { name: 'Videos', extensions: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv'] },
        { name: 'Audio', extensions: ['mp3', 'wav', 'aac', 'm4a'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      return null;
    }
    
    return result.filePath;
  });

  // FFmpeg handlers
  ipcMain.handle('ffmpeg:getMetadata', async (event, filePath) => {
    try {
      return await ffmpegService.getMetadata(filePath);
    } catch (error) {
      throw new Error(`Failed to get metadata: ${error.message}`);
    }
  });

  ipcMain.handle('ffmpeg:compressVideo', async (event, { inputPath, outputPath, options }) => {
    try {
      return await ffmpegService.compressVideo(inputPath, outputPath, {
        ...options,
        onProgress: (progress) => {
          event.sender.send('ffmpeg:progress', progress);
        }
      });
    } catch (error) {
      throw new Error(`Compression failed: ${error.message}`);
    }
  });

  ipcMain.handle('ffmpeg:convertVideo', async (event, { inputPath, outputPath, options }) => {
    try {
      return await ffmpegService.convertVideo(inputPath, outputPath, {
        ...options,
        onProgress: (progress) => {
          event.sender.send('ffmpeg:progress', progress);
        }
      });
    } catch (error) {
      throw new Error(`Conversion failed: ${error.message}`);
    }
  });

  ipcMain.handle('ffmpeg:extractAudio', async (event, { inputPath, outputPath, options }) => {
    try {
      return await ffmpegService.extractAudio(inputPath, outputPath, {
        ...options,
        onProgress: (progress) => {
          event.sender.send('ffmpeg:progress', progress);
        }
      });
    } catch (error) {
      throw new Error(`Audio extraction failed: ${error.message}`);
    }
  });

  ipcMain.handle('ffmpeg:cancelProcess', async (event, processId) => {
    return ffmpegService.cancelProcess(processId);
  });
}