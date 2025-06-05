// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // FFmpeg operations
  getMetadata: (filePath) => ipcRenderer.invoke('ffmpeg:getMetadata', filePath),
  compressVideo: (params) => ipcRenderer.invoke('ffmpeg:compressVideo', params),
  convertVideo: (params) => ipcRenderer.invoke('ffmpeg:convertVideo', params),
  extractAudio: (params) => ipcRenderer.invoke('ffmpeg:extractAudio', params),
  cancelProcess: (processId) => ipcRenderer.invoke('ffmpeg:cancelProcess', processId),
  
  // Dialog operations
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultName) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  
  // Progress listener
  onProgress: (callback) => {
    ipcRenderer.on('ffmpeg:progress', (event, progress) => callback(progress));
  },
  
  // Cleanup
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('ffmpeg:progress');
  }
});