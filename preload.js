const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("simpleSlideNative", {
  isNative: true,
  platform: process.platform,
  listProjects: () => ipcRenderer.invoke("projects:list"),
  saveProject: (payload) => ipcRenderer.invoke("projects:save", payload),
  loadProject: (id) => ipcRenderer.invoke("projects:load", id),
  renameProject: (payload) => ipcRenderer.invoke("projects:rename", payload),
  duplicateProject: (id) => ipcRenderer.invoke("projects:duplicate", id),
  deleteProject: (id) => ipcRenderer.invoke("projects:delete", id),
});
