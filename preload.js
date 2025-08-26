const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDownloadFolder: () => ipcRenderer.invoke('select-download-folder'),
  downloadVideo: (data) => ipcRenderer.invoke('download-video', data),
  getVideoInfo: (url) => ipcRenderer.invoke('get-video-info', url),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', callback);
  }
});