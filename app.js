const canvas = document.querySelector("#canvas");
const slideNotes = document.querySelector("#slideNotes");
const slideVideo = document.querySelector("#slideVideo");
const imageTemplate = document.querySelector("#imageTemplate");
const textTemplate = document.querySelector("#textTemplate");
const shapeTemplate = document.querySelector("#shapeTemplate");
const statusText = document.querySelector("#statusText");
const tauriInvoke = window.__TAURI__?.core?.invoke || null;
const tauriDialog = window.__TAURI__?.dialog || null;
const PROJECT_FILE_FILTER = [{ name: "Simple Slide Project", extensions: ["json"] }];
const VIDEO_FILE_FILTER = [{ name: "Video", extensions: ["mp4", "mov", "m4v", "webm"] }];
const MP4_FILE_FILTER = [{ name: "MP4 Video", extensions: ["mp4"] }];
const nativeApi = window.simpleSlideNative || (tauriInvoke ? {
  isNative: true,
  platform: window.__TAURI__?.os?.platform?.() || navigator.platform || "",
  toAssetUrl: (path) => window.__TAURI__?.core?.convertFileSrc?.(path) || path,
  listProjects: () => tauriInvoke("list_projects"),
  saveProject: (payload) => tauriInvoke("save_project", { payload }),
  loadProject: (id) => tauriInvoke("load_project", { id }),
  renameProject: (payload) => tauriInvoke("rename_project", { payload }),
  duplicateProject: (id) => tauriInvoke("duplicate_project", { id }),
  deleteProject: (id) => tauriInvoke("delete_project", { id }),
  importProjectAsset: (projectId, path) => tauriInvoke("import_project_asset", { projectId, path }),
  getAppSettings: () => tauriInvoke("get_app_settings"),
  getDefaultExportDir: () => tauriInvoke("get_default_export_dir"),
  saveAppSettings: (settings) => tauriInvoke("save_app_settings", { settings }),
  exportProjectFile: async (suggestedName, data) => {
    if (!tauriDialog?.save) {
      throw new Error("Tauri 파일 저장 대화상자를 사용할 수 없습니다.");
    }
    const path = await tauriDialog.save({
      defaultPath: suggestedName,
      filters: PROJECT_FILE_FILTER,
    });
    if (!path) {
      return null;
    }
    await tauriInvoke("write_project_file", { path, data });
    return path;
  },
  importProjectFile: async () => {
    if (!tauriDialog?.open) {
      throw new Error("Tauri 파일 선택 대화상자를 사용할 수 없습니다.");
    }
    const path = await tauriDialog.open({
      multiple: false,
      directory: false,
      filters: PROJECT_FILE_FILTER,
    });
    if (!path || Array.isArray(path)) {
      return null;
    }
    return tauriInvoke("read_project_file", { path });
  },
  selectDirectory: async () => {
    if (!tauriDialog?.open) {
      throw new Error("Tauri 폴더 선택 대화상자를 사용할 수 없습니다.");
    }
    const path = await tauriDialog.open({
      multiple: false,
      directory: true,
    });
    if (!path || Array.isArray(path)) {
      return null;
    }
    return path;
  },
  selectVideoFile: async () => {
    if (!tauriDialog?.open) {
      throw new Error("Tauri 파일 선택 대화상자를 사용할 수 없습니다.");
    }
    const path = await tauriDialog.open({
      multiple: false,
      directory: false,
      filters: VIDEO_FILE_FILTER,
    });
    if (!path || Array.isArray(path)) {
      return null;
    }
    return path;
  },
  selectMp4Output: async (suggestedName, exportDir = "") => {
    if (!tauriDialog?.save) {
      throw new Error("Tauri 파일 저장 대화상자를 사용할 수 없습니다.");
    }
    const defaultPath = exportDir ? joinNativePath(exportDir, suggestedName) : suggestedName;
    return tauriDialog.save({
      defaultPath,
      filters: MP4_FILE_FILTER,
    });
  },
  exportVideo: (payload) => tauriInvoke("export_video", { payload }),
  cancelVideoExport: (exportId) => tauriInvoke("cancel_video_export", { exportId }),
  listenVideoExportProgress: (handler) => window.__TAURI__?.event?.listen?.("video-export-progress", (event) => handler(event.payload)),
  listGitCommits: (repoPath) => tauriInvoke("list_git_commits", { repoPath }),
  listGitCommitFiles: (repoPath, commitHash) => tauriInvoke("list_git_commit_files", { repoPath, commitHash }),
  readGitCommitFileChange: (repoPath, commitHash, filePath) =>
    tauriInvoke("read_git_commit_file_change", { repoPath, commitHash, filePath }),
} : null);

const projectNameInput = document.querySelector("#projectNameInput");
const newProject = document.querySelector("#newProject");
const projectLibraryButton = document.querySelector("#projectLibraryButton");
const appSettingsButton = document.querySelector("#appSettingsButton");
const nativeDivider = document.querySelector(".native-divider");
const canvasWidth = document.querySelector("#canvasWidth");
const canvasHeight = document.querySelector("#canvasHeight");
const canvasColor = document.querySelector("#canvasColor");
const applyCanvas = document.querySelector("#applyCanvas");
const colorPresetButtons = [...document.querySelectorAll("[data-color-preset]")];
const pasteImage = document.querySelector("#pasteImage");
const addTextBox = document.querySelector("#addTextBox");
const addGitTypingSlide = document.querySelector("#addGitTypingSlide");
const addChatTypingSlide = document.querySelector("#addChatTypingSlide");
const savePng = document.querySelector("#savePng");
const exportMp4 = document.querySelector("#exportMp4");
const saveProject = document.querySelector("#saveProject");
const openProject = document.querySelector("#openProject");
const projectFileInput = document.querySelector("#projectFileInput");
const videoFileInput = document.querySelector("#videoFileInput");
const addSlide = document.querySelector("#addSlide");
const duplicateSlide = document.querySelector("#duplicateSlide");
const slideList = document.querySelector("#slideList");
const drawToolButtons = [...document.querySelectorAll("[data-draw-tool]")];
const strokeColor = document.querySelector("#strokeColor");
const strokeWidth = document.querySelector("#strokeWidth");
const chooseSlideVideo = document.querySelector("#chooseSlideVideo");
const clearSlideVideo = document.querySelector("#clearSlideVideo");
const slideVideoInfo = document.querySelector("#slideVideoInfo");
const dynamicSlidePreview = document.querySelector("#dynamicSlidePreview");
const dynamicSlideType = document.querySelector("#dynamicSlideType");
const gitTypingControls = document.querySelector("#gitTypingControls");
const chatTypingControls = document.querySelector("#chatTypingControls");
const canvasSlideHint = document.querySelector("#canvasSlideHint");
const chooseGitRepo = document.querySelector("#chooseGitRepo");
const loadGitCommits = document.querySelector("#loadGitCommits");
const refreshGitDiff = document.querySelector("#refreshGitDiff");
const gitRepoPath = document.querySelector("#gitRepoPath");
const gitSlideTitle = document.querySelector("#gitSlideTitle");
const gitCommitSelect = document.querySelector("#gitCommitSelect");
const gitFileSelect = document.querySelector("#gitFileSelect");
const gitTypingSpeed = document.querySelector("#gitTypingSpeed");
const gitTypingContent = document.querySelector("#gitTypingContent");
const chatSlideTitle = document.querySelector("#chatSlideTitle");
const chatTypingSpeed = document.querySelector("#chatTypingSpeed");
const chatQuestion = document.querySelector("#chatQuestion");
const chatAnswer = document.querySelector("#chatAnswer");
const ttsPreset = document.querySelector("#ttsPreset");
const ttsModel = document.querySelector("#ttsModel");
const ttsVoice = document.querySelector("#ttsVoice");
const ttsSpeed = document.querySelector("#ttsSpeed");
const ttsInstructions = document.querySelector("#ttsInstructions");
const subtitleEnabled = document.querySelector("#subtitleEnabled");
const exportModal = document.querySelector("#exportModal");
const exportModalPhase = document.querySelector("#exportModalPhase");
const exportProgress = document.querySelector("#exportProgress");
const exportModalStatus = document.querySelector("#exportModalStatus");
const cancelExport = document.querySelector("#cancelExport");
const appSettings = document.querySelector("#appSettings");
const closeAppSettings = document.querySelector("#closeAppSettings");
const saveAppSettingsButton = document.querySelector("#saveAppSettings");
const settingsOpenAiApiKey = document.querySelector("#settingsOpenAiApiKey");
const settingsTtsPreset = document.querySelector("#settingsTtsPreset");
const settingsExportDir = document.querySelector("#settingsExportDir");
const chooseExportDir = document.querySelector("#chooseExportDir");
const resetExportDir = document.querySelector("#resetExportDir");

const selectedPanel = document.querySelector(".selected-panel");
const selectedX = document.querySelector("#selectedX");
const selectedY = document.querySelector("#selectedY");
const selectedW = document.querySelector("#selectedW");
const selectedH = document.querySelector("#selectedH");
const selectedR = document.querySelector("#selectedR");
const selectedTextSize = document.querySelector("#selectedTextSize");
const textSizeButtons = [...document.querySelectorAll("[data-text-size]")];
const textAlignButtons = [...document.querySelectorAll("[data-text-align]")];
const selectedTextColor = document.querySelector("#selectedTextColor");
const duplicateSelected = document.querySelector("#duplicateSelected");
const editSelectedText = document.querySelector("#editSelectedText");
const deleteSelected = document.querySelector("#deleteSelected");
const arrangeButtons = {
  backward: document.querySelector("#sendBackward"),
  forward: document.querySelector("#bringForward"),
  back: document.querySelector("#sendToBack"),
  front: document.querySelector("#bringToFront"),
};
const projectLibrary = document.querySelector("#projectLibrary");
const closeProjectLibrary = document.querySelector("#closeProjectLibrary");
const libraryNewProject = document.querySelector("#libraryNewProject");
const projectLibraryList = document.querySelector("#projectLibraryList");
const selectionSummary = document.querySelector("#selectionSummary");
const slideSummary = document.querySelector("#slideSummary");
const deleteSlide = document.querySelector("#deleteSlide");
const saveStateText = document.querySelector("#saveStateText");
const selectionStateText = document.querySelector("#selectionStateText");
const slideStateText = document.querySelector("#slideStateText");
const canvasStateText = document.querySelector("#canvasStateText");

let selectedObject = null;
let selectedObjects = [];
let activePointer = null;
let objectSeed = 0;
let slides = [];
let activeSlideIndex = 0;
let slideSeed = 0;
let draggedSlideIndex = null;
let currentDrawTool = "select";
let activeShapeDraft = null;
let historyStack = [];
let historyIndex = -1;
let isRestoringHistory = false;
let statusTimer = null;
let defaultTextColor = "#111827";
let activeProjectId = null;
let activeProjectName = "Untitled";
let nativeProjects = [];
let nativeSaveTimer = null;
let nativeSavePromise = null;
let nativeSaveQueued = false;
let isLoadingNativeProject = false;
let lastSaveState = "Ready";
let activeTextEditObject = null;
let textEditButtonHandledPointer = false;
const textMeasureCanvas = document.createElement("canvas");
const textMeasureContext = textMeasureCanvas.getContext("2d");
let canvasViewScale = 1;
let appSettingsState = {
  openAiApiKey: "",
  ttsPreset: "animeCute",
  exportDir: "",
};
let activeExportJob = null;

const TEXT_PADDING_X = 10;
const TEXT_PADDING_Y = 8;
const TEXT_SIZE_PRESETS = {
  h4: { fontSize: 20, lineHeight: 25 },
  h3: { fontSize: 28, lineHeight: 35 },
  h2: { fontSize: 40, lineHeight: 50 },
  h1: { fontSize: 56, lineHeight: 70 },
};
const TEXT_ALIGNMENTS = new Set(["left", "center", "right"]);
const DEFAULT_TEXT_COLOR = "#111827";
const COLOR_PRESETS = {
  light: { canvasColor: "#ffffff", textColor: "#111827" },
  dark: { canvasColor: "#000000", textColor: "#ffffff" },
};
const DEFAULT_STROKE_COLOR = "#111827";
const DEFAULT_STROKE_WIDTH = 4;
const SHAPE_KINDS = new Set(["line", "arrow", "pen"]);
const SHAPE_DRAW_PADDING = 14;
const MIN_SHAPE_DRAW_DISTANCE = 5;
const SVG_NS = "http://www.w3.org/2000/svg";
const PROJECT_FORMAT = "simple-slide-project";
const PROJECT_VERSION = 2;
const HISTORY_LIMIT = 80;
const IS_MAC_PLATFORM = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "");
const TTS_PRESETS = {
  animeCute: {
    label: "여성 활발하고 귀여운 애니메이션 여캐",
    model: "gpt-4o-mini-tts",
    voice: "sage",
    speed: 1.12,
    instructions:
      "Speak the Korean input as a cheerful young adult anime heroine. Use a bright, cute, energetic, friendly tone with lively intonation, slightly higher pitch, quick but clear pacing, and warm encouraging emotion. Read the Korean text naturally as written; do not translate it. Do not sound childish, and avoid exaggerated delivery that feels unnatural.",
  },
  animeTsundere: {
    label: "여성 츤데레 애니메이션 여캐",
    model: "gpt-4o-mini-tts",
    voice: "coral",
    speed: 1.06,
    instructions:
      "Speak the Korean input as a young adult tsundere-style anime heroine. Start slightly sharp, confident, and teasing, then let a subtle cute and embarrassed warmth show through. Keep pronunciation clear, lively, and natural in Korean. Read the Korean text as written; do not translate it. Avoid sounding childish or copying any specific actor or character.",
  },
};
const DEFAULT_TTS_SETTINGS = {
  preset: "animeCute",
  model: "gpt-4o-mini-tts",
  voice: TTS_PRESETS.animeCute.voice,
  speed: TTS_PRESETS.animeCute.speed,
  instructions: TTS_PRESETS.animeCute.instructions,
};
const TTS_SETTINGS_STORAGE_KEY = "simpleSlideTtsSettings";
const DEFAULT_SUBTITLE_ENABLED = true;
const SUBTITLE_MAX_LINES = 2;
const VIDEO_EXPORT_FPS = 30;
const VIDEO_EXPORT_FALLBACK_DURATION = 3;
const DYNAMIC_FRAME_RATE = 8;
const DYNAMIC_MAX_DURATION = 60;
const DEFAULT_GIT_TYPING_SPEED = 90;
const DEFAULT_CHAT_TYPING_SPEED = 80;
const CHAT_ANSWER_DELAY_SECONDS = 0.55;
const MAX_GIT_COMMIT_OPTIONS = 80;
const MAX_GIT_FILE_OPTIONS = 300;
const SLIDE_KINDS = new Set(["canvas", "gitTyping", "chatTyping"]);

function setStatus(message) {
  window.clearTimeout(statusTimer);
  statusText.textContent = message;
  statusText.classList.toggle("is-visible", Boolean(message));
  if (message) {
    statusTimer = window.setTimeout(() => {
      statusText.classList.remove("is-visible");
    }, 2200);
  }
}

function normalizeTtsPresetKey(value) {
  return TTS_PRESETS[value] ? value : DEFAULT_TTS_SETTINGS.preset;
}

