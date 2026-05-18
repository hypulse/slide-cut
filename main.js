const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PROJECTS_DIRNAME = "projects";
const PROJECT_FILE = "project.json";
const META_FILE = "meta.json";
const DEFAULT_PROJECT_NAME = "Untitled";

function nowIso() {
  return new Date().toISOString();
}

function cleanProjectName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  return name || DEFAULT_PROJECT_NAME;
}

function isProjectId(value) {
  return typeof value === "string" && /^project-[a-zA-Z0-9-]+$/.test(value);
}

function projectsRoot() {
  return path.join(app.getPath("userData"), PROJECTS_DIRNAME);
}

function projectDir(projectId) {
  if (!isProjectId(projectId)) {
    throw new Error("Invalid project id");
  }
  return path.join(projectsRoot(), projectId);
}

async function ensureProjectsRoot() {
  await fs.mkdir(projectsRoot(), { recursive: true });
}

async function readJson(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text);
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

async function createProjectId() {
  await ensureProjectsRoot();
  for (let index = 0; index < 10; index += 1) {
    const id = `project-${crypto.randomUUID()}`;
    try {
      await fs.access(projectDir(id));
    } catch {
      return id;
    }
  }
  return `project-${Date.now()}`;
}

async function readProjectMeta(projectId) {
  const meta = await readJson(path.join(projectDir(projectId), META_FILE));
  return {
    id: projectId,
    name: cleanProjectName(meta.name),
    createdAt: typeof meta.createdAt === "string" ? meta.createdAt : nowIso(),
    updatedAt: typeof meta.updatedAt === "string" ? meta.updatedAt : nowIso(),
    thumbnail: typeof meta.thumbnail === "string" ? meta.thumbnail : "",
  };
}

async function listProjects() {
  await ensureProjectsRoot();
  const entries = await fs.readdir(projectsRoot(), { withFileTypes: true });
  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isProjectId(entry.name)) {
      continue;
    }
    try {
      projects.push(await readProjectMeta(entry.name));
    } catch {
      // Ignore incomplete project folders so a broken item does not block the library.
    }
  }
  projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return projects;
}

async function saveProject(_event, payload) {
  await ensureProjectsRoot();
  const requestedId = isProjectId(payload?.id) ? payload.id : "";
  const id = requestedId || (await createProjectId());
  const dir = projectDir(id);
  const metaPath = path.join(dir, META_FILE);
  const previousMeta = requestedId
    ? await readJson(metaPath).catch(() => null)
    : null;
  const timestamp = nowIso();
  const meta = {
    id,
    name: cleanProjectName(payload?.name),
    createdAt: typeof previousMeta?.createdAt === "string" ? previousMeta.createdAt : timestamp,
    updatedAt: timestamp,
    thumbnail: typeof payload?.thumbnail === "string" ? payload.thumbnail : previousMeta?.thumbnail || "",
  };

  if (!payload?.data || typeof payload.data !== "object") {
    throw new Error("Project data is missing");
  }

  await writeJson(path.join(dir, PROJECT_FILE), payload.data);
  await writeJson(metaPath, meta);
  return meta;
}

async function loadProject(_event, id) {
  const meta = await readProjectMeta(id);
  const data = await readJson(path.join(projectDir(id), PROJECT_FILE));
  return { meta, data };
}

async function renameProject(_event, payload) {
  const id = payload?.id;
  const dir = projectDir(id);
  const metaPath = path.join(dir, META_FILE);
  const meta = await readProjectMeta(id);
  const nextMeta = {
    ...meta,
    name: cleanProjectName(payload?.name),
    updatedAt: nowIso(),
  };
  await writeJson(metaPath, nextMeta);
  return nextMeta;
}

async function duplicateProject(_event, id) {
  const sourceMeta = await readProjectMeta(id);
  const sourceData = await readJson(path.join(projectDir(id), PROJECT_FILE));
  const timestamp = nowIso();
  const copyId = await createProjectId();
  const copyMeta = {
    ...sourceMeta,
    id: copyId,
    name: `${sourceMeta.name} Copy`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const dir = projectDir(copyId);
  await writeJson(path.join(dir, PROJECT_FILE), sourceData);
  await writeJson(path.join(dir, META_FILE), copyMeta);
  return copyMeta;
}

async function deleteProject(_event, id) {
  await fs.rm(projectDir(id), { recursive: true, force: true });
  return { id };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    title: "Simple Slide",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("projects:list", listProjects);
  ipcMain.handle("projects:save", saveProject);
  ipcMain.handle("projects:load", loadProject);
  ipcMain.handle("projects:rename", renameProject);
  ipcMain.handle("projects:duplicate", duplicateProject);
  ipcMain.handle("projects:delete", deleteProject);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