function getTtsPreset(presetKey) {
  return TTS_PRESETS[normalizeTtsPresetKey(presetKey)];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeTextAlign(value) {
  return TEXT_ALIGNMENTS.has(value) ? value : "left";
}

function getFileNameFromPath(path) {
  return String(path || "").split(/[\\/]/).pop() || "Video";
}

function joinNativePath(directory, filename) {
  const safeDirectory = String(directory || "").trim().replace(/[\\/]+$/g, "");
  if (!safeDirectory) {
    return filename;
  }
  const separator = safeDirectory.includes("\\") && !safeDirectory.includes("/") ? "\\" : "/";
  return `${safeDirectory}${separator}${filename}`;
}

function isExternalUrl(value) {
  return /^(data:|blob:|https?:|asset:)/i.test(String(value || ""));
}

function getDisplayAssetUrl(value) {
  const path = String(value || "");
  if (!path || isExternalUrl(path)) {
    return path;
  }
  return nativeApi?.toAssetUrl ? nativeApi.toAssetUrl(path) : path;
}

function sanitizeSlideKind(value) {
  return SLIDE_KINDS.has(value) ? value : "canvas";
}

function isDynamicSlide(slide) {
  const kind = sanitizeSlideKind(slide?.kind);
  return kind === "gitTyping" || kind === "chatTyping";
}

function sanitizeTypingSpeed(value, fallback) {
  return clamp(numberOr(value, fallback), 20, 240);
}

function truncateText(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n\n... truncated ...` : text;
}

function sanitizeGitCommitOptions(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => ({
      hash: typeof item?.hash === "string" ? item.hash : "",
      label: typeof item?.label === "string" ? item.label : "",
    }))
    .filter((item) => item.hash)
    .slice(0, MAX_GIT_COMMIT_OPTIONS);
}

function sanitizeGitFileOptions(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => typeof item === "string" && item.trim())
    .slice(0, MAX_GIT_FILE_OPTIONS);
}

function getObjectLabel(object) {
  if (!object) {
    return "No selection";
  }
  if (object.dataset.type === "image") {
    return "Image";
  }
  if (object.dataset.type === "text") {
    return "Text";
  }
  const kind = object.dataset.shapeKind || "shape";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function setSaveState(message) {
  lastSaveState = message;
  updateStatusBar();
}

function updateStatusBar() {
  if (!saveStateText) {
    return;
  }

  const selectionLabel =
    selectedObjects.length === 0
      ? "No selection"
      : selectedObjects.length === 1
        ? getObjectLabel(selectedObject)
        : `${selectedObjects.length} selected`;
  const slideLabel = `Slide ${Math.min(activeSlideIndex + 1, slides.length || 1)} of ${slides.length || 1}`;
  const canvasLabel = `${roundedCanvasSize(canvas.style.width || canvas.clientWidth)} x ${roundedCanvasSize(canvas.style.height || canvas.clientHeight)} · ${Math.round(canvasViewScale * 100)}%`;

  saveStateText.textContent = lastSaveState;
  selectionStateText.textContent = selectionLabel;
  slideStateText.textContent = slideLabel;
  canvasStateText.textContent = canvasLabel;
  if (selectionSummary) {
    selectionSummary.textContent = selectedObjects.length === 0 ? "None" : selectionLabel;
  }
  if (slideSummary) {
    slideSummary.textContent = `${Math.min(activeSlideIndex + 1, slides.length || 1)} / ${slides.length || 1}`;
  }
}

function getTextPreset(elementOrKey) {
  const key = typeof elementOrKey === "string" ? elementOrKey : elementOrKey?.dataset.textSize;
  return TEXT_SIZE_PRESETS[key] || TEXT_SIZE_PRESETS.h3;
}

function fitCanvasToWorkspace() {
  const viewport = canvas.parentElement;
  const availableWidth = Math.max(1, viewport.clientWidth - 48);
  const availableHeight = Math.max(1, viewport.clientHeight - 48);
  const scaleX = availableWidth / canvas.offsetWidth;
  const scaleY = availableHeight / canvas.offsetHeight;
  canvasViewScale = clamp(Math.min(scaleX, scaleY, 1), 0.05, 1);
  canvas.style.setProperty("--canvas-scale", canvasViewScale);
  updateStatusBar();
}

function getState(element) {
  return {
    x: Number(element.dataset.x),
    y: Number(element.dataset.y),
    width: Number(element.dataset.width),
    height: Number(element.dataset.height),
    rotation: Number(element.dataset.rotation),
  };
}

function statesEqual(a, b) {
  return (
    a &&
    b &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.rotation === b.rotation
  );
}

function applyState(element, nextState) {
  const state = {
    x: numberOr(nextState.x, 0),
    y: numberOr(nextState.y, 0),
    width: Math.max(8, numberOr(nextState.width, 8)),
    height: Math.max(8, numberOr(nextState.height, 8)),
    rotation: numberOr(nextState.rotation, 0),
  };

  element.dataset.x = String(state.x);
  element.dataset.y = String(state.y);
  element.dataset.width = String(state.width);
  element.dataset.height = String(state.height);
  element.dataset.rotation = String(state.rotation);

  element.style.left = `${state.x}px`;
  element.style.top = `${state.y}px`;
  element.style.width = `${state.width}px`;
  element.style.height = `${state.height}px`;
  element.style.transform = `rotate(${state.rotation}deg)`;

  if (element.dataset.type === "text") {
    renderTextObject(element);
  }

  if (element.dataset.type === "shape") {
    renderShapeObject(element);
  }

  if (element === selectedObject) {
    syncSelectedInputs();
  }
}

function syncTextEditorValue(element, options = {}) {
  if (!element || element.dataset.type !== "text" || !element.classList.contains("is-editing")) {
    return false;
  }
  const editor = element.querySelector(".text-editor");
  element.dataset.text = editor.value;
  const grew = growTextBoxToContent(element);
  if (!grew && options.render !== false) {
    renderTextObject(element);
  }
  return grew;
}

function centerPosition(width, height) {
  const x = Math.max(16, (canvas.offsetWidth - width) / 2);
  const y = Math.max(16, (canvas.offsetHeight - height) / 2);
  return { x, y };
}

function deselectObject(element) {
  stopTextEdit(element);
  element.classList.remove("is-selected");
  selectedObjects = selectedObjects.filter((candidate) => candidate !== element);
  if (selectedObject === element) {
    selectedObject = selectedObjects[selectedObjects.length - 1] || null;
  }
}

function selectObject(element, options = {}) {
  const isToggle = Boolean(options.toggle);

  if (!element) {
    for (const selected of selectedObjects) {
      stopTextEdit(selected);
      selected.classList.remove("is-selected");
    }
    selectedObjects = [];
    selectedObject = null;
    syncSelectedInputs();
    return;
  }

  if (isToggle) {
    if (selectedObjects.includes(element)) {
      deselectObject(element);
    } else {
      selectedObjects.push(element);
      selectedObject = element;
      element.classList.add("is-selected");
      element.focus?.();
    }
    syncSelectedInputs();
    return;
  }

  if (selectedObjects.length === 1 && selectedObject === element) {
    syncSelectedInputs();
    return;
  }

  for (const selected of selectedObjects) {
    if (selected !== element) {
      stopTextEdit(selected);
      selected.classList.remove("is-selected");
    }
  }
  selectedObjects = [element];
  selectedObject = element;
  selectedObject.classList.add("is-selected");
  selectedObject.focus?.();
  syncSelectedInputs();
}

function selectObjects(elements) {
  for (const selected of selectedObjects) {
    stopTextEdit(selected);
    selected.classList.remove("is-selected");
  }
  selectedObjects = elements.filter(Boolean);
  selectedObject = selectedObjects[selectedObjects.length - 1] || null;
  for (const element of selectedObjects) {
    element.classList.add("is-selected");
  }
  syncSelectedInputs();
}

function syncSelectedInputs() {
  const hasSelection = selectedObjects.length > 0;
  const hasTextSelection = selectedObject?.dataset.type === "text";
  selectedPanel.classList.toggle("is-empty", !hasSelection);
  for (const input of [selectedX, selectedY, selectedW, selectedH, selectedR]) {
    input.disabled = !hasSelection;
  }
  for (const button of Object.values(arrangeButtons)) {
    button.disabled = !hasSelection;
  }
  for (const button of textSizeButtons) {
    button.disabled = !hasTextSelection;
  }
  for (const button of textAlignButtons) {
    button.disabled = !hasTextSelection;
  }
  duplicateSelected.disabled = !hasSelection;
  selectedTextColor.disabled = !hasTextSelection;
  editSelectedText.disabled = !hasTextSelection;
  editSelectedText.textContent = activeTextEditObject === selectedObject ? "Done" : "Edit Text";
  deleteSelected.disabled = !hasSelection;

  if (!selectedObject) {
    selectedX.value = "";
    selectedY.value = "";
    selectedW.value = "";
    selectedH.value = "";
    selectedR.value = "";
    setActiveTextSizeButton("h3");
    setActiveTextAlignButton("left");
    selectedTextColor.value = defaultTextColor;
    updateStatusBar();
    return;
  }

  const state = getState(selectedObject);
  selectedX.value = Math.round(state.x);
  selectedY.value = Math.round(state.y);
  selectedW.value = Math.round(state.width);
  selectedH.value = Math.round(state.height);
  selectedR.value = Math.round(state.rotation);
  setActiveTextSizeButton(selectedObject.dataset.textSize || "h3");
  setActiveTextAlignButton(selectedObject.dataset.textAlign || "left");
  selectedTextColor.value = selectedObject.dataset.textColor || defaultTextColor;
  if (selectedObject.dataset.type === "shape") {
    strokeColor.value = sanitizeColor(selectedObject.dataset.strokeColor, DEFAULT_STROKE_COLOR);
    strokeWidth.value = String(clamp(numberOr(selectedObject.dataset.strokeWidth, DEFAULT_STROKE_WIDTH), 1, 32));
  }
  updateStatusBar();
}

function setActiveTextSizeButton(sizeKey) {
  for (const button of textSizeButtons) {
    button.classList.toggle("is-active", button.dataset.textSize === sizeKey);
  }
}

function setActiveTextAlignButton(align) {
  const safeAlign = sanitizeTextAlign(align);
  for (const button of textAlignButtons) {
    button.classList.toggle("is-active", button.dataset.textAlign === safeAlign);
  }
}

function setActiveColorPresetButton(presetKey) {
  for (const button of colorPresetButtons) {
    button.classList.toggle("is-active", button.dataset.colorPreset === presetKey);
  }
}

function detectColorPreset(canvasValue = canvasColor.value, textValue = defaultTextColor) {
  const normalizedCanvas = sanitizeColor(canvasValue, "#ffffff").toLowerCase();
  const normalizedText = sanitizeColor(textValue, DEFAULT_TEXT_COLOR).toLowerCase();
  for (const [key, preset] of Object.entries(COLOR_PRESETS)) {
    if (preset.canvasColor === normalizedCanvas && preset.textColor === normalizedText) {
      return key;
    }
  }
  return "";
}

function syncColorPresetButtons() {
  setActiveColorPresetButton(detectColorPreset());
}

function attachObjectEvents(element) {
  element.addEventListener("pointerdown", (event) => {
    if (event.target.matches(".text-editor")) {
      selectObject(element);
      return;
    }

    const handle = event.target.closest("[data-handle]");
    const isMultiSelect = event.shiftKey || event.metaKey || event.ctrlKey;

    if (currentDrawTool !== "select" && !handle) {
      startShapeDraw(event);
      return;
    }

    if (isMultiSelect && !handle) {
      event.preventDefault();
      selectObject(element, { toggle: true });
      setStatus(`${selectedObjects.length}개 오브젝트를 선택했습니다.`);
      return;
    }

    selectObject(element);
    if (handle) {
      startHandleDrag(element, handle.dataset.handle, event);
      return;
    }

    if (element.dataset.type === "text" && event.detail >= 2) {
      startTextEdit(element);
      return;
    }
    startMove(element, event);
  });
}

function addImageObject(src, naturalWidth = 300, naturalHeight = 200) {
  const element = imageTemplate.content.firstElementChild.cloneNode(true);
  const image = element.querySelector("img");
  image.src = src;
  image.dataset.src = src;

  const maxWidth = canvas.clientWidth * 0.7;
  const maxHeight = canvas.clientHeight * 0.7;
  const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
  const width = Math.max(48, naturalWidth * scale);
  const height = Math.max(48, naturalHeight * scale);
  const position = centerPosition(width, height);

  element.dataset.id = `object-${++objectSeed}`;
  canvas.append(element);
  attachObjectEvents(element);
  applyState(element, { ...position, width, height, rotation: 0 });
  selectObject(element);
  setStatus("이미지를 붙여넣었습니다. 모서리 핸들로 크기 조절, 위쪽 핸들로 회전할 수 있습니다.");
  recordHistory();
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}

function addTextObject(text, statusMessage = "텍스트를 붙여넣었습니다. 텍스트 폰트는 Pretendard로 고정됩니다.") {
  const cleanText = text.trimEnd();
  if (!cleanText) {
    setStatus("붙여넣을 텍스트가 없습니다.");
    return;
  }

  const element = textTemplate.content.firstElementChild.cloneNode(true);
  element.dataset.id = `object-${++objectSeed}`;
  element.dataset.text = cleanText;
  element.dataset.textSize = "h3";
  element.dataset.textAlign = "left";
  element.dataset.textColor = defaultTextColor;
  canvas.append(element);
  attachObjectEvents(element);
  wireTextEditor(element);
  renderTextObject(element);

  const width = clamp(cleanText.length * 16 + 36, 140, 520);
  const lineCount = cleanText.split("\n").length;
  const height = clamp(lineCount * 42 + 24, 64, 360);
  const position = centerPosition(width, height);
  applyState(element, { ...position, width, height, rotation: 0 });
  selectObject(element);
  setStatus(statusMessage);
  recordHistory();
}

function setDrawTool(tool, options = {}) {
  const nextTool = tool === "select" || SHAPE_KINDS.has(tool) ? tool : "select";
  currentDrawTool = nextTool;
  for (const button of drawToolButtons) {
    button.classList.toggle("is-active", button.dataset.drawTool === nextTool);
  }
  canvas.classList.toggle("is-drawing-mode", nextTool !== "select");

  if (options.silent) {
    return;
  }

  if (nextTool === "select") {
    setStatus("선택 도구입니다. 오브젝트를 이동, 회전, 크기 조절할 수 있습니다.");
  } else {
    const label = nextTool === "arrow" ? "화살표" : nextTool === "line" ? "선" : "펜 선";
    setStatus(`캔버스에서 드래그하면 ${label} 오브젝트가 만들어집니다.`);
  }
}

function getCurrentStrokeWidth() {
  return clamp(numberOr(strokeWidth.value, DEFAULT_STROKE_WIDTH), 1, 32);
}

function normalizeStrokeWidthInput() {
  strokeWidth.value = String(getCurrentStrokeWidth());
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / canvasViewScale, 0, canvas.offsetWidth),
    y: clamp((event.clientY - rect.top) / canvasViewScale, 0, canvas.offsetHeight),
  };
}

function parseShapePoints(value) {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      return [];
    }
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((point) => ({
      x: numberOr(point?.x, Number.NaN),
      y: numberOr(point?.y, Number.NaN),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function setShapeDataset(element, data) {
  const shapeKind = SHAPE_KINDS.has(data.shapeKind) ? data.shapeKind : "line";
  const points = parseShapePoints(data.points);
  element.dataset.shapeKind = shapeKind;
  element.dataset.strokeColor = sanitizeColor(data.strokeColor, DEFAULT_STROKE_COLOR);
  element.dataset.strokeWidth = String(clamp(numberOr(data.strokeWidth, DEFAULT_STROKE_WIDTH), 1, 32));
  element.dataset.shapeViewWidth = String(Math.max(1, numberOr(data.shapeViewWidth, data.width || 1)));
  element.dataset.shapeViewHeight = String(Math.max(1, numberOr(data.shapeViewHeight, data.height || 1)));
  element.dataset.points = JSON.stringify(points);
}

function getShapeRenderData(element) {
  const state = getState(element);
  return {
    shapeKind: SHAPE_KINDS.has(element.dataset.shapeKind) ? element.dataset.shapeKind : "line",
    strokeColor: sanitizeColor(element.dataset.strokeColor, DEFAULT_STROKE_COLOR),
    strokeWidth: clamp(numberOr(element.dataset.strokeWidth, DEFAULT_STROKE_WIDTH), 1, 32),
    shapeViewWidth: Math.max(1, numberOr(element.dataset.shapeViewWidth, state.width)),
    shapeViewHeight: Math.max(1, numberOr(element.dataset.shapeViewHeight, state.height)),
    points: parseShapePoints(element.dataset.points),
  };
}

function createSvgElement(tagName, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }
  return node;
}

function getArrowHeadPoints(start, end, strokeWidth) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.1) {
    return null;
  }

  const angle = Math.atan2(dy, dx);
  const length = Math.max(16, strokeWidth * 4);
  const halfWidth = Math.max(7, strokeWidth * 1.8);
  const baseX = end.x - Math.cos(angle) * length;
  const baseY = end.y - Math.sin(angle) * length;
  const normalX = Math.cos(angle + Math.PI / 2);
  const normalY = Math.sin(angle + Math.PI / 2);

  return [
    { x: end.x, y: end.y },
    { x: baseX + normalX * halfWidth, y: baseY + normalY * halfWidth },
    { x: baseX - normalX * halfWidth, y: baseY - normalY * halfWidth },
  ];
}

function renderShapeObject(element) {
  const svg = element.querySelector(".shape-svg");
  if (!svg) {
    return;
  }

  const data = getShapeRenderData(element);
  svg.setAttribute("viewBox", `0 0 ${data.shapeViewWidth} ${data.shapeViewHeight}`);
  svg.replaceChildren();
  if (data.points.length < 2) {
    return;
  }

  if (data.shapeKind === "pen") {
    svg.append(
      createSvgElement("polyline", {
        points: data.points.map((point) => `${point.x},${point.y}`).join(" "),
        fill: "none",
        stroke: data.strokeColor,
        "stroke-width": data.strokeWidth,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      })
    );
    return;
  }

  const start = data.points[0];
  const end = data.points[data.points.length - 1];
  svg.append(
    createSvgElement("line", {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      stroke: data.strokeColor,
      "stroke-width": data.strokeWidth,
      "stroke-linecap": "round",
    })
  );

  if (data.shapeKind === "arrow") {
    const arrowHead = getArrowHeadPoints(start, end, data.strokeWidth);
    if (arrowHead) {
      svg.append(
        createSvgElement("polygon", {
          points: arrowHead.map((point) => `${point.x},${point.y}`).join(" "),
          fill: data.strokeColor,
        })
      );
    }
  }
}

function buildShapeDataFromCanvasPoints(shapeKind, rawPoints, color, lineWidth) {
  const points = parseShapePoints(rawPoints);
  const safePoints = points.length > 0 ? points : [{ x: 0, y: 0 }];
  const xs = safePoints.map((point) => point.x);
  const ys = safePoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = Math.max(SHAPE_DRAW_PADDING, lineWidth * 3);
  const x = minX - padding;
  const y = minY - padding;
  const shapeViewWidth = Math.max(1, maxX - minX) + padding * 2;
  const shapeViewHeight = Math.max(1, maxY - minY) + padding * 2;

  return {
    type: "shape",
    x,
    y,
    width: shapeViewWidth,
    height: shapeViewHeight,
    rotation: 0,
    shapeKind,
    strokeColor: color,
    strokeWidth: lineWidth,
    shapeViewWidth,
    shapeViewHeight,
    points: safePoints.map((point) => ({
      x: point.x - x,
      y: point.y - y,
    })),
  };
}

function getShapeDrawDistance(points) {
  const safePoints = parseShapePoints(points);
  if (safePoints.length < 2) {
    return 0;
  }

  let total = 0;
  for (let index = 1; index < safePoints.length; index += 1) {
    total += Math.hypot(
      safePoints[index].x - safePoints[index - 1].x,
      safePoints[index].y - safePoints[index - 1].y
    );
  }
  return total;
}

function updateShapeDraft(event) {
  if (!activeShapeDraft || event.pointerId !== activeShapeDraft.pointerId) {
    return;
  }

  event.preventDefault();
  const point = getCanvasPoint(event);
  if (activeShapeDraft.shapeKind === "pen") {
    const lastPoint = activeShapeDraft.points[activeShapeDraft.points.length - 1];
    if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) >= 1.5) {
      activeShapeDraft.points.push(point);
    }
  } else {
    activeShapeDraft.points = [activeShapeDraft.startPoint, point];
  }

  const data = buildShapeDataFromCanvasPoints(
    activeShapeDraft.shapeKind,
    activeShapeDraft.points,
    activeShapeDraft.strokeColor,
    activeShapeDraft.strokeWidth
  );
  setShapeDataset(activeShapeDraft.element, data);
  applyState(activeShapeDraft.element, data);
}

function startShapeDraw(event) {
  if (currentDrawTool === "select") {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  selectObject(null);
  normalizeStrokeWidthInput();
  const startPoint = getCanvasPoint(event);
  const color = sanitizeColor(strokeColor.value, DEFAULT_STROKE_COLOR);
  const lineWidth = getCurrentStrokeWidth();
  const initialPoints = [startPoint, { ...startPoint }];
  const data = buildShapeDataFromCanvasPoints(currentDrawTool, initialPoints, color, lineWidth);
  const element = addShapeObjectFromData(data);

  activeShapeDraft = {
    element,
    pointerId: event.pointerId,
    shapeKind: currentDrawTool,
    strokeColor: color,
    strokeWidth: lineWidth,
    startPoint,
    points: initialPoints,
  };

  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (error) {
    // Pointer capture can fail in older browser paths; document-level handlers still finish the draw.
  }
}

function finishShapeDraw(event) {
  if (!activeShapeDraft || event.pointerId !== activeShapeDraft.pointerId) {
    return false;
  }

  if (event.type !== "pointercancel") {
    updateShapeDraft(event);
  }

  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch (error) {
    // Ignore stale capture handles.
  }

  const draft = activeShapeDraft;
  activeShapeDraft = null;
  const distance = getShapeDrawDistance(draft.points);
  if (event.type === "pointercancel" || distance < MIN_SHAPE_DRAW_DISTANCE) {
    draft.element.remove();
    setStatus("너무 짧은 선은 만들지 않았습니다.");
    return true;
  }

  selectObject(draft.element);
  setDrawTool("select", { silent: true });
  renderSlideList();
  setStatus("그린 오브젝트를 추가했습니다. 선택 상태에서 바로 이동, 회전, 크기 조절할 수 있습니다.");
  recordHistory();
  return true;
}

function selectEditableContent(element) {
  element.select();
}

function renderTextObject(element) {
  const text = element.dataset.text || "";
  const textCanvas = element.querySelector(".text-canvas");
  const width = Math.max(1, Math.round(Number(element.dataset.width) || element.clientWidth || 1));
  const height = Math.max(1, Math.round(Number(element.dataset.height) || element.clientHeight || 1));
  const pixelRatio = window.devicePixelRatio || 1;
  textCanvas.width = Math.round(width * pixelRatio);
  textCanvas.height = Math.round(height * pixelRatio);
  textCanvas.style.width = `${width}px`;
  textCanvas.style.height = `${height}px`;

  const context = textCanvas.getContext("2d");
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.__textColor = element.dataset.textColor || DEFAULT_TEXT_COLOR;
  drawTextLines(context, text, width, height, true, element.dataset.textSize || "h3", element.dataset.textAlign || "left");
  delete context.__textColor;
}

function growTextBoxToContent(element) {
  const state = getState(element);
  const preset = getTextPreset(element);
  textMeasureContext.font = `600 ${preset.fontSize}px Pretendard, sans-serif`;
  const lines = wrapTextLines(textMeasureContext, element.dataset.text || "", state.width);
  const nextWidth = state.width;
  const nextHeight = Math.max(state.height, Math.ceil(lines.length * preset.lineHeight + TEXT_PADDING_Y * 2));
  if (nextWidth === state.width && nextHeight === state.height) {
    return false;
  }

  applyState(element, {
    ...state,
    width: nextWidth,
    height: nextHeight,
  });
  return true;
}

function wireTextEditor(element) {
  const editor = element.querySelector(".text-editor");
  editor.addEventListener("input", () => {
    syncTextEditorValue(element);
    scheduleNativeProjectSave();
  });
  editor.addEventListener("compositionstart", () => {
    element.dataset.isComposing = "true";
  });
  editor.addEventListener("compositionend", () => {
    delete element.dataset.isComposing;
    syncTextEditorValue(element);
    scheduleNativeProjectSave();
  });
  editor.addEventListener("blur", () => {
    stopTextEdit(element);
  });
  editor.addEventListener("keydown", (event) => {
    if (event.isComposing || element.dataset.isComposing === "true") {
      return;
    }
    if (event.key === "Escape" || ((event.metaKey || event.ctrlKey) && event.key === "Enter")) {
      event.preventDefault();
      stopTextEdit(element);
      canvas.focus();
    }
  });
}

function startTextEdit(element) {
  if (!element || element.dataset.type !== "text") {
    return;
  }
  if (activeTextEditObject && activeTextEditObject !== element) {
    stopTextEdit(activeTextEditObject);
  }
  selectObject(element);
  const editor = element.querySelector(".text-editor");
  const preset = getTextPreset(element);
  const state = getState(element);
  if (element.classList.contains("is-editing")) {
    activeTextEditObject = element;
    window.requestAnimationFrame(() => editor.focus({ preventScroll: true }));
    syncSelectedInputs();
    return;
  }
  element.classList.add("is-editing");
  activeTextEditObject = element;
  element.dataset.editStartText = element.dataset.text || "";
  element.dataset.editStartWidth = String(state.width);
  element.dataset.editStartHeight = String(state.height);
  editor.value = element.dataset.text || "";
  editor.style.fontSize = `${preset.fontSize}px`;
  editor.style.lineHeight = `${preset.lineHeight}px`;
  editor.style.color = element.dataset.textColor || DEFAULT_TEXT_COLOR;
  editor.style.textAlign = sanitizeTextAlign(element.dataset.textAlign);
  window.requestAnimationFrame(() => {
    editor.focus({ preventScroll: true });
    selectEditableContent(editor);
  });
  syncSelectedInputs();
  setStatus("텍스트 편집 중입니다. Esc 또는 Done으로 종료할 수 있습니다.");
}

function stopTextEdit(element, shouldSetStatus = true) {
  if (!element || element.dataset.type !== "text" || !element.classList.contains("is-editing")) {
    return false;
  }
  const editor = element.querySelector(".text-editor");
  const previousText = element.dataset.editStartText || "";
  const previousWidth = numberOr(element.dataset.editStartWidth, Number.NaN);
  const previousHeight = numberOr(element.dataset.editStartHeight, Number.NaN);
  syncTextEditorValue(element, { render: false });
  element.dataset.text = editor.value;
  element.classList.remove("is-editing");
  if (activeTextEditObject === element) {
    activeTextEditObject = null;
  }
  renderTextObject(element);
  delete element.dataset.editStartText;
  delete element.dataset.editStartWidth;
  delete element.dataset.editStartHeight;
  delete element.dataset.isComposing;
  if (shouldSetStatus) {
    setStatus("텍스트 편집을 종료했습니다.");
  }
  const state = getState(element);
  const changed =
    previousText !== element.dataset.text ||
    previousWidth !== state.width ||
    previousHeight !== state.height;
  syncSelectedInputs();
  if (shouldSetStatus && changed) {
    renderSlideList();
    recordHistory();
  }
  return changed;
}

function startMove(element, event) {
  event.preventDefault();
  element.setPointerCapture(event.pointerId);
  const state = getState(element);
  activePointer = {
    type: "move",
    element,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    state,
  };
}

function startHandleDrag(element, handle, event) {
  event.preventDefault();
  event.stopPropagation();
  element.setPointerCapture(event.pointerId);
  const state = getState(element);
  const rect = element.getBoundingClientRect();
  activePointer = {
    type: handle === "rotate" ? "rotate" : "resize",
    handle,
    element,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
    startAngle: Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)),
    state,
  };
}

function handlePointerMove(event) {
  if (activeShapeDraft) {
    updateShapeDraft(event);
    return;
  }

  if (!activePointer || event.pointerId !== activePointer.pointerId) {
    return;
  }

  const { element, state } = activePointer;
  const dx = (event.clientX - activePointer.startX) / canvasViewScale;
  const dy = (event.clientY - activePointer.startY) / canvasViewScale;

  if (activePointer.type === "move") {
    applyState(element, {
      ...state,
      x: state.x + dx,
      y: state.y + dy,
    });
    return;
  }

  if (activePointer.type === "rotate") {
    const angle = Math.atan2(event.clientY - activePointer.centerY, event.clientX - activePointer.centerX);
    const deltaDegrees = ((angle - activePointer.startAngle) * 180) / Math.PI;
    applyState(element, {
      ...state,
      rotation: state.rotation + deltaDegrees,
    });
    return;
  }

  const horizontalSign = activePointer.handle.includes("w") ? -1 : 1;
  const verticalSign = activePointer.handle.includes("n") ? -1 : 1;
  const width = Math.max(16, state.width + dx * horizontalSign);
  const height = Math.max(16, state.height + dy * verticalSign);
  const x = activePointer.handle.includes("w") ? state.x + (state.width - width) : state.x;
  const y = activePointer.handle.includes("n") ? state.y + (state.height - height) : state.y;

  applyState(element, {
    ...state,
    x,
    y,
    width,
    height,
  });
}

function handlePointerEnd(event) {
  if (finishShapeDraw(event)) {
    return;
  }

  if (!activePointer || event.pointerId !== activePointer.pointerId) {
    return;
  }
  const pointer = activePointer;
  const changed = !statesEqual(pointer.state, getState(pointer.element));
  pointer.element.releasePointerCapture(event.pointerId);
  activePointer = null;
  if (changed) {
    renderSlideList();
    recordHistory();
  }
}

async function pasteImageFromClipboard() {
  if (!navigator.clipboard?.read) {
    setStatus("브라우저가 이미지 Clipboard API를 지원하지 않습니다. Cmd+V로 붙여넣어 주세요.");
    return;
  }

  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith("image/"));
      if (!imageType) {
        continue;
      }
      const blob = await item.getType(imageType);
      await loadImageBlob(blob);
      return;
    }
    setStatus("클립보드에 이미지가 없습니다.");
  } catch (error) {
    setStatus("이미지 붙여넣기 권한이 필요합니다. Cmd+V로 다시 시도할 수 있습니다.");
  }
}

async function loadImageBlob(blob) {
  const src = await readBlobAsDataUrl(blob);
  const image = new Image();
  image.onload = () => {
    addImageObject(src, image.naturalWidth, image.naturalHeight);
  };
  image.onerror = () => {
    setStatus("이미지를 읽지 못했습니다.");
  };
  image.src = src;
}

function roundedCanvasSize(value) {
  return Math.max(1, Math.round(Number.parseFloat(value) || 1));
}

function getObjectCenter(state) {
  return {
    x: state.x + state.width / 2,
    y: state.y + state.height / 2,
  };
}

function drawFittedImage(context, image, width, height) {
  const naturalWidth = image.naturalWidth || width;
  const naturalHeight = image.naturalHeight || height;
  const scale = Math.min(width / naturalWidth, height / naturalHeight);
  const drawWidth = naturalWidth * scale;
  const drawHeight = naturalHeight * scale;
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawCoverMedia(context, media, width, height) {
  const naturalWidth = media.videoWidth || media.naturalWidth || width;
  const naturalHeight = media.videoHeight || media.naturalHeight || height;
  const scale = Math.max(width / naturalWidth, height / naturalHeight);
  const drawWidth = naturalWidth * scale;
  const drawHeight = naturalHeight * scale;
  context.drawImage(media, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function wrapTextLines(context, text, width) {
  const maxTextWidth = Math.max(1, width - TEXT_PADDING_X * 2);
  const output = [];

  for (const rawLine of text.split("\n")) {
    if (!rawLine) {
      output.push("");
      continue;
    }

    let current = "";
    for (const character of [...rawLine]) {
      const next = current + character;
      if (current && context.measureText(next).width > maxTextWidth) {
        output.push(current);
        current = character;
      } else {
        current = next;
      }
    }
    output.push(current);
  }

  return output;
}

function drawTextLines(context, text, width, height, shouldClear = false, textSizeKey = "h3", textAlign = "left") {
  const preset = getTextPreset(textSizeKey);
  const safeAlign = sanitizeTextAlign(textAlign);
  if (shouldClear) {
    context.clearRect(0, 0, width, height);
  }
  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.clip();
  context.fillStyle = context.__textColor || DEFAULT_TEXT_COLOR;
  context.textBaseline = "top";
  context.textAlign = safeAlign;
  context.font = `600 ${preset.fontSize}px Pretendard, sans-serif`;

  for (const [index, line] of wrapTextLines(context, text, width).entries()) {
    const y = TEXT_PADDING_Y + index * preset.lineHeight;
    if (y >= height) {
      break;
    }
    const x =
      safeAlign === "center"
        ? width / 2
        : safeAlign === "right"
          ? width - TEXT_PADDING_X
          : TEXT_PADDING_X;
    context.fillText(line, x, y);
  }

  context.restore();
}

function drawTextObject(context, object, width, height) {
  context.__textColor = object.dataset.textColor || DEFAULT_TEXT_COLOR;
  drawTextLines(
    context,
    object.dataset.text || "",
    width,
    height,
    false,
    object.dataset.textSize || "h3",
    object.dataset.textAlign || "left"
  );
  delete context.__textColor;
}

function fillRoundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
  context.fill();
}

function trimSubtitleLines(lines, maxLines) {
  if (lines.length <= maxLines) {
    return lines;
  }
  const output = lines.slice(0, maxLines);
  const lastIndex = output.length - 1;
  output[lastIndex] = `${output[lastIndex].replace(/\s+$/g, "")}...`;
  return output;
}

function drawSubtitleBox(context, text, width, height) {
  const cleanText = String(text || "").trim();
  if (!cleanText) {
    return;
  }

  const fontSize = clamp(Math.round(width * 0.032), 22, 34);
  const lineHeight = Math.round(fontSize * 1.24);
  const paddingX = Math.round(fontSize * 0.45);
  const paddingY = Math.round(fontSize * 0.22);
  const maxTextWidth = Math.round(width * 0.78);
  const bottomOffset = Math.round(height * 0.055);

  context.save();
  context.font = `700 ${fontSize}px Pretendard, sans-serif`;
  const lines = trimSubtitleLines(wrapTextLines(context, cleanText, maxTextWidth + TEXT_PADDING_X * 2), SUBTITLE_MAX_LINES);
  const measuredWidth = Math.min(
    maxTextWidth,
    Math.max(...lines.map((line) => context.measureText(line).width), fontSize * 4)
  );
  const boxWidth = Math.min(width - 48, Math.ceil(measuredWidth + paddingX * 2));
  const boxHeight = Math.ceil(lines.length * lineHeight + paddingY * 2);
  const boxX = (width - boxWidth) / 2;
  const boxY = height - bottomOffset - boxHeight;

  context.fillStyle = "rgba(0, 0, 0, 0.8)";
  fillRoundedRect(context, boxX, boxY, boxWidth, boxHeight, 6);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.font = `700 ${fontSize}px Pretendard, sans-serif`;
  for (const [index, line] of lines.entries()) {
    context.fillText(line, width / 2, boxY + paddingY + index * lineHeight);
  }
  context.restore();
}

function getGitTypingData(slide) {
  const data = {
    ...createDefaultGitTypingData(),
    ...(slide?.gitTyping || {}),
  };
  return {
    ...data,
    commits: sanitizeGitCommitOptions(data.commits),
    files: sanitizeGitFileOptions(data.files),
    typingSpeed: sanitizeTypingSpeed(slide?.gitTyping?.typingSpeed, DEFAULT_GIT_TYPING_SPEED),
  };
}

function getChatTypingData(slide) {
  return {
    ...createDefaultChatTypingData(),
    ...(slide?.chatTyping || {}),
    typingSpeed: sanitizeTypingSpeed(slide?.chatTyping?.typingSpeed, DEFAULT_CHAT_TYPING_SPEED),
  };
}

function getDynamicSlideDuration(slide) {
  const kind = sanitizeSlideKind(slide?.kind);
  if (kind === "gitTyping") {
    const data = getGitTypingData(slide);
    return clamp((data.content || "").length / data.typingSpeed + 1.2, 4, DYNAMIC_MAX_DURATION);
  }
  if (kind === "chatTyping") {
    const data = getChatTypingData(slide);
    return clamp(
      (data.question || "").length / data.typingSpeed +
        CHAT_ANSWER_DELAY_SECONDS +
        (data.answer || "").length / data.typingSpeed +
        1.1,
      4,
      DYNAMIC_MAX_DURATION
    );
  }
  return 0;
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxHeight) {
  const lines = wrapTextLines(context, text, maxWidth + TEXT_PADDING_X * 2);
  let drawn = 0;
  for (const line of lines) {
    const nextY = y + drawn * lineHeight;
    if (nextY + lineHeight > y + maxHeight) {
      break;
    }
    context.fillText(line, x, nextY);
    drawn += 1;
  }
}

function getMeasuredTextWidth(context, lines, fallbackWidth) {
  return Math.max(...lines.map((line) => context.measureText(line).width), fallbackWidth);
}

function drawClippedLines(context, lines, x, y, maxHeight, lineHeight, scrollOffset = 0) {
  context.save();
  context.beginPath();
  context.rect(x, y, context.canvas.width - x * 2, maxHeight);
  context.clip();
  for (const [index, line] of lines.entries()) {
    const lineY = y + index * lineHeight - scrollOffset;
    if (lineY + lineHeight < y) {
      continue;
    }
    if (lineY > y + maxHeight) {
      break;
    }
    context.fillText(line, x, lineY);
  }
  context.restore();
}

function drawGitTypingSlide(context, slide, width, height, timeSeconds) {
  const data = getGitTypingData(slide);
  const content = truncateText(data.content, 9000);
  const visibleCount = clamp(Math.floor(timeSeconds * data.typingSpeed), 0, content.length);
  const visibleText = `${content.slice(0, visibleCount)}${visibleCount < content.length ? "▌" : ""}`;
  const marginX = Math.round(width * 0.05);
  const marginY = Math.round(height * 0.07);
  const titleSize = clamp(Math.round(width * 0.033), 28, 44);
  const codeSize = clamp(Math.round(width * 0.015), 15, 20);
  const title = data.title || "Git changes";
  const boxY = marginY + titleSize + 26;
  const boxHeight = height - boxY - marginY;

  context.fillStyle = "#0b1020";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#f8fafc";
  context.font = `850 ${titleSize}px Pretendard, sans-serif`;
  context.textBaseline = "top";
  context.textAlign = "left";
  context.fillText(title, marginX, marginY);

  context.fillStyle = "rgba(4, 8, 18, 0.86)";
  fillRoundedRect(context, marginX, boxY, width - marginX * 2, boxHeight, 10);
  context.strokeStyle = "rgba(148, 163, 184, 0.34)";
  context.lineWidth = 1;
  context.strokeRect(marginX + 0.5, boxY + 0.5, width - marginX * 2 - 1, boxHeight - 1);

  context.fillStyle = "#dbeafe";
  context.font = `600 ${codeSize}px Menlo, Monaco, Consolas, monospace`;
  drawWrappedText(context, visibleText, marginX + 24, boxY + 22, width - marginX * 2 - 48, Math.round(codeSize * 1.45), boxHeight - 44);
}

function drawChatTypingSlide(context, slide, width, height, timeSeconds) {
  const data = getChatTypingData(slide);
  const speed = data.typingSpeed;
  const qDuration = (data.question || "").length / speed;
  const answerStart = qDuration + CHAT_ANSWER_DELAY_SECONDS;
  const visibleQuestionCount = clamp(Math.floor(timeSeconds * speed), 0, (data.question || "").length);
  const visibleAnswerCount = clamp(Math.floor((timeSeconds - answerStart) * speed), 0, (data.answer || "").length);
  const questionDone = visibleQuestionCount >= (data.question || "").length;
  const answerDone = visibleAnswerCount >= (data.answer || "").length;
  const questionText = `${(data.question || "").slice(0, visibleQuestionCount)}${questionDone ? "" : "▌"}`;
  const answerText =
    timeSeconds >= answerStart
      ? `${(data.answer || "").slice(0, visibleAnswerCount)}${answerDone ? "" : "▌"}`
      : "";
  const marginX = Math.round(width * 0.036);
  const topMargin = Math.round(height * 0.022);
  const bottomMargin = Math.round(height * 0.045);
  const questionSize = clamp(Math.round(width * 0.0175), 16, 23);
  const thoughtSize = clamp(Math.round(width * 0.015), 14, 19);
  const answerSize = clamp(Math.round(width * 0.017), 15, 22);
  const questionLineHeight = Math.round(questionSize * 1.36);
  const answerLineHeight = Math.round(answerSize * 1.52);
  const questionMaxWidth = Math.round(width * 0.58);
  const answerMaxWidth = width - marginX * 2;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.textBaseline = "top";

  context.font = `750 ${questionSize}px Pretendard, sans-serif`;
  const questionLines = wrapTextLines(context, questionText, questionMaxWidth + TEXT_PADDING_X * 2);
  const questionPaddingX = Math.round(questionSize * 1.08);
  const questionPaddingY = Math.round(questionSize * 0.62);
  const questionHeight = questionLines.length * questionLineHeight + questionPaddingY * 2;
  const questionTextWidth = Math.min(questionMaxWidth, getMeasuredTextWidth(context, questionLines, questionSize * 4));
  const questionWidth = Math.min(width - marginX * 2, Math.ceil(questionTextWidth + questionPaddingX * 2));
  const questionX = width - marginX - questionWidth;
  const questionY = topMargin;
  context.fillStyle = "#050505";
  fillRoundedRect(context, questionX, questionY, questionWidth, questionHeight, Math.round(questionHeight / 2));
  context.fillStyle = "#ffffff";
  context.textAlign = "left";
  for (const [index, line] of questionLines.entries()) {
    context.fillText(line, questionX + questionPaddingX, questionY + questionPaddingY + index * questionLineHeight);
  }

  const answerAreaY = Math.max(questionY + questionHeight + Math.round(height * 0.105), Math.round(height * 0.18));
  if (timeSeconds >= answerStart - CHAT_ANSWER_DELAY_SECONDS * 0.35) {
    context.textAlign = "left";
    context.font = `650 ${thoughtSize}px Pretendard, sans-serif`;
    context.fillStyle = "#8f8f8f";
    context.fillText("Thought for a few seconds", marginX, answerAreaY);
  }

  if (answerText) {
    const answerY = answerAreaY + Math.round(thoughtSize * 2.45);
    const answerMaxHeight = Math.max(answerLineHeight, height - answerY - bottomMargin);
    context.font = `700 ${answerSize}px Pretendard, sans-serif`;
    const answerLines = wrapTextLines(context, answerText, answerMaxWidth + TEXT_PADDING_X * 2);
    const totalAnswerHeight = answerLines.length * answerLineHeight;
    const scrollOffset = Math.max(0, totalAnswerHeight - answerMaxHeight);
    context.fillStyle = "#111111";
    drawClippedLines(context, answerLines, marginX, answerY, answerMaxHeight, answerLineHeight, scrollOffset);
  }
}

function drawDynamicSlide(context, slide, width, height, timeSeconds, options = {}) {
  if (sanitizeSlideKind(slide?.kind) === "gitTyping") {
    drawGitTypingSlide(context, slide, width, height, timeSeconds);
  } else {
    drawChatTypingSlide(context, slide, width, height, timeSeconds);
  }
  if (options.subtitles) {
    drawSubtitleBox(context, slide.notes, width, height);
  }
}

function renderDynamicSlideToDataUrl(slide, timeSeconds, options = {}) {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = Math.max(1, roundedCanvasSize(slide.width));
  exportCanvas.height = Math.max(1, roundedCanvasSize(slide.height));
  drawDynamicSlide(exportCanvas.getContext("2d"), slide, exportCanvas.width, exportCanvas.height, timeSeconds, options);
  return exportCanvas.toDataURL("image/png");
}

async function renderDynamicSlideFrames(slide, options = {}) {
  const duration = getDynamicSlideDuration(slide);
  const frameRate = DYNAMIC_FRAME_RATE;
  const frameCount = Math.max(2, Math.ceil(duration * frameRate));
  const frames = [];
  for (let index = 0; index < frameCount; index += 1) {
    throwIfExportCancelled();
    if (index % frameRate === 0) {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    }
    const timeSeconds = Math.min(duration, index / frameRate);
    frames.push(renderDynamicSlideToDataUrl(slide, timeSeconds, options));
  }
  frames.push(renderDynamicSlideToDataUrl(slide, duration, options));
  return {
    frames,
    frameRate,
    duration,
    framePng: frames[frames.length - 1],
  };
}

function drawShapeData(context, data, width, height) {
  const points = parseShapePoints(data.points);
  if (points.length < 2) {
    return;
  }

  const viewWidth = Math.max(1, numberOr(data.shapeViewWidth, width));
  const viewHeight = Math.max(1, numberOr(data.shapeViewHeight, height));
  const shapeKind = SHAPE_KINDS.has(data.shapeKind) ? data.shapeKind : "line";
  const lineWidth = clamp(numberOr(data.strokeWidth, DEFAULT_STROKE_WIDTH), 1, 32);
  const color = sanitizeColor(data.strokeColor, DEFAULT_STROKE_COLOR);

  context.save();
  context.scale(width / viewWidth, height / viewHeight);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = lineWidth;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (shapeKind === "pen") {
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      context.lineTo(point.x, point.y);
    }
    context.stroke();
    context.restore();
    return;
  }

  const start = points[0];
  const end = points[points.length - 1];
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();

  if (shapeKind === "arrow") {
    const arrowHead = getArrowHeadPoints(start, end, lineWidth);
    if (arrowHead) {
      context.beginPath();
      context.moveTo(arrowHead[0].x, arrowHead[0].y);
      context.lineTo(arrowHead[1].x, arrowHead[1].y);
      context.lineTo(arrowHead[2].x, arrowHead[2].y);
      context.closePath();
      context.fill();
    }
  }

  context.restore();
}

function waitForImageLoad(image) {
  if (image.complete && image.naturalWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", reject, { once: true });
  });
}

function loadImageForRender(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 렌더링하지 못했습니다."));
    image.src = getDisplayAssetUrl(src);
  });
}

async function renderSlideToDataUrl(slide, options = {}) {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  if (isDynamicSlide(slide)) {
    return renderDynamicSlideToDataUrl(slide, getDynamicSlideDuration(slide), options);
  }
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = Math.max(1, roundedCanvasSize(slide.width));
  exportCanvas.height = Math.max(1, roundedCanvasSize(slide.height));
  const context = exportCanvas.getContext("2d");

  if (!options.transparentBackground) {
    context.fillStyle = sanitizeColor(slide.color, "#ffffff");
    context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  }

  for (const object of slide.objects || []) {
    const center = {
      x: object.x + object.width / 2,
      y: object.y + object.height / 2,
    };
    context.save();
    context.translate(center.x, center.y);
    context.rotate((object.rotation * Math.PI) / 180);
    context.translate(-object.width / 2, -object.height / 2);

    if (object.type === "image") {
      const image = await loadImageForRender(object.src);
      drawFittedImage(context, image, object.width, object.height);
    } else if (object.type === "text") {
      context.__textColor = object.textColor || DEFAULT_TEXT_COLOR;
      drawTextLines(context, object.text || "", object.width, object.height, false, object.textSize || "h3", object.textAlign || "left");
      delete context.__textColor;
    } else if (object.type === "shape") {
      drawShapeData(context, object, object.width, object.height);
    }

    context.restore();
  }

  if (options.subtitles) {
    drawSubtitleBox(context, slide.notes, exportCanvas.width, exportCanvas.height);
  }

  return exportCanvas.toDataURL("image/png");
}

function createDefaultSlide() {
  return {
    id: `slide-${++slideSeed}`,
    kind: "canvas",
    width: 1280,
    height: 720,
    color: "#ffffff",
    notes: "",
    video: null,
    objects: [],
  };
}

function createDefaultGitTypingData() {
  return {
    title: "Git commit",
    repoPath: "",
    commitHash: "",
    commitLabel: "",
    filePath: "",
    commits: [],
    files: [],
    content: "Choose Repo -> Load Commits에서 커밋과 파일을 선택한 뒤 Load Change를 누르세요.",
    typingSpeed: DEFAULT_GIT_TYPING_SPEED,
  };
}

function createDefaultChatTypingData() {
  return {
    title: "GPT conversation",
    question: "GPT에게 질문을 입력하세요.",
    answer: "여기에 GPT 응답을 입력하면 영상에서는 실시간으로 답변이 출력되는 것처럼 재생됩니다.",
    typingSpeed: DEFAULT_CHAT_TYPING_SPEED,
  };
}

function createDynamicSlide(kind) {
  const slide = createDefaultSlide();
  slide.kind = kind;
  slide.color = kind === "gitTyping" ? "#0b1020" : "#f4f7fb";
  slide.notes =
    kind === "gitTyping"
      ? "Git 변경 내용을 실시간으로 타이핑하듯 보여줍니다."
      : "GPT 질문과 응답이 실시간 대화처럼 출력됩니다.";
  if (kind === "gitTyping") {
    slide.gitTyping = createDefaultGitTypingData();
  } else {
    slide.chatTyping = createDefaultChatTypingData();
  }
  return slide;
}

function normalizeSlideVideo(value) {
  if (!value || typeof value.path !== "string" || !value.path.trim()) {
    return null;
  }
  return {
    path: value.path,
    name: typeof value.name === "string" && value.name.trim() ? value.name : getFileNameFromPath(value.path),
    fit: "fill",
  };
}

function getActiveSlideVideo() {
  return normalizeSlideVideo(slides[activeSlideIndex]?.video);
}

function updateSlideVideoView() {
  const video = getActiveSlideVideo();
  if (!slideVideo || !slideVideoInfo || !clearSlideVideo) {
    return;
  }

  if (!video) {
    slideVideo.pause();
    slideVideo.removeAttribute("src");
    delete slideVideo.dataset.path;
    slideVideo.load();
    slideVideo.hidden = true;
    slideVideoInfo.textContent = "No video";
    clearSlideVideo.disabled = true;
    return;
  }

  const assetUrl = nativeApi?.toAssetUrl ? nativeApi.toAssetUrl(video.path) : video.path;
  if (slideVideo.dataset.path !== video.path) {
    slideVideo.src = assetUrl;
    slideVideo.dataset.path = video.path;
    slideVideo.load();
  }
  slideVideo.hidden = false;
  slideVideo.muted = true;
  slideVideo.loop = true;
  slideVideo.play().catch(() => {});
  slideVideoInfo.textContent = `${video.name} · fill`;
  clearSlideVideo.disabled = false;
}

function createPreviewElement(tagName, className, text = "") {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function replaceSelectOptions(select, placeholder, items, selectedValue, getValue, getLabel) {
  select.replaceChildren();
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = placeholder;
  select.append(emptyOption);

  let hasSelectedValue = !selectedValue;
  for (const item of items) {
    const value = getValue(item);
    if (!value) {
      continue;
    }
    const option = document.createElement("option");
    option.value = value;
    option.textContent = getLabel(item);
    select.append(option);
    if (value === selectedValue) {
      hasSelectedValue = true;
    }
  }

  if (selectedValue && !hasSelectedValue) {
    const selectedOption = document.createElement("option");
    selectedOption.value = selectedValue;
    selectedOption.textContent = selectedValue;
    select.append(selectedOption);
  }

  select.value = selectedValue || "";
}

function updateGitSelectControls(data) {
  replaceSelectOptions(
    gitCommitSelect,
    "Load commits...",
    data.commits,
    data.commitHash,
    (commit) => commit.hash,
    (commit) => commit.label || commit.hash
  );
  replaceSelectOptions(
    gitFileSelect,
    data.commitHash ? "Select file..." : "Select commit first...",
    data.files,
    data.filePath,
    (filePath) => filePath,
    (filePath) => filePath
  );
}

function renderDynamicSlidePreview(slide) {
  dynamicSlidePreview.replaceChildren();
  const kind = sanitizeSlideKind(slide?.kind);
  dynamicSlidePreview.classList.toggle("is-visible", isDynamicSlide(slide));
  if (kind === "gitTyping") {
    const data = getGitTypingData(slide);
    const surface = createPreviewElement("div", "dynamic-preview-surface git");
    const title = createPreviewElement("div", "dynamic-preview-title", data.title);
    const code = createPreviewElement("pre", "dynamic-preview-code", truncateText(data.content, 2400));
    surface.append(title, code);
    dynamicSlidePreview.append(surface);
    return;
  }
  if (kind === "chatTyping") {
    const data = getChatTypingData(slide);
    const surface = createPreviewElement("div", "dynamic-preview-surface chat");
    const chat = createPreviewElement("div", "dynamic-preview-chat");
    const answer = createPreviewElement("div", "dynamic-preview-answer", data.answer);
    chat.append(
      createPreviewElement("div", "dynamic-preview-bubble question", data.question),
      createPreviewElement("div", "dynamic-preview-thought", "Thought for a few seconds"),
      answer
    );
    surface.append(chat);
    dynamicSlidePreview.append(surface);
    window.requestAnimationFrame(() => {
      answer.scrollTop = answer.scrollHeight;
    });
  }
}

function syncDynamicSlidePanel() {
  const slide = slides[activeSlideIndex];
  const kind = sanitizeSlideKind(slide?.kind);
  dynamicSlideType.textContent = kind === "gitTyping" ? "Git" : kind === "chatTyping" ? "GPT" : "Canvas";
  gitTypingControls.hidden = kind !== "gitTyping";
  chatTypingControls.hidden = kind !== "chatTyping";
  canvasSlideHint.hidden = isDynamicSlide(slide);

  if (kind === "gitTyping") {
    const data = getGitTypingData(slide);
    gitSlideTitle.value = data.title;
    gitRepoPath.value = data.repoPath;
    updateGitSelectControls(data);
    gitTypingSpeed.value = String(data.typingSpeed);
    gitTypingContent.value = data.content;
  } else if (kind === "chatTyping") {
    const data = getChatTypingData(slide);
    chatSlideTitle.value = data.title;
    chatTypingSpeed.value = String(data.typingSpeed);
    chatQuestion.value = data.question;
    chatAnswer.value = data.answer;
  }

  renderDynamicSlidePreview(slide);
}

function getCanvasState() {
  return {
    width: roundedCanvasSize(canvas.style.width || canvas.offsetWidth),
    height: roundedCanvasSize(canvas.style.height || canvas.offsetHeight),
    color: canvasColor.value || "#ffffff",
  };
}

function serializeObject(object) {
  const state = getState(object);
  const base = {
    type: object.dataset.type,
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    rotation: state.rotation,
  };

  if (object.dataset.type === "image") {
    const image = object.querySelector("img");
    return {
      ...base,
      src: image.dataset.src || image.currentSrc || image.src,
    };
  }

  if (object.dataset.type === "shape") {
    return {
      ...base,
      shapeKind: SHAPE_KINDS.has(object.dataset.shapeKind) ? object.dataset.shapeKind : "line",
      strokeColor: sanitizeColor(object.dataset.strokeColor, DEFAULT_STROKE_COLOR),
      strokeWidth: clamp(numberOr(object.dataset.strokeWidth, DEFAULT_STROKE_WIDTH), 1, 32),
      shapeViewWidth: Math.max(1, numberOr(object.dataset.shapeViewWidth, state.width)),
      shapeViewHeight: Math.max(1, numberOr(object.dataset.shapeViewHeight, state.height)),
      points: parseShapePoints(object.dataset.points),
    };
  }

  return {
    ...base,
    text: object.dataset.text || "",
    textSize: object.dataset.textSize || "h3",
    textAlign: sanitizeTextAlign(object.dataset.textAlign),
    textColor: object.dataset.textColor || DEFAULT_TEXT_COLOR,
  };
}

function serializeCurrentSlide() {
  if (!slides[activeSlideIndex]) {
    return;
  }

  for (const object of canvas.querySelectorAll(".text-object.is-editing")) {
    syncTextEditorValue(object, { render: false });
  }

  slides[activeSlideIndex] = {
    ...slides[activeSlideIndex],
    ...getCanvasState(),
    notes: slideNotes.value,
    video: normalizeSlideVideo(slides[activeSlideIndex]?.video),
    objects: [...canvas.querySelectorAll(".object")].map(serializeObject),
  };
}

function clearCanvasObjects() {
  selectObject(null);
  for (const object of canvas.querySelectorAll(".object")) {
    object.remove();
  }
}

function addImageObjectFromData(data) {
  const element = imageTemplate.content.firstElementChild.cloneNode(true);
  const image = element.querySelector("img");
  element.dataset.id = `object-${++objectSeed}`;
  image.src = getDisplayAssetUrl(data.src);
  image.dataset.src = data.src;
  canvas.append(element);
  attachObjectEvents(element);
  applyState(element, data);
  return element;
}

function addTextObjectFromData(data) {
  const element = textTemplate.content.firstElementChild.cloneNode(true);
  element.dataset.id = `object-${++objectSeed}`;
  element.dataset.text = data.text || "";
  element.dataset.textSize = data.textSize || "h3";
  element.dataset.textAlign = sanitizeTextAlign(data.textAlign);
  element.dataset.textColor = data.textColor || DEFAULT_TEXT_COLOR;
  canvas.append(element);
  attachObjectEvents(element);
  wireTextEditor(element);
  applyState(element, data);
  return element;
}

function addShapeObjectFromData(data) {
  const element = shapeTemplate.content.firstElementChild.cloneNode(true);
  element.dataset.id = `object-${++objectSeed}`;
  setShapeDataset(element, data);
  canvas.append(element);
  attachObjectEvents(element);
  applyState(element, data);
  return element;
}

function addObjectFromData(data) {
  if (data.type === "image") {
    return addImageObjectFromData(data);
  }
  if (data.type === "text") {
    return addTextObjectFromData(data);
  }
  if (data.type === "shape") {
    return addShapeObjectFromData(data);
  }
  return null;
}

function loadSlide(index, shouldSaveCurrent = true) {
  if (shouldSaveCurrent) {
    if (activeTextEditObject) {
      stopTextEdit(activeTextEditObject, false);
    }
    serializeCurrentSlide();
  }

  const slide = slides[index];
  if (!slide) {
    return;
  }

  activeSlideIndex = index;
  clearCanvasObjects();
  canvasWidth.value = slide.width;
  canvasHeight.value = slide.height;
  canvasColor.value = slide.color;
  canvas.style.width = `${slide.width}px`;
  canvas.style.height = `${slide.height}px`;
  canvas.style.backgroundColor = slide.color;
  slideNotes.value = typeof slide.notes === "string" ? slide.notes : "";
  slides[activeSlideIndex].video = normalizeSlideVideo(slide.video);
  updateSlideVideoView();
  syncDynamicSlidePanel();
  defaultTextColor = slide.color?.toLowerCase?.() === COLOR_PRESETS.dark.canvasColor ? COLOR_PRESETS.dark.textColor : DEFAULT_TEXT_COLOR;
  syncColorPresetButtons();

  for (const object of slide.objects) {
    if (object.type === "image") {
      addImageObjectFromData(object);
    } else if (object.type === "text") {
      addTextObjectFromData(object);
    } else if (object.type === "shape") {
      addShapeObjectFromData(object);
    }
  }

  selectObject(null);
  fitCanvasToWorkspace();
  renderSlideList();
}

function renderSlidePreview(slide, previewCanvas) {
  const width = 144;
  const height = 81;
  previewCanvas.width = width;
  previewCanvas.height = height;
  const context = previewCanvas.getContext("2d");
  if (isDynamicSlide(slide)) {
    const previewSource = document.createElement("canvas");
    previewSource.width = Math.max(1, roundedCanvasSize(slide.width));
    previewSource.height = Math.max(1, roundedCanvasSize(slide.height));
    drawDynamicSlide(
      previewSource.getContext("2d"),
      slide,
      previewSource.width,
      previewSource.height,
      getDynamicSlideDuration(slide)
    );
    context.drawImage(previewSource, 0, 0, width, height);
    return;
  }
  const scale = Math.min(width / slide.width, height / slide.height);
  const offsetX = (width - slide.width * scale) / 2;
  const offsetY = (height - slide.height * scale) / 2;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#eef0f4";
  context.fillRect(0, 0, width, height);
  context.save();
  context.translate(offsetX, offsetY);
  context.scale(scale, scale);
  context.fillStyle = slide.color;
  context.fillRect(0, 0, slide.width, slide.height);
  if (normalizeSlideVideo(slide.video)) {
    context.fillStyle = "#111827";
    context.fillRect(0, 0, slide.width, slide.height);
    context.fillStyle = "rgba(255, 255, 255, 0.82)";
    context.font = "700 42px Pretendard, sans-serif";
    context.fillText("VIDEO", 28, slide.height - 72);
  }

  for (const object of slide.objects) {
    const center = {
      x: object.x + object.width / 2,
      y: object.y + object.height / 2,
    };
    context.save();
    context.translate(center.x, center.y);
    context.rotate((object.rotation * Math.PI) / 180);
    context.translate(-object.width / 2, -object.height / 2);

    if (object.type === "image") {
      context.fillStyle = "#dbeafe";
      context.fillRect(0, 0, object.width, object.height);
      context.strokeStyle = "#93c5fd";
      context.strokeRect(0, 0, object.width, object.height);
    } else if (object.type === "text") {
      context.__textColor = object.textColor || DEFAULT_TEXT_COLOR;
      drawTextLines(context, object.text || "", object.width, object.height, false, object.textSize || "h3", object.textAlign || "left");
      delete context.__textColor;
    } else if (object.type === "shape") {
      drawShapeData(context, object, object.width, object.height);
    }

    context.restore();
  }

  context.restore();
}

function renderSlideList() {
  serializeCurrentSlide();
  slideList.replaceChildren();

  slides.forEach((slide, index) => {
    const card = document.createElement("div");
    card.className = `slide-card${index === activeSlideIndex ? " is-active" : ""}`;
    card.draggable = true;
    card.dataset.slideIndex = String(index);
    card.addEventListener("dragstart", (event) => {
      draggedSlideIndex = index;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (draggedSlideIndex !== null && draggedSlideIndex !== index) {
        card.classList.add("is-drop-target");
      }
      event.dataTransfer.dropEffect = "move";
    });
    card.addEventListener("dragleave", () => {
      card.classList.remove("is-drop-target");
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      const fromIndex = draggedSlideIndex ?? Number(event.dataTransfer.getData("text/plain"));
      card.classList.remove("is-drop-target");
      reorderSlide(fromIndex, index);
    });
    card.addEventListener("dragend", () => {
      draggedSlideIndex = null;
      for (const candidate of slideList.querySelectorAll(".slide-card")) {
        candidate.classList.remove("is-dragging", "is-drop-target");
      }
    });

    const thumbButton = document.createElement("button");
    thumbButton.className = "slide-thumb-button";
    thumbButton.type = "button";
    thumbButton.addEventListener("click", () => loadSlide(index));

    const preview = document.createElement("canvas");
    preview.className = "slide-preview";
    renderSlidePreview(slide, preview);

    const name = document.createElement("span");
    name.className = "slide-name";
    name.textContent = `Slide ${index + 1}`;

    const grip = document.createElement("span");
    grip.className = "slide-grip";
    grip.setAttribute("aria-hidden", "true");

    thumbButton.append(preview, grip, name);
    card.append(thumbButton);
    slideList.append(card);
  });
  deleteSlide.disabled = slides.length <= 1;
  updateStatusBar();
}

function reorderSlide(fromIndex, toIndex) {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex === toIndex) {
    return;
  }
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= slides.length || toIndex >= slides.length) {
    return;
  }

  serializeCurrentSlide();
  const [movedSlide] = slides.splice(fromIndex, 1);
  slides.splice(toIndex, 0, movedSlide);

  if (activeSlideIndex === fromIndex) {
    activeSlideIndex = toIndex;
  } else if (fromIndex < activeSlideIndex && toIndex >= activeSlideIndex) {
    activeSlideIndex -= 1;
  } else if (fromIndex > activeSlideIndex && toIndex <= activeSlideIndex) {
    activeSlideIndex += 1;
  }
  renderSlideList();
  setStatus("슬라이드 순서를 변경했습니다.");
  recordHistory();
}

function addNewSlide() {
  serializeCurrentSlide();
  slides.push(createDefaultSlide());
  loadSlide(slides.length - 1, false);
  setStatus("새 슬라이드를 추가했습니다.");
  recordHistory();
}

function addDynamicSlide(kind) {
  serializeCurrentSlide();
  slides.push(createDynamicSlide(kind));
  loadSlide(slides.length - 1, false);
  setStatus(kind === "gitTyping" ? "Git 타이핑 슬라이드를 추가했습니다." : "GPT 대화 타이핑 슬라이드를 추가했습니다.");
  recordHistory();
}

function duplicateCurrentSlide() {
  serializeCurrentSlide();
  const sourceSlide = slides[activeSlideIndex];
  if (!sourceSlide) {
    return;
  }
  const duplicatedSlide = cloneProjectValue(sourceSlide);
  duplicatedSlide.id = `slide-${++slideSeed}`;
  slides.splice(activeSlideIndex + 1, 0, duplicatedSlide);
  loadSlide(activeSlideIndex + 1, false);
  setStatus("현재 슬라이드를 복제했습니다.");
  recordHistory();
}

function duplicateSelectedObjects() {
  if (selectedObjects.length === 0) {
    return false;
  }

  const offset = 18;
  const copies = selectedObjects
    .map((object) => ({
      ...serializeObject(object),
      x: getState(object).x + offset,
      y: getState(object).y + offset,
    }))
    .map(addObjectFromData)
    .filter(Boolean);

  if (copies.length === 0) {
    return false;
  }

  selectObjects(copies);
  renderSlideList();
  setStatus(`${copies.length}개 오브젝트를 복제했습니다.`);
  recordHistory();
  return true;
}

function orderedSelectedObjects() {
  const selectedSet = new Set(selectedObjects);
  return [...canvas.querySelectorAll(".object")].filter((object) => selectedSet.has(object));
}

function moveSelectedLayer(mode) {
  const ordered = orderedSelectedObjects();
  if (ordered.length === 0) {
    return;
  }
  const selectedSet = new Set(ordered);

  if (mode === "front") {
    canvas.append(...ordered);
  } else if (mode === "back") {
    canvas.prepend(...ordered);
  } else if (mode === "forward") {
    for (const object of [...ordered].reverse()) {
      let next = object.nextElementSibling;
      while (next && selectedSet.has(next)) {
        next = next.nextElementSibling;
      }
      if (next) {
        next.after(object);
      }
    }
  } else if (mode === "backward") {
    for (const object of ordered) {
      let previous = object.previousElementSibling;
      while (previous && selectedSet.has(previous)) {
        previous = previous.previousElementSibling;
      }
      if (previous) {
        previous.before(object);
      }
    }
  }

  selectObjects(ordered);
  renderSlideList();
  setStatus("오브젝트 순서를 변경했습니다.");
  recordHistory();
}

function nudgeSelectedObjects(deltaX, deltaY) {
  if (selectedObjects.length === 0) {
    return false;
  }
  for (const object of selectedObjects) {
    const state = getState(object);
    applyState(object, {
      ...state,
      x: state.x + deltaX,
      y: state.y + deltaY,
    });
  }
  renderSlideList();
  recordHistory();
  return true;
}

function deleteSelectedObjects() {
  if (selectedObjects.length === 0) {
    return false;
  }
  for (const object of selectedObjects) {
    stopTextEdit(object, false);
    object.remove();
  }
  selectedObject = null;
  selectedObjects = [];
  syncSelectedInputs();
  setStatus("선택한 오브젝트를 삭제했습니다.");
  renderSlideList();
  recordHistory();
  return true;
}

function deleteCurrentSlide() {
  if (slides.length <= 1) {
    setStatus("마지막 슬라이드는 삭제할 수 없습니다.");
    return;
  }
  serializeCurrentSlide();
  slides.splice(activeSlideIndex, 1);
  activeSlideIndex = clamp(activeSlideIndex, 0, slides.length - 1);
  loadSlide(activeSlideIndex, false);
  setStatus("현재 슬라이드를 삭제했습니다.");
  recordHistory();
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function createProjectData() {
  serializeCurrentSlide();
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    activeSlideIndex,
    slides,
  };
}

function getProjectName() {
  return projectNameInput.value.trim() || "Untitled";
}

function setActiveProjectMeta(meta) {
  activeProjectId = meta?.id || null;
  activeProjectName = meta?.name || "Untitled";
  projectNameInput.value = activeProjectName;
}

function createProjectThumbnailDataUrl() {
  try {
    const project = createProjectData();
    const slide = project.slides[project.activeSlideIndex] || project.slides[0];
    if (!slide) {
      return "";
    }
    const preview = document.createElement("canvas");
    renderSlidePreview(slide, preview);
    return preview.toDataURL("image/png");
  } catch {
    return "";
  }
}

async function refreshNativeProjectList() {
  if (!nativeApi) {
    return [];
  }
  nativeProjects = await nativeApi.listProjects();
  renderNativeProjectList();
  return nativeProjects;
}

function normalizeProjectSaveRecord(result, fallbackData) {
  if (result?.meta) {
    return {
      meta: result.meta,
      data: result.data || fallbackData,
    };
  }
  return {
    meta: result,
    data: fallbackData,
  };
}

function applyMaterializedAssetPaths(savedData) {
  if (!savedData || !Array.isArray(savedData.slides)) {
    return;
  }

  let shouldRefreshActiveVideo = false;
  let shouldRefreshSlides = false;
  for (const [index, savedSlide] of savedData.slides.entries()) {
    if (!slides[index]) {
      continue;
    }
    const savedVideo = normalizeSlideVideo(savedSlide.video);
    const currentVideo = normalizeSlideVideo(slides[index].video);
    if ((savedVideo?.path || "") !== (currentVideo?.path || "")) {
      slides[index].video = savedVideo;
      shouldRefreshSlides = true;
      if (index === activeSlideIndex) {
        shouldRefreshActiveVideo = true;
      }
    }

    if (Array.isArray(savedSlide.objects) && Array.isArray(slides[index].objects)) {
      for (const [objectIndex, savedObject] of savedSlide.objects.entries()) {
        const currentObject = slides[index].objects[objectIndex];
        if (
          savedObject?.type === "image" &&
          currentObject?.type === "image" &&
          typeof savedObject.src === "string" &&
          savedObject.src !== currentObject.src
        ) {
          currentObject.src = savedObject.src;
          shouldRefreshSlides = true;
        }
      }
    }
  }

  if (shouldRefreshActiveVideo) {
    updateSlideVideoView();
  }
  if (shouldRefreshSlides) {
    renderSlideList();
  }
}

async function saveActiveNativeProject(options = {}) {
  if (!nativeApi || isLoadingNativeProject) {
    return null;
  }

  window.clearTimeout(nativeSaveTimer);
  if (nativeSavePromise) {
    nativeSaveQueued = true;
    return nativeSavePromise;
  }

  const payload = {
    id: activeProjectId,
    name: getProjectName(),
    data: createProjectData(),
    thumbnail: createProjectThumbnailDataUrl(),
  };

  nativeSavePromise = nativeApi
    .saveProject(payload)
    .then(async (result) => {
      const record = normalizeProjectSaveRecord(result, payload.data);
      setActiveProjectMeta(record.meta);
      applyMaterializedAssetPaths(record.data);
      await refreshNativeProjectList();
      setSaveState("Saved");
      if (options.showStatus) {
        setStatus("프로젝트를 앱 내부에 저장했습니다.");
      }
      return record;
    })
    .catch((error) => {
      setSaveState("Save failed");
      setStatus(error?.message || "프로젝트 저장에 실패했습니다.");
      return null;
    })
    .finally(() => {
      nativeSavePromise = null;
      if (nativeSaveQueued) {
        nativeSaveQueued = false;
        scheduleNativeProjectSave();
      }
    });

  return nativeSavePromise;
}

function scheduleNativeProjectSave() {
  if (!nativeApi || isLoadingNativeProject) {
    return;
  }
  setSaveState("Saving...");
  window.clearTimeout(nativeSaveTimer);
  nativeSaveTimer = window.setTimeout(() => {
    saveActiveNativeProject();
  }, 700);
}

function formatProjectTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderNativeProjectList() {
  if (!projectLibraryList) {
    return;
  }

  projectLibraryList.replaceChildren();
  if (nativeProjects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "project-empty";
    empty.textContent = "저장된 프로젝트가 없습니다.";
    projectLibraryList.append(empty);
    return;
  }

  for (const project of nativeProjects) {
    const item = document.createElement("article");
    item.className = `project-item${project.id === activeProjectId ? " is-active" : ""}`;

    let thumb;
    if (project.thumbnail) {
      thumb = document.createElement("img");
      thumb.src = project.thumbnail;
      thumb.alt = "";
    } else {
      thumb = document.createElement("div");
    }
    thumb.className = "project-item-thumb";

    const details = document.createElement("div");
    details.className = "project-item-details";

    const nameInput = document.createElement("input");
    nameInput.className = "project-item-name";
    nameInput.type = "text";
    nameInput.value = project.name;
    nameInput.addEventListener("change", () => renameNativeProject(project.id, nameInput.value));

    const time = document.createElement("div");
    time.className = "project-item-time";
    time.textContent = `Updated ${formatProjectTime(project.updatedAt)}`;

    details.append(nameInput, time);

    const actions = document.createElement("div");
    actions.className = "project-item-actions";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.textContent = "Open";
    openButton.addEventListener("click", () => openNativeProject(project.id));

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Duplicate";
    copyButton.addEventListener("click", () => duplicateNativeProject(project.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteNativeProject(project.id));

    actions.append(openButton, copyButton, deleteButton);
    item.append(thumb, details, actions);
    projectLibraryList.append(item);
  }
}

async function showProjectLibrary() {
  if (!nativeApi) {
    setStatus("프로젝트 목록은 데스크톱 앱에서 사용할 수 있습니다.");
    return;
  }
  await refreshNativeProjectList();
  projectLibrary.hidden = false;
}

function hideProjectLibrary() {
  projectLibrary.hidden = true;
}

function resetToBlankProject() {
  slideSeed = 0;
  objectSeed = 0;
  activePointer = null;
  activeShapeDraft = null;
  selectedObject = null;
  selectedObjects = [];
  setDrawTool("select", { silent: true });
  slides = [createDefaultSlide()];
  activeSlideIndex = 0;
  loadSlide(0, false);
  resetHistory();
}

function applyProjectState(project) {
  slides = project.slides;
  activeSlideIndex = project.activeSlideIndex;
  slideSeed = slides.length;
  objectSeed = 0;
  activePointer = null;
  activeShapeDraft = null;
  selectedObject = null;
  selectedObjects = [];
  setDrawTool("select", { silent: true });
  loadSlide(activeSlideIndex, false);
  resetHistory();
}

async function createNewNativeProject(options = {}) {
  if (nativeApi && activeProjectId) {
    await saveActiveNativeProject();
  }
  isLoadingNativeProject = true;
  activeProjectId = null;
  activeProjectName = "Untitled";
  projectNameInput.value = activeProjectName;
  resetToBlankProject();
  isLoadingNativeProject = false;
  await saveActiveNativeProject({ showStatus: !options.silent });
  if (!options.silent) {
    hideProjectLibrary();
  }
}

async function openNativeProject(projectId, options = {}) {
  if (!nativeApi) {
    return;
  }
  if (!options.skipSave) {
    await saveActiveNativeProject();
  }
  isLoadingNativeProject = true;
  try {
    const record = await nativeApi.loadProject(projectId);
    const project = normalizeProjectData(record.data);
    setActiveProjectMeta(record.meta);
    applyProjectState(project);
    hideProjectLibrary();
    setStatus(`${activeProjectName} 프로젝트를 열었습니다.`);
  } catch (error) {
    setStatus(error?.message || "프로젝트를 열지 못했습니다.");
  } finally {
    isLoadingNativeProject = false;
  }
}

async function renameNativeProject(projectId, name) {
  if (!nativeApi) {
    return;
  }
  try {
    const meta = await nativeApi.renameProject({ id: projectId, name });
    if (projectId === activeProjectId) {
      setActiveProjectMeta(meta);
    }
    await refreshNativeProjectList();
    setStatus("프로젝트 이름을 변경했습니다.");
  } catch (error) {
    setStatus(error?.message || "프로젝트 이름 변경에 실패했습니다.");
  }
}

async function duplicateNativeProject(projectId) {
  if (!nativeApi) {
    return;
  }
  try {
    await saveActiveNativeProject();
    await nativeApi.duplicateProject(projectId);
    await refreshNativeProjectList();
    setStatus("프로젝트를 복제했습니다.");
  } catch (error) {
    setStatus(error?.message || "프로젝트 복제에 실패했습니다.");
  }
}

async function deleteNativeProject(projectId) {
  if (!nativeApi || !window.confirm("이 프로젝트를 삭제할까요?")) {
    return;
  }
  try {
    await nativeApi.deleteProject(projectId);
    await refreshNativeProjectList();
    if (projectId === activeProjectId) {
      activeProjectId = null;
      if (nativeProjects.length > 0) {
        await openNativeProject(nativeProjects[0].id, { skipSave: true });
        projectLibrary.hidden = false;
      } else {
        await createNewNativeProject({ silent: true });
      }
    }
    setStatus("프로젝트를 삭제했습니다.");
  } catch (error) {
    setStatus(error?.message || "프로젝트 삭제에 실패했습니다.");
  }
}

async function initializeNativeMode() {
  if (!nativeApi) {
    projectNameInput.hidden = true;
    newProject.hidden = true;
    projectLibraryButton.hidden = true;
    nativeDivider.hidden = true;
    setSaveState("File mode");
    return;
  }

  document.body.classList.add("is-native-app");
  saveProject.textContent = "Save";
  openProject.textContent = "Import";
  await refreshNativeProjectList();
  if (nativeProjects.length === 0) {
    await createNewNativeProject({ silent: true });
    return;
  }
  projectLibrary.hidden = false;
}

function cloneProjectValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHistorySnapshot() {
  serializeCurrentSlide();
  return {
    activeSlideIndex,
    slideSeed,
    slides: cloneProjectValue(slides),
  };
}

function getHistorySnapshotKey(snapshot) {
  return JSON.stringify({
    activeSlideIndex: snapshot.activeSlideIndex,
    slides: snapshot.slides,
  });
}

function resetHistory() {
  const snapshot = createHistorySnapshot();
  historyStack = [snapshot];
  historyIndex = 0;
}

function recordHistory() {
  if (isRestoringHistory) {
    return;
  }

  const snapshot = createHistorySnapshot();
  const currentSnapshot = historyStack[historyIndex];
  if (currentSnapshot && getHistorySnapshotKey(currentSnapshot) === getHistorySnapshotKey(snapshot)) {
    return;
  }

  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(snapshot);
  if (historyStack.length > HISTORY_LIMIT) {
    historyStack.shift();
  }
  historyIndex = historyStack.length - 1;
  scheduleNativeProjectSave();
}

function applyHistorySnapshot(snapshot) {
  isRestoringHistory = true;
  slides = cloneProjectValue(snapshot.slides);
  activeSlideIndex = clamp(numberOr(snapshot.activeSlideIndex, 0), 0, Math.max(0, slides.length - 1));
  slideSeed = Math.max(numberOr(snapshot.slideSeed, slides.length), slides.length);
  objectSeed = 0;
  activePointer = null;
  activeShapeDraft = null;
  setDrawTool("select", { silent: true });
  loadSlide(activeSlideIndex, false);
  isRestoringHistory = false;
}

function undoChange() {
  if (historyIndex <= 0) {
    setStatus("되돌릴 작업이 없습니다.");
    return;
  }

  historyIndex -= 1;
  applyHistorySnapshot(historyStack[historyIndex]);
  setStatus("이전 상태로 되돌렸습니다.");
}

function redoChange() {
  if (historyIndex >= historyStack.length - 1) {
    setStatus("다시 적용할 작업이 없습니다.");
    return;
  }

  historyIndex += 1;
  applyHistorySnapshot(historyStack[historyIndex]);
  setStatus("되돌린 작업을 다시 적용했습니다.");
}

function isEditableShortcutTarget(target) {
  return Boolean(target?.matches?.("input, textarea, select, [contenteditable='true']"));
}

function isPrimaryShortcut(event) {
  return IS_MAC_PLATFORM ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

function isUndoShortcut(event) {
  return isPrimaryShortcut(event) && !event.shiftKey && event.key.toLowerCase() === "z";
}

function isRedoShortcut(event) {
  if (!isPrimaryShortcut(event)) {
    return false;
  }
  const key = event.key.toLowerCase();
  return IS_MAC_PLATFORM ? event.shiftKey && key === "z" : key === "y" || (event.shiftKey && key === "z");
}

async function saveProjectFile() {
  if (nativeApi?.exportProjectFile) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const project = createProjectData();
    const baseName = getProjectName().replace(/[\\/:*?"<>|]/g, "-") || "simple-slide";
    const savedPath = await nativeApi.exportProjectFile(`${baseName}-${timestamp}.simpleslide.json`, project);
    if (savedPath) {
      setSaveState("Exported");
      setStatus("선택한 경로에 프로젝트 파일을 저장했습니다.");
    }
    return;
  }

  if (nativeApi) {
    await saveActiveNativeProject({ showStatus: true });
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const project = createProjectData();
  downloadTextFile(
    `simple-slide-${timestamp}.simpleslide.json`,
    JSON.stringify(project, null, 2),
    "application/json"
  );
  setSaveState("Exported");
  setStatus("프로젝트 파일로 저장했습니다.");
}

function sanitizeColor(value, fallback = "#ffffff") {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function sanitizeNumber(value, fallback, min = -4096, max = 4096) {
  return clamp(numberOr(value, fallback), min, max);
}

function normalizeProjectObject(object) {
  if (!object || (object.type !== "image" && object.type !== "text" && object.type !== "shape")) {
    return null;
  }

  const base = {
    type: object.type,
    x: sanitizeNumber(object.x, 0),
    y: sanitizeNumber(object.y, 0),
    width: sanitizeNumber(object.width, 120, 8, 8192),
    height: sanitizeNumber(object.height, 80, 8, 8192),
    rotation: sanitizeNumber(object.rotation, 0, -3600, 3600),
  };

  if (object.type === "image") {
    if (typeof object.src !== "string" || !object.src) {
      return null;
    }
    return {
      ...base,
      src: object.src,
    };
  }

  if (object.type === "shape") {
    const points = parseShapePoints(object.points).map((point) => ({
      x: clamp(point.x, -8192, 8192),
      y: clamp(point.y, -8192, 8192),
    }));
    if (points.length < 2) {
      return null;
    }
    return {
      ...base,
      shapeKind: SHAPE_KINDS.has(object.shapeKind) ? object.shapeKind : "line",
      strokeColor: sanitizeColor(object.strokeColor, DEFAULT_STROKE_COLOR),
      strokeWidth: sanitizeNumber(object.strokeWidth, DEFAULT_STROKE_WIDTH, 1, 32),
      shapeViewWidth: sanitizeNumber(object.shapeViewWidth, base.width, 1, 8192),
      shapeViewHeight: sanitizeNumber(object.shapeViewHeight, base.height, 1, 8192),
      points,
    };
  }

  return {
    ...base,
    text: typeof object.text === "string" ? object.text : "",
    textSize: TEXT_SIZE_PRESETS[object.textSize] ? object.textSize : "h3",
    textAlign: sanitizeTextAlign(object.textAlign),
    textColor: sanitizeColor(object.textColor, DEFAULT_TEXT_COLOR),
  };
}

function normalizeProjectData(data) {
  if (!data || data.format !== PROJECT_FORMAT || !Array.isArray(data.slides)) {
    throw new Error("Simple Slide 프로젝트 파일이 아닙니다.");
  }

  const normalizedSlides = data.slides.map((slide, index) => ({
    id: typeof slide.id === "string" ? slide.id : `slide-${index + 1}`,
    kind: sanitizeSlideKind(slide.kind),
    width: sanitizeNumber(slide.width, 1280, 80, 4096),
    height: sanitizeNumber(slide.height, 720, 80, 4096),
    color: sanitizeColor(slide.color),
    notes: typeof slide.notes === "string" ? slide.notes : "",
    video: normalizeSlideVideo(slide.video),
    gitTyping:
      sanitizeSlideKind(slide.kind) === "gitTyping"
        ? {
            ...createDefaultGitTypingData(),
            ...(slide.gitTyping || {}),
            title: typeof slide.gitTyping?.title === "string" ? slide.gitTyping.title : createDefaultGitTypingData().title,
            repoPath: typeof slide.gitTyping?.repoPath === "string" ? slide.gitTyping.repoPath : "",
            commitHash: typeof slide.gitTyping?.commitHash === "string" ? slide.gitTyping.commitHash : "",
            commitLabel: typeof slide.gitTyping?.commitLabel === "string" ? slide.gitTyping.commitLabel : "",
            filePath: typeof slide.gitTyping?.filePath === "string" ? slide.gitTyping.filePath : "",
            commits: sanitizeGitCommitOptions(slide.gitTyping?.commits),
            files: sanitizeGitFileOptions(slide.gitTyping?.files),
            content: typeof slide.gitTyping?.content === "string" ? slide.gitTyping.content : createDefaultGitTypingData().content,
            typingSpeed: sanitizeTypingSpeed(slide.gitTyping?.typingSpeed, DEFAULT_GIT_TYPING_SPEED),
          }
        : undefined,
    chatTyping:
      sanitizeSlideKind(slide.kind) === "chatTyping"
        ? {
            ...createDefaultChatTypingData(),
            ...(slide.chatTyping || {}),
            title: typeof slide.chatTyping?.title === "string" ? slide.chatTyping.title : createDefaultChatTypingData().title,
            question: typeof slide.chatTyping?.question === "string" ? slide.chatTyping.question : createDefaultChatTypingData().question,
            answer: typeof slide.chatTyping?.answer === "string" ? slide.chatTyping.answer : createDefaultChatTypingData().answer,
            typingSpeed: sanitizeTypingSpeed(slide.chatTyping?.typingSpeed, DEFAULT_CHAT_TYPING_SPEED),
          }
        : undefined,
    objects: Array.isArray(slide.objects) ? slide.objects.map(normalizeProjectObject).filter(Boolean) : [],
  }));

  if (normalizedSlides.length === 0) {
    normalizedSlides.push(createDefaultSlide());
  }

  return {
    activeSlideIndex: clamp(numberOr(data.activeSlideIndex, 0), 0, normalizedSlides.length - 1),
    slides: normalizedSlides,
  };
}

async function openProjectFile(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const project = normalizeProjectData(parsed);
    if (nativeApi) {
      activeProjectId = null;
      activeProjectName = file.name.replace(/\.simpleslide\.json$|\.json$/i, "") || "Imported Project";
      projectNameInput.value = activeProjectName;
    }
    applyProjectState(project);
    if (nativeApi) {
      await saveActiveNativeProject({ showStatus: true });
    } else {
      setStatus(`${file.name} 프로젝트를 열었습니다.`);
    }
  } catch (error) {
    setStatus(error.message || "프로젝트 파일을 열지 못했습니다.");
  } finally {
    projectFileInput.value = "";
  }
}

async function importNativeProjectFile() {
  if (!nativeApi?.importProjectFile) {
    projectFileInput.click();
    return;
  }

  try {
    const record = await nativeApi.importProjectFile();
    if (!record) {
      return;
    }
    const project = normalizeProjectData(record.data);
    activeProjectId = null;
    activeProjectName = record.meta?.name || "Imported Project";
    projectNameInput.value = activeProjectName;
    applyProjectState(project);
    await saveActiveNativeProject({ showStatus: true });
  } catch (error) {
    setStatus(error?.message || "프로젝트 파일을 가져오지 못했습니다.");
  }
}

async function chooseVideoForCurrentSlide() {
  if (nativeApi?.selectVideoFile) {
    try {
      const path = await nativeApi.selectVideoFile();
      if (!path || !slides[activeSlideIndex]) {
        return;
      }
      if (!activeProjectId) {
        await saveActiveNativeProject();
      }
      const importedAsset =
        activeProjectId && nativeApi.importProjectAsset
          ? await nativeApi.importProjectAsset(activeProjectId, path)
          : { path, name: getFileNameFromPath(path) };
      slides[activeSlideIndex].video = {
        path: importedAsset.path,
        name: importedAsset.name || getFileNameFromPath(path),
        fit: "fill",
      };
      updateSlideVideoView();
      renderSlideList();
      setStatus("현재 슬라이드에 fill 모드 영상 소스를 복사해 연결했습니다.");
      recordHistory();
    } catch (error) {
      setStatus(error?.message || "영상 파일을 프로젝트에 복사하지 못했습니다.");
    }
    return;
  }

  videoFileInput.click();
}

function clearVideoForCurrentSlide() {
  if (!slides[activeSlideIndex]) {
    return;
  }
  slides[activeSlideIndex].video = null;
  updateSlideVideoView();
  renderSlideList();
  setStatus("현재 슬라이드의 영상 소스를 제거했습니다.");
  recordHistory();
}

function openBrowserVideoFile(file) {
  if (!file || !slides[activeSlideIndex]) {
    return;
  }
  const url = URL.createObjectURL(file);
  slides[activeSlideIndex].video = {
    path: url,
    name: file.name || "Browser video",
    fit: "fill",
  };
  updateSlideVideoView();
  renderSlideList();
  setStatus("브라우저 임시 영상 소스를 연결했습니다.");
  recordHistory();
  videoFileInput.value = "";
}

async function saveCanvasAsPng() {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  for (const object of canvas.querySelectorAll(".text-object.is-editing")) {
    syncTextEditorValue(object);
  }
  await Promise.all([...canvas.querySelectorAll("img")].map(waitForImageLoad));

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = roundedCanvasSize(canvas.style.width || canvas.clientWidth);
  exportCanvas.height = roundedCanvasSize(canvas.style.height || canvas.clientHeight);

  const context = exportCanvas.getContext("2d");
  context.fillStyle = getComputedStyle(canvas).backgroundColor || "#ffffff";
  context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  if (!slideVideo.hidden && slideVideo.readyState >= 2) {
    drawCoverMedia(context, slideVideo, exportCanvas.width, exportCanvas.height);
  }

  for (const object of canvas.querySelectorAll(".object")) {
    const state = getState(object);
    const center = getObjectCenter(state);

    context.save();
    context.translate(center.x, center.y);
    context.rotate((state.rotation * Math.PI) / 180);
    context.translate(-state.width / 2, -state.height / 2);

    if (object.dataset.type === "image") {
      drawFittedImage(context, object.querySelector("img"), state.width, state.height);
    } else if (object.dataset.type === "text") {
      drawTextObject(context, object, state.width, state.height);
    } else if (object.dataset.type === "shape") {
      drawShapeData(context, serializeObject(object), state.width, state.height);
    }

    context.restore();
  }

  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  link.download = `simple-slide-${timestamp}.png`;
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
  setStatus("PNG 파일로 저장했습니다.");
}

function loadTtsSettings() {
  const defaultPresetKey = normalizeTtsPresetKey(appSettingsState.ttsPreset);
  try {
    const saved = JSON.parse(localStorage.getItem(TTS_SETTINGS_STORAGE_KEY) || "{}");
    const presetKey = normalizeTtsPresetKey(saved.preset || defaultPresetKey);
    ttsPreset.value = presetKey;
    if (saved.customized) {
      ttsModel.value = saved.model || getTtsPreset(presetKey).model;
      ttsVoice.value = saved.voice || getTtsPreset(presetKey).voice;
      ttsSpeed.value = String(clamp(numberOr(saved.speed, getTtsPreset(presetKey).speed), 0.25, 4));
      ttsInstructions.value = typeof saved.instructions === "string" ? saved.instructions : getTtsPreset(presetKey).instructions;
    } else {
      applyTtsPreset(presetKey, { silent: true, persist: false });
    }
    subtitleEnabled.checked = saved.subtitles !== undefined ? Boolean(saved.subtitles) : DEFAULT_SUBTITLE_ENABLED;
  } catch {
    applyTtsPreset(defaultPresetKey, { silent: true, persist: false });
    subtitleEnabled.checked = DEFAULT_SUBTITLE_ENABLED;
  }
}

function saveTtsSettings(options = {}) {
  const settings = {
    preset: normalizeTtsPresetKey(ttsPreset.value),
    model: ttsModel.value,
    voice: ttsVoice.value,
    speed: clamp(numberOr(ttsSpeed.value, DEFAULT_TTS_SETTINGS.speed), 0.25, 4),
    instructions: ttsInstructions.value.trim(),
    subtitles: subtitleEnabled.checked,
    customized: Boolean(options.customized),
  };
  localStorage.setItem(TTS_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function applyTtsPreset(presetKey, options = {}) {
  const safePresetKey = normalizeTtsPresetKey(presetKey);
  const preset = getTtsPreset(safePresetKey);
  ttsPreset.value = safePresetKey;
  ttsModel.value = preset.model;
  ttsVoice.value = preset.voice;
  ttsSpeed.value = String(preset.speed);
  ttsInstructions.value = preset.instructions;
  if (options.persist !== false) {
    saveTtsSettings();
  }
  if (!options.silent) {
    setStatus(`${preset.label} 프리셋을 적용했습니다. Voice는 ${preset.voice}입니다.`);
  }
}

function getTtsSettings() {
  const speed = clamp(numberOr(ttsSpeed.value, DEFAULT_TTS_SETTINGS.speed), 0.25, 4);
  ttsSpeed.value = String(speed);
  saveTtsSettings({ customized: true });
  return {
    apiKey: appSettingsState.openAiApiKey,
    preset: normalizeTtsPresetKey(ttsPreset.value),
    model: ttsModel.value || DEFAULT_TTS_SETTINGS.model,
    voice: ttsVoice.value || DEFAULT_TTS_SETTINGS.voice,
    speed,
    instructions: ttsInstructions.value.trim(),
  };
}

function normalizeAppSettings(value = {}) {
  return {
    openAiApiKey: typeof value.openAiApiKey === "string" ? value.openAiApiKey.trim() : "",
    ttsPreset: normalizeTtsPresetKey(value.ttsPreset),
    exportDir: typeof value.exportDir === "string" ? value.exportDir.trim() : "",
  };
}

async function loadAppSettings() {
  let settings = null;
  if (nativeApi?.getAppSettings) {
    settings = await nativeApi.getAppSettings();
  } else {
    try {
      settings = JSON.parse(localStorage.getItem("simpleSlideAppSettings") || "{}");
    } catch {
      settings = {};
    }
  }

  appSettingsState = normalizeAppSettings(settings);
  settingsOpenAiApiKey.value = appSettingsState.openAiApiKey;
  settingsTtsPreset.value = appSettingsState.ttsPreset;
  settingsExportDir.value = appSettingsState.exportDir;
  applyTtsPreset(appSettingsState.ttsPreset, { silent: true, persist: false });
  loadTtsSettings();
}

async function saveGlobalAppSettings() {
  const nextSettings = normalizeAppSettings({
    openAiApiKey: settingsOpenAiApiKey.value,
    ttsPreset: settingsTtsPreset.value,
    exportDir: settingsExportDir.value,
  });

  try {
    if (nativeApi?.saveAppSettings) {
      appSettingsState = normalizeAppSettings(await nativeApi.saveAppSettings(nextSettings));
    } else {
      localStorage.setItem("simpleSlideAppSettings", JSON.stringify(nextSettings));
      appSettingsState = nextSettings;
    }
    settingsOpenAiApiKey.value = appSettingsState.openAiApiKey;
    settingsTtsPreset.value = appSettingsState.ttsPreset;
    settingsExportDir.value = appSettingsState.exportDir;
    applyTtsPreset(appSettingsState.ttsPreset, { silent: true });
    setStatus("앱 전역 설정을 저장했습니다.");
    hideAppSettings();
  } catch (error) {
    setStatus(error?.message || "앱 설정 저장에 실패했습니다.");
  }
}

function showAppSettings() {
  settingsOpenAiApiKey.value = appSettingsState.openAiApiKey;
  settingsTtsPreset.value = appSettingsState.ttsPreset;
  settingsExportDir.value = appSettingsState.exportDir;
  appSettings.hidden = false;
}

function hideAppSettings() {
  appSettings.hidden = true;
}

async function chooseGlobalExportDirectory() {
  if (!nativeApi?.selectDirectory) {
    setStatus("Export 폴더 지정은 Tauri 앱에서 사용할 수 있습니다.");
    return;
  }
  try {
    const path = await nativeApi.selectDirectory();
    if (path) {
      settingsExportDir.value = path;
      setStatus("MP4 export 폴더를 선택했습니다. Save Settings로 저장하세요.");
    }
  } catch (error) {
    setStatus(error?.message || "MP4 export 폴더를 선택하지 못했습니다.");
  }
}

async function resetGlobalExportDirectory() {
  try {
    if (nativeApi?.getDefaultExportDir) {
      settingsExportDir.value = await nativeApi.getDefaultExportDir();
    } else {
      settingsExportDir.value = "";
    }
    setStatus("MP4 export 폴더를 Downloads로 되돌렸습니다. Save Settings로 저장하세요.");
  } catch (error) {
    setStatus(error?.message || "기본 Downloads 폴더를 읽지 못했습니다.");
  }
}

function updateActiveDynamicSlide(mutator, options = {}) {
  const slide = slides[activeSlideIndex];
  if (!slide || !isDynamicSlide(slide)) {
    return;
  }
  mutator(slide);
  renderDynamicSlidePreview(slide);
  renderSlideList();
  scheduleNativeProjectSave();
  if (options.record) {
    recordHistory();
  }
}

function syncGitTypingInputsToSlide(options = {}) {
  updateActiveDynamicSlide((slide) => {
    slide.gitTyping = {
      ...getGitTypingData(slide),
      title: gitSlideTitle.value,
      repoPath: gitRepoPath.value,
      commitHash: gitCommitSelect.value,
      commitLabel: gitCommitSelect.selectedOptions[0]?.textContent || "",
      filePath: gitFileSelect.value,
      typingSpeed: sanitizeTypingSpeed(gitTypingSpeed.value, DEFAULT_GIT_TYPING_SPEED),
      content: gitTypingContent.value,
    };
  }, options);
}

function syncChatTypingInputsToSlide(options = {}) {
  updateActiveDynamicSlide((slide) => {
    slide.chatTyping = {
      ...getChatTypingData(slide),
      title: chatSlideTitle.value,
      typingSpeed: sanitizeTypingSpeed(chatTypingSpeed.value, DEFAULT_CHAT_TYPING_SPEED),
      question: chatQuestion.value,
      answer: chatAnswer.value,
    };
  }, options);
}

async function chooseGitRepositoryForSlide() {
  if (!nativeApi?.selectDirectory) {
    setStatus("Git 저장소 선택은 Tauri 앱에서 사용할 수 있습니다.");
    return;
  }
  const path = await nativeApi.selectDirectory();
  if (!path) {
    return;
  }
  updateActiveDynamicSlide((slide) => {
    slide.gitTyping = {
      ...getGitTypingData(slide),
      repoPath: path,
      commitHash: "",
      commitLabel: "",
      filePath: "",
      commits: [],
      files: [],
      content: "Load Commits를 눌러 이 저장소의 커밋 기록을 불러오세요.",
    };
  }, { record: true });
  syncDynamicSlidePanel();
  await loadGitCommitsForSlide();
}

function getActiveGitTypingSlide() {
  const slide = slides[activeSlideIndex];
  if (!slide || sanitizeSlideKind(slide.kind) !== "gitTyping") {
    return null;
  }
  return slide;
}

function requireGitRepoPath() {
  const repoPath = gitRepoPath.value.trim();
  if (!repoPath) {
    setStatus("먼저 Git 저장소 폴더를 선택해 주세요.");
    return "";
  }
  return repoPath;
}

async function loadGitCommitsForSlide() {
  const slide = getActiveGitTypingSlide();
  if (!slide) {
    return;
  }
  if (!nativeApi?.listGitCommits) {
    setStatus("Git 커밋 읽기는 Tauri 앱에서 사용할 수 있습니다.");
    return;
  }
  const repoPath = requireGitRepoPath();
  if (!repoPath) {
    return;
  }
  try {
    setStatus("Git 커밋 기록을 불러오는 중입니다.");
    const result = await nativeApi.listGitCommits(repoPath);
    const commits = sanitizeGitCommitOptions(result.commits);
    const current = getGitTypingData(slide);
    const selectedCommit = commits.find((commit) => commit.hash === current.commitHash) || commits[0];
    updateActiveDynamicSlide((activeSlide) => {
      activeSlide.gitTyping = {
        ...getGitTypingData(activeSlide),
        repoPath: result.repoPath || repoPath,
        commitHash: selectedCommit?.hash || "",
        commitLabel: selectedCommit?.label || "",
        filePath: "",
        commits,
        files: [],
        content: selectedCommit
          ? "커밋의 변경 파일 목록을 불러오는 중입니다."
          : "이 저장소에서 읽을 커밋을 찾지 못했습니다.",
      };
    }, { record: !selectedCommit });
    syncDynamicSlidePanel();
    if (selectedCommit) {
      await loadGitFilesForSlide({ record: true, clearContent: true });
    } else {
      setStatus("이 저장소에서 읽을 커밋을 찾지 못했습니다.");
    }
  } catch (error) {
    setStatus(error?.message || "Git 커밋 기록을 읽지 못했습니다.");
  }
}

async function loadGitFilesForSlide(options = {}) {
  const slide = getActiveGitTypingSlide();
  if (!slide) {
    return;
  }
  if (!nativeApi?.listGitCommitFiles) {
    setStatus("Git 파일 목록 읽기는 Tauri 앱에서 사용할 수 있습니다.");
    return;
  }
  const repoPath = requireGitRepoPath();
  const commitHash = gitCommitSelect.value;
  if (!repoPath || !commitHash) {
    setStatus("커밋을 먼저 선택해 주세요.");
    return;
  }
  try {
    setStatus("커밋의 변경 파일을 불러오는 중입니다.");
    const result = await nativeApi.listGitCommitFiles(repoPath, commitHash);
    const files = sanitizeGitFileOptions(result.files);
    const current = getGitTypingData(slide);
    const selectedFilePath = files.includes(current.filePath) ? current.filePath : files[0] || "";
    const selectedCommit = current.commits.find((commit) => commit.hash === commitHash);
    updateActiveDynamicSlide((activeSlide) => {
      activeSlide.gitTyping = {
        ...getGitTypingData(activeSlide),
        repoPath: result.repoPath || repoPath,
        commitHash,
        commitLabel: selectedCommit?.label || current.commitLabel || commitHash,
        filePath: selectedFilePath,
        files,
        content:
          options.clearContent || !current.content
            ? selectedFilePath
              ? "Load Change를 눌러 선택한 파일의 변경 내용을 불러오세요."
              : "이 커밋에서 변경된 파일을 찾지 못했습니다."
            : current.content,
      };
    }, { record: Boolean(options.record) });
    syncDynamicSlidePanel();
    setStatus(files.length ? "변경 파일 목록을 불러왔습니다." : "이 커밋에서 변경된 파일을 찾지 못했습니다.");
  } catch (error) {
    setStatus(error?.message || "Git 변경 파일 목록을 읽지 못했습니다.");
  }
}

async function loadGitFileChangeForSlide() {
  const slide = getActiveGitTypingSlide();
  if (!slide) {
    return;
  }
  if (!nativeApi?.readGitCommitFileChange) {
    setStatus("Git 파일 변경 내용 읽기는 Tauri 앱에서 사용할 수 있습니다.");
    return;
  }
  const repoPath = requireGitRepoPath();
  const commitHash = gitCommitSelect.value;
  const filePath = gitFileSelect.value;
  if (!repoPath || !commitHash || !filePath) {
    setStatus("저장소, 커밋, 파일을 모두 선택해 주세요.");
    return;
  }
  try {
    setStatus("선택한 파일의 변경 내용을 불러오는 중입니다.");
    const result = await nativeApi.readGitCommitFileChange(repoPath, commitHash, filePath);
    const current = getGitTypingData(slide);
    updateActiveDynamicSlide((activeSlide) => {
      activeSlide.gitTyping = {
        ...getGitTypingData(activeSlide),
        repoPath: result.repoPath || repoPath,
        commitHash: result.commitHash || commitHash,
        commitLabel: current.commitLabel || result.commitHash || commitHash,
        filePath: result.filePath || filePath,
        title: result.title || "Git commit",
        content: result.content || "",
      };
    }, { record: true });
    syncDynamicSlidePanel();
    setStatus("선택한 파일 변경 내용을 타이핑 슬라이드에 불러왔습니다.");
  } catch (error) {
    setStatus(error?.message || "Git 파일 변경 내용을 읽지 못했습니다.");
  }
}

function createExportId() {
  return `export-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setExportModalProgress(phase, message, current = 0, total = 1) {
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeCurrent = clamp(Number(current) || 0, 0, safeTotal);
  exportModalPhase.textContent = phase;
  exportModalStatus.textContent = message;
  exportProgress.value = Math.round((safeCurrent / safeTotal) * 100);
}

function throwIfExportCancelled() {
  if (activeExportJob?.cancelled) {
    throw new Error("MP4 추출을 취소했습니다.");
  }
}

async function beginExportJob(exportId) {
  activeExportJob = {
    id: exportId,
    cancelled: false,
    unlisten: null,
  };
  cancelExport.disabled = false;
  document.body.classList.add("is-exporting");
  exportModal.hidden = false;
  setExportModalProgress("Preparing", "Export 준비 중입니다.", 0, 1);

  if (nativeApi?.listenVideoExportProgress) {
    try {
      activeExportJob.unlisten = await nativeApi.listenVideoExportProgress((progress) => {
        if (!activeExportJob || progress?.exportId !== activeExportJob.id) {
          return;
        }
        setExportModalProgress(
          progress.phase || "Exporting",
          progress.message || "MP4를 생성하고 있습니다.",
          progress.current,
          progress.total
        );
      });
    } catch {
      activeExportJob.unlisten = null;
    }
  }
}

async function finishExportJob() {
  const job = activeExportJob;
  if (job?.unlisten) {
    try {
      job.unlisten();
    } catch {
      // Ignore stale listeners.
    }
  }
  activeExportJob = null;
  document.body.classList.remove("is-exporting");
  exportModal.hidden = true;
}

async function cancelActiveExportJob() {
  if (!activeExportJob || activeExportJob.cancelled) {
    return;
  }
  activeExportJob.cancelled = true;
  cancelExport.disabled = true;
  setExportModalProgress("Cancelling", "MP4 추출을 취소하는 중입니다.", 1, 1);
  if (nativeApi?.cancelVideoExport) {
    try {
      await nativeApi.cancelVideoExport(activeExportJob.id);
    } catch {
      // The frontend render phase can still cancel even if the native command has not started.
    }
  }
}

async function exportProjectAsMp4() {
  if (!nativeApi?.exportVideo || !nativeApi?.selectMp4Output) {
    setStatus("MP4 추출은 Tauri 데스크톱 앱에서 사용할 수 있습니다.");
    return;
  }

  serializeCurrentSlide();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const baseName = getProjectName().replace(/[\\/:*?"<>|]/g, "-") || "simple-slide";
  let outputPath;
  try {
    outputPath = await nativeApi.selectMp4Output(`${baseName}-${timestamp}.mp4`, appSettingsState.exportDir);
  } catch (error) {
    setStatus(error?.message || "MP4 저장 경로를 선택하지 못했습니다.");
    return;
  }
  if (!outputPath) {
    return;
  }

  const previousDisabled = exportMp4.disabled;
  const exportId = createExportId();
  exportMp4.disabled = true;
  await beginExportJob(exportId);
  setStatus("슬라이드를 영상 추출용 프레임으로 렌더링하고 있습니다.");

  try {
    const renderedSlides = [];
    for (let index = 0; index < slides.length; index += 1) {
      throwIfExportCancelled();
      const slide = slides[index];
      const video = normalizeSlideVideo(slide.video);
      setExportModalProgress("Rendering", `슬라이드 ${index + 1} / ${slides.length} 렌더링 중입니다.`, index, slides.length);
      const baseSlidePayload = {
        index,
        width: roundedCanvasSize(slide.width),
        height: roundedCanvasSize(slide.height),
        color: sanitizeColor(slide.color, "#ffffff"),
        notes: typeof slide.notes === "string" ? slide.notes : "",
        videoPath: video?.path || null,
      };
      if (isDynamicSlide(slide)) {
        setExportModalProgress("Rendering", `슬라이드 ${index + 1} / ${slides.length} 타이핑 프레임을 만들고 있습니다.`, index, slides.length);
        const animation = await renderDynamicSlideFrames(slide, { subtitles: subtitleEnabled.checked });
        renderedSlides.push({
          ...baseSlidePayload,
          framePng: animation.framePng,
          animationFrames: animation.frames,
          frameRate: animation.frameRate,
          animationDurationSeconds: animation.duration,
        });
      } else {
        renderedSlides.push({
          ...baseSlidePayload,
          framePng: await renderSlideToDataUrl(slide, {
            transparentBackground: Boolean(video),
            subtitles: subtitleEnabled.checked,
          }),
        });
      }
    }

    throwIfExportCancelled();
    setExportModalProgress("Encoding", "TTS와 MP4 세그먼트를 생성하고 있습니다.", 0, 1);
    const result = await nativeApi.exportVideo({
      exportId,
      outputPath,
      fps: VIDEO_EXPORT_FPS,
      fallbackDurationSeconds: VIDEO_EXPORT_FALLBACK_DURATION,
      tts: getTtsSettings(),
      slides: renderedSlides,
    });
    setExportModalProgress("Done", "MP4 추출이 완료되었습니다.", 1, 1);
    setStatus(`MP4로 추출했습니다: ${result?.outputPath || outputPath}`);
  } catch (error) {
    const message = error?.message || String(error) || "MP4 추출에 실패했습니다.";
    setStatus(message);
  } finally {
    exportMp4.disabled = previousDisabled;
    await finishExportJob();
  }
}

function handlePaste(event) {
  const target = event.target;
  if (target?.matches?.("input, textarea, select, [contenteditable='true']")) {
    return;
  }

  const items = [...(event.clipboardData?.items ?? [])];
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (imageItem) {
    event.preventDefault();
    loadImageBlob(imageItem.getAsFile()).catch(() => setStatus("이미지를 읽지 못했습니다."));
    return;
  }

  const text = event.clipboardData?.getData("text/plain");
  if (text) {
    event.preventDefault();
    addTextObject(text);
  }
}

function applySelectedInputChange() {
  if (!selectedObject) {
    return;
  }
  applyState(selectedObject, {
    x: numberOr(selectedX.value, 0),
    y: numberOr(selectedY.value, 0),
    width: numberOr(selectedW.value, 8),
    height: numberOr(selectedH.value, 8),
    rotation: numberOr(selectedR.value, 0),
  });
}

function applySelectedTextSizeChange(sizeKey) {
  if (!selectedObject || selectedObject.dataset.type !== "text") {
    return;
  }

  selectedObject.dataset.textSize = sizeKey;
  setActiveTextSizeButton(sizeKey);
  const editor = selectedObject.querySelector(".text-editor");
  const preset = getTextPreset(selectedObject);
  editor.style.fontSize = `${preset.fontSize}px`;
  editor.style.lineHeight = `${preset.lineHeight}px`;
  if (!growTextBoxToContent(selectedObject)) {
    renderTextObject(selectedObject);
  }
  setStatus(`텍스트 크기를 ${sizeKey.toUpperCase()}로 변경했습니다.`);
  renderSlideList();
  recordHistory();
}

function applySelectedTextColorChange(shouldRecord = false) {
  if (!selectedObject || selectedObject.dataset.type !== "text") {
    return;
  }

  defaultTextColor = selectedTextColor.value;
  selectedObject.dataset.textColor = selectedTextColor.value;
  const editor = selectedObject.querySelector(".text-editor");
  editor.style.color = selectedTextColor.value;
  renderTextObject(selectedObject);
  syncColorPresetButtons();
  setStatus(`텍스트 색상을 ${selectedTextColor.value}로 변경했습니다.`);
  renderSlideList();
  if (shouldRecord) {
    recordHistory();
  }
}

function applySelectedTextAlignChange(align) {
  if (!selectedObject || selectedObject.dataset.type !== "text") {
    return;
  }

  const safeAlign = sanitizeTextAlign(align);
  selectedObject.dataset.textAlign = safeAlign;
  setActiveTextAlignButton(safeAlign);
  const editor = selectedObject.querySelector(".text-editor");
  editor.style.textAlign = safeAlign;
  renderTextObject(selectedObject);
  setStatus(`텍스트 정렬을 ${safeAlign}로 변경했습니다.`);
  renderSlideList();
  recordHistory();
}

function applyColorPreset(presetKey) {
  const preset = COLOR_PRESETS[presetKey];
  if (!preset) {
    return;
  }

  canvasColor.value = preset.canvasColor;
  canvas.style.backgroundColor = preset.canvasColor;
  defaultTextColor = preset.textColor;
  selectedTextColor.value = preset.textColor;

  for (const object of canvas.querySelectorAll(".text-object")) {
    object.dataset.textColor = preset.textColor;
    const editor = object.querySelector(".text-editor");
    editor.style.color = preset.textColor;
    renderTextObject(object);
  }

  syncColorPresetButtons();
  syncSelectedInputs();
  renderSlideList();
  recordHistory();
  setStatus(`${preset.canvasColor === "#000000" ? "검정 배경 / 흰색 글씨" : "흰색 배경 / 검정 글씨"}로 변경했습니다.`);
}

function applySelectedShapeStyleChange(shouldRecord = false) {
  const shapeObjects = selectedObjects.filter((object) => object.dataset.type === "shape");
  if (shapeObjects.length === 0) {
    return;
  }

  normalizeStrokeWidthInput();
  const nextColor = sanitizeColor(strokeColor.value, DEFAULT_STROKE_COLOR);
  const nextWidth = getCurrentStrokeWidth();
  for (const object of shapeObjects) {
    object.dataset.strokeColor = nextColor;
    object.dataset.strokeWidth = String(nextWidth);
    renderShapeObject(object);
  }
  renderSlideList();
  setStatus(`선 오브젝트 ${shapeObjects.length}개의 스타일을 변경했습니다.`);
  if (shouldRecord) {
    recordHistory();
  }
}

applyCanvas.addEventListener("click", () => {
  const width = clamp(numberOr(canvasWidth.value, 1280), 80, 4096);
  const height = clamp(numberOr(canvasHeight.value, 720), 80, 4096);
  canvasWidth.value = width;
  canvasHeight.value = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.backgroundColor = canvasColor.value;
  syncColorPresetButtons();
  fitCanvasToWorkspace();
  setStatus(`캔버스 크기를 ${width} x ${height}로 변경했습니다.`);
  renderSlideList();
  recordHistory();
});

canvasColor.addEventListener("input", () => {
  canvas.style.backgroundColor = canvasColor.value;
  syncColorPresetButtons();
});
canvasColor.addEventListener("change", () => {
  canvas.style.backgroundColor = canvasColor.value;
  syncColorPresetButtons();
  renderSlideList();
  recordHistory();
});

slideNotes.addEventListener("input", () => {
  if (slides[activeSlideIndex]) {
    slides[activeSlideIndex].notes = slideNotes.value;
    scheduleNativeProjectSave();
  }
});
slideNotes.addEventListener("change", () => {
  if (slides[activeSlideIndex]) {
    slides[activeSlideIndex].notes = slideNotes.value;
    recordHistory();
  }
});

for (const button of colorPresetButtons) {
  button.addEventListener("click", () => applyColorPreset(button.dataset.colorPreset));
}

for (const button of drawToolButtons) {
  button.addEventListener("click", () => setDrawTool(button.dataset.drawTool));
}
arrangeButtons.backward.addEventListener("click", () => moveSelectedLayer("backward"));
arrangeButtons.forward.addEventListener("click", () => moveSelectedLayer("forward"));
arrangeButtons.back.addEventListener("click", () => moveSelectedLayer("back"));
arrangeButtons.front.addEventListener("click", () => moveSelectedLayer("front"));
projectNameInput.addEventListener("change", () => {
  activeProjectName = getProjectName();
  projectNameInput.value = activeProjectName;
  if (nativeApi && activeProjectId) {
    renameNativeProject(activeProjectId, activeProjectName);
  } else {
    scheduleNativeProjectSave();
  }
});
newProject.addEventListener("click", () => {
  if (nativeApi) {
    createNewNativeProject();
    return;
  }
  resetToBlankProject();
  setStatus("새 프로젝트를 만들었습니다.");
});
projectLibraryButton.addEventListener("click", showProjectLibrary);
closeProjectLibrary.addEventListener("click", hideProjectLibrary);
projectLibrary.addEventListener("click", (event) => {
  if (event.target === projectLibrary) {
    hideProjectLibrary();
  }
});
appSettingsButton.addEventListener("click", showAppSettings);
closeAppSettings.addEventListener("click", hideAppSettings);
saveAppSettingsButton.addEventListener("click", saveGlobalAppSettings);
chooseExportDir.addEventListener("click", chooseGlobalExportDirectory);
resetExportDir.addEventListener("click", resetGlobalExportDirectory);
appSettings.addEventListener("click", (event) => {
  if (event.target === appSettings) {
    hideAppSettings();
  }
});
libraryNewProject.addEventListener("click", () => createNewNativeProject());
strokeColor.addEventListener("input", () => applySelectedShapeStyleChange());
strokeColor.addEventListener("change", () => applySelectedShapeStyleChange(true));
strokeWidth.addEventListener("input", () => applySelectedShapeStyleChange());
strokeWidth.addEventListener("change", () => {
  normalizeStrokeWidthInput();
  applySelectedShapeStyleChange(true);
});
strokeWidth.addEventListener("blur", normalizeStrokeWidthInput);
chooseSlideVideo.addEventListener("click", chooseVideoForCurrentSlide);
clearSlideVideo.addEventListener("click", clearVideoForCurrentSlide);
videoFileInput.addEventListener("change", () => {
  const [file] = videoFileInput.files;
  if (file) {
    openBrowserVideoFile(file);
  }
});
ttsPreset.addEventListener("change", () => applyTtsPreset(ttsPreset.value));
for (const input of [ttsModel, ttsVoice, ttsSpeed, ttsInstructions]) {
  input.addEventListener("change", () => saveTtsSettings({ customized: true }));
}
subtitleEnabled.addEventListener("change", () => saveTtsSettings({ customized: true }));
ttsSpeed.addEventListener("blur", () => {
  ttsSpeed.value = String(clamp(numberOr(ttsSpeed.value, DEFAULT_TTS_SETTINGS.speed), 0.25, 4));
  saveTtsSettings({ customized: true });
});

pasteImage.addEventListener("click", pasteImageFromClipboard);
addTextBox.addEventListener("click", () => {
  addTextObject("텍스트", "텍스트 상자를 만들었습니다. 바로 입력해서 내용을 바꿀 수 있습니다.");
  startTextEdit(selectedObject);
});
addGitTypingSlide.addEventListener("click", () => addDynamicSlide("gitTyping"));
addChatTypingSlide.addEventListener("click", () => addDynamicSlide("chatTyping"));
chooseGitRepo.addEventListener("click", () => {
  chooseGitRepositoryForSlide();
});
loadGitCommits.addEventListener("click", () => {
  loadGitCommitsForSlide();
});
refreshGitDiff.addEventListener("click", () => {
  loadGitFileChangeForSlide();
});
gitCommitSelect.addEventListener("change", () => {
  syncGitTypingInputsToSlide({ record: true });
  loadGitFilesForSlide({ record: true, clearContent: true });
});
gitFileSelect.addEventListener("change", () => {
  const filePath = gitFileSelect.value;
  if (filePath) {
    gitTypingContent.value = "Load Change를 눌러 선택한 파일의 변경 내용을 불러오세요.";
  }
  syncGitTypingInputsToSlide({ record: true });
});
for (const input of [gitSlideTitle, gitRepoPath, gitTypingSpeed, gitTypingContent]) {
  input.addEventListener("input", () => syncGitTypingInputsToSlide());
  input.addEventListener("change", () => syncGitTypingInputsToSlide({ record: true }));
}
for (const input of [chatSlideTitle, chatTypingSpeed, chatQuestion, chatAnswer]) {
  input.addEventListener("input", () => syncChatTypingInputsToSlide());
  input.addEventListener("change", () => syncChatTypingInputsToSlide({ record: true }));
}
editSelectedText.addEventListener("pointerdown", (event) => {
  if (activeTextEditObject === selectedObject) {
    event.preventDefault();
    textEditButtonHandledPointer = true;
    stopTextEdit(activeTextEditObject);
    canvas.focus();
  }
});
editSelectedText.addEventListener("click", () => {
  if (textEditButtonHandledPointer) {
    textEditButtonHandledPointer = false;
    return;
  }
  startTextEdit(selectedObject);
});
duplicateSelected.addEventListener("click", duplicateSelectedObjects);
savePng.addEventListener("click", saveCanvasAsPng);
exportMp4.addEventListener("click", exportProjectAsMp4);
cancelExport.addEventListener("click", cancelActiveExportJob);
saveProject.addEventListener("click", saveProjectFile);
openProject.addEventListener("click", importNativeProjectFile);
projectFileInput.addEventListener("change", () => {
  const [file] = projectFileInput.files;
  if (file) {
    openProjectFile(file);
  }
});
addSlide.addEventListener("click", addNewSlide);
duplicateSlide.addEventListener("click", duplicateCurrentSlide);
deleteSlide.addEventListener("click", deleteCurrentSlide);

for (const input of [selectedX, selectedY, selectedW, selectedH, selectedR]) {
  input.addEventListener("input", applySelectedInputChange);
  input.addEventListener("change", () => {
    applySelectedInputChange();
    renderSlideList();
    recordHistory();
  });
  input.addEventListener("blur", recordHistory);
}
for (const button of textSizeButtons) {
  button.addEventListener("click", () => applySelectedTextSizeChange(button.dataset.textSize));
}
for (const button of textAlignButtons) {
  button.addEventListener("click", () => applySelectedTextAlignChange(button.dataset.textAlign));
}
selectedTextColor.addEventListener("input", () => applySelectedTextColorChange());
selectedTextColor.addEventListener("change", () => applySelectedTextColorChange(true));

deleteSelected.addEventListener("click", () => {
  deleteSelectedObjects();
});

canvas.addEventListener("pointerdown", (event) => {
  if (event.target === canvas) {
    if (currentDrawTool !== "select") {
      startShapeDraw(event);
      return;
    }
    selectObject(null);
  }
});

document.addEventListener("pointermove", handlePointerMove);
document.addEventListener("pointerup", handlePointerEnd);
document.addEventListener("pointercancel", handlePointerEnd);
document.addEventListener("paste", handlePaste);
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (activeExportJob) {
    event.preventDefault();
    if (key === "escape") {
      cancelActiveExportJob();
    }
    return;
  }
  const isEditableTarget = isEditableShortcutTarget(event.target);
  if (isPrimaryShortcut(event) && key === "s") {
    event.preventDefault();
    saveProjectFile();
    return;
  }
  if (!isEditableTarget && isPrimaryShortcut(event) && key === "o") {
    event.preventDefault();
    importNativeProjectFile();
    return;
  }
  if (!isEditableTarget && isPrimaryShortcut(event) && key === "d") {
    event.preventDefault();
    if (!duplicateSelectedObjects()) {
      duplicateCurrentSlide();
    }
    return;
  }
  if (!isEditableTarget && selectedObjects.length > 0 && ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
    event.preventDefault();
    const amount = event.shiftKey ? 10 : 1;
    const deltaX = key === "arrowleft" ? -amount : key === "arrowright" ? amount : 0;
    const deltaY = key === "arrowup" ? -amount : key === "arrowdown" ? amount : 0;
    nudgeSelectedObjects(deltaX, deltaY);
    return;
  }
  if (!isEditableShortcutTarget(event.target) && isUndoShortcut(event)) {
    event.preventDefault();
    undoChange();
    return;
  }
  if (!isEditableShortcutTarget(event.target) && isRedoShortcut(event)) {
    event.preventDefault();
    redoChange();
    return;
  }
  if (event.key === "Escape" && currentDrawTool !== "select" && !event.target.matches("input, textarea")) {
    event.preventDefault();
    setDrawTool("select");
    return;
  }
  if (event.key === "Enter" && selectedObject?.dataset.type === "text" && !event.target.matches("input, textarea")) {
    event.preventDefault();
    startTextEdit(selectedObject);
    return;
  }
  if ((event.key === "Delete" || event.key === "Backspace") && selectedObjects.length > 0 && !event.target.matches("input, textarea")) {
    event.preventDefault();
    deleteSelectedObjects();
  }
});

window.addEventListener("resize", fitCanvasToWorkspace);
loadAppSettings().catch((error) => {
  setStatus(error?.message || "앱 설정을 불러오지 못했습니다.");
  loadTtsSettings();
});
setDrawTool("select", { silent: true });
slides = [createDefaultSlide()];
loadSlide(0, false);
resetHistory();
initializeNativeMode().catch((error) => {
  setStatus(error?.message || "프로젝트 목록을 초기화하지 못했습니다.");
});
