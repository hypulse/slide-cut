import { createRenderer } from "./rendering.js?v=20260527-graffiti-burst";
import { createProjectModel } from "./project-model.js";

const canvas = document.querySelector("#canvas");
const slideNotes = document.querySelector("#slideNotes");
const noteSegmentList = document.querySelector("#noteSegmentList");
const addNoteSegmentButton = document.querySelector("#addNoteSegment");
const slideNotesSummary = document.querySelector("#slideNotesSummary");
const slideVideo = document.querySelector("#slideVideo");
const imageTemplate = document.querySelector("#imageTemplate");
const textTemplate = document.querySelector("#textTemplate");
const shapeTemplate = document.querySelector("#shapeTemplate");
const statusText = document.querySelector("#statusText");
const tauriInvoke = window.__TAURI__?.core?.invoke || null;
const tauriDialog = window.__TAURI__?.dialog || null;
const PROJECT_FILE_FILTER = [{ name: "Slide Cut Project", extensions: ["slidecut"] }];
const IMAGE_FILE_FILTER = [{ name: "Image", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"] }];
const VIDEO_FILE_FILTER = [{ name: "Video", extensions: ["mp4", "mov", "m4v", "webm"] }];
const AUDIO_FILE_FILTER = [{ name: "Audio", extensions: ["mp3", "wav", "m4a", "aac", "ogg", "flac"] }];
const MP4_FILE_FILTER = [{ name: "MP4 Video", extensions: ["mp4"] }];
if (!tauriInvoke || !tauriDialog) {
  throw new Error("Slide Cut must run inside the Tauri desktop app.");
}
const nativeApi = {
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
  importImageBlob: (payload) => tauriInvoke("import_project_image_blob", { payload }),
  readAssetDataUrl: (path) => tauriInvoke("read_asset_data_url", { path }),
  exportProjectFile: async (suggestedName, data) => {
    const path = await tauriDialog.save({
      defaultPath: suggestedName,
      filters: PROJECT_FILE_FILTER,
    });
    if (!path) {
      return null;
    }
    await tauriInvoke("export_project_package", { path, data });
    return path;
  },
  importProjectFile: async () => {
    const path = await tauriDialog.open({
      multiple: false,
      directory: true,
    });
    if (!path || Array.isArray(path)) {
      return null;
    }
    return tauriInvoke("import_project_package", { path });
  },
  selectDirectory: async () => {
    const path = await tauriDialog.open({
      multiple: false,
      directory: true,
    });
    if (!path || Array.isArray(path)) {
      return null;
    }
    return path;
  },
  selectImageFile: async () => {
    const path = await tauriDialog.open({
      multiple: false,
      directory: false,
      filters: IMAGE_FILE_FILTER,
    });
    if (!path || Array.isArray(path)) {
      return null;
    }
    return path;
  },
  selectVideoFile: async () => {
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
  selectAudioFile: async () => {
    const path = await tauriDialog.open({
      multiple: false,
      directory: false,
      filters: AUDIO_FILE_FILTER,
    });
    if (!path || Array.isArray(path)) {
      return null;
    }
    return path;
  },
  selectMp4Output: async (suggestedName, exportDir = "") => {
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
  translateSlide: (payload) => tauriInvoke("translate_slide", { payload }),
};

const projectNameInput = document.querySelector("#projectNameInput");
const projectLibraryButton = document.querySelector("#projectLibraryButton");
const appSettingsButton = document.querySelector("#appSettingsButton");
const colorPresetButtons = [...document.querySelectorAll("[data-color-preset]")];
const pasteImage = document.querySelector("#pasteImage");
const chooseImage = document.querySelector("#chooseImage");
const addTextBox = document.querySelector("#addTextBox");
const addGitTypingSlide = document.querySelector("#addGitTypingSlide");
const addChatTypingSlide = document.querySelector("#addChatTypingSlide");
const chooseBackgroundMusic = document.querySelector("#chooseBackgroundMusic");
const clearBackgroundMusic = document.querySelector("#clearBackgroundMusic");
const backgroundMusicInfo = document.querySelector("#backgroundMusicInfo");
const savePng = document.querySelector("#savePng");
const exportMp4 = document.querySelector("#exportMp4");
const saveProject = document.querySelector("#saveProject");
const openProject = document.querySelector("#openProject");
const drawPanel = document.querySelector('[aria-labelledby="draw-title"]');
const slideVideoPanel = document.querySelector('[aria-labelledby="slide-video-title"]');
const slideSoundPanel = document.querySelector('[aria-labelledby="slide-sound-title"]');
const dynamicSlidePanel = document.querySelector("#dynamicSlidePanel");
const addSlide = document.querySelector("#addSlide");
const duplicateSlide = document.querySelector("#duplicateSlide");
const slideList = document.querySelector("#slideList");
const slideTranslateSource = document.querySelector("#slideTranslateSource");
const slideTranslateTarget = document.querySelector("#slideTranslateTarget");
const translateSlideButton = document.querySelector("#translateSlide");
const drawToolButtons = [...document.querySelectorAll("[data-draw-tool]")];
const strokeColor = document.querySelector("#strokeColor");
const strokeWidth = document.querySelector("#strokeWidth");
const chooseSlideVideo = document.querySelector("#chooseSlideVideo");
const clearSlideVideo = document.querySelector("#clearSlideVideo");
const slideVideoInfo = document.querySelector("#slideVideoInfo");
const videoFitButtons = [...document.querySelectorAll("[data-video-fit]")];
const videoFrameRatioButtons = [...document.querySelectorAll("[data-video-frame-ratio]")];
const chooseSlideSound = document.querySelector("#chooseSlideSound");
const clearSlideSound = document.querySelector("#clearSlideSound");
const slideSoundInfo = document.querySelector("#slideSoundInfo");
const dynamicSlidePreview = document.querySelector("#dynamicSlidePreview");
const gitTypingControls = document.querySelector("#gitTypingControls");
const chatTypingControls = document.querySelector("#chatTypingControls");
const dynamicContinueAfterTts = document.querySelector("#dynamicContinueAfterTts");
const canvasSlideHint = document.querySelector("#canvasSlideHint");
const chooseGitRepo = document.querySelector("#chooseGitRepo");
const gitRepoPath = document.querySelector("#gitRepoPath");
const gitSlideTitle = document.querySelector("#gitSlideTitle");
const gitCommitSelect = document.querySelector("#gitCommitSelect");
const gitFileSelect = document.querySelector("#gitFileSelect");
const gitTypingSpeed = document.querySelector("#gitTypingSpeed");
const gitTypingContent = document.querySelector("#gitTypingContent");
const chatSlideTitle = document.querySelector("#chatSlideTitle");
const chatTypingSpeed = document.querySelector("#chatTypingSpeed");
const chatTextScaleButtons = [...document.querySelectorAll("[data-chat-text-scale]")];
const chatQuestion = document.querySelector("#chatQuestion");
const chatAnswer = document.querySelector("#chatAnswer");
const exportModal = document.querySelector("#exportModal");
const exportModalPhase = document.querySelector("#exportModalPhase");
const exportProgress = document.querySelector("#exportProgress");
const exportModalStatus = document.querySelector("#exportModalStatus");
const cancelExport = document.querySelector("#cancelExport");
const appSettings = document.querySelector("#appSettings");
const closeAppSettings = document.querySelector("#closeAppSettings");
const saveAppSettingsButton = document.querySelector("#saveAppSettings");
const settingsOpenAiApiKey = document.querySelector("#settingsOpenAiApiKey");
const settingsMiniMaxApiKey = document.querySelector("#settingsMiniMaxApiKey");
const settingsCanvasWidth = document.querySelector("#settingsCanvasWidth");
const settingsCanvasHeight = document.querySelector("#settingsCanvasHeight");
const settingsCanvasColor = document.querySelector("#settingsCanvasColor");
const settingsSafeAreaSnapEnabled = document.querySelector("#settingsSafeAreaSnapEnabled");
const settingsSafeAreaPresetButtons = [...document.querySelectorAll("[data-safe-area-preset]")];
const settingsTtsProvider = document.querySelector("#settingsTtsProvider");
const settingsTtsModel = document.querySelector("#settingsTtsModel");
const settingsTtsVoice = document.querySelector("#settingsTtsVoice");
const settingsTtsVoiceSuggestions = document.querySelector("#ttsVoiceSuggestions");
const settingsTtsSpeed = document.querySelector("#settingsTtsSpeed");
const settingsTtsInstructions = document.querySelector("#settingsTtsInstructions");
const settingsSubtitleEnabled = document.querySelector("#settingsSubtitleEnabled");
const settingsSubtitleSize = document.querySelector("#settingsSubtitleSize");
const settingsSubtitleY = document.querySelector("#settingsSubtitleY");
const settingsSubtitleStyleButtons = [...document.querySelectorAll("[data-subtitle-style-mode]")];
const settingsSubtitleFontButtons = [...document.querySelectorAll("[data-subtitle-font]")];
let settingsSubtitleStickerButtons = [...document.querySelectorAll("[data-subtitle-text-effect]")];
const settingsSubtitleFontLabel = document.querySelector(".settings-subtitle-font-label");
const settingsSubtitleStickerLabel = document.querySelector(".settings-subtitle-sticker-label");
const settingsSubtitleFontGroup = document.querySelector("#settingsSubtitleFont");
const settingsSubtitleStickerGroup = document.querySelector("#settingsSubtitleSticker");
const settingsExportDir = document.querySelector("#settingsExportDir");
const chooseExportDir = document.querySelector("#chooseExportDir");
const resetExportDir = document.querySelector("#resetExportDir");

const selectedPanel = document.querySelector(".selected-panel");
const selectedSections = Object.fromEntries(
  [...selectedPanel.querySelectorAll("[data-selection-section]")].map((section) => [section.dataset.selectionSection, section])
);
const selectedX = document.querySelector("#selectedX");
const selectedY = document.querySelector("#selectedY");
const selectedW = document.querySelector("#selectedW");
const selectedH = document.querySelector("#selectedH");
const selectedR = document.querySelector("#selectedR");
const selectedAspectLock = document.querySelector("#selectedAspectLock");
let aspectRatioLocked = false;
const selectedMoveFromX = document.querySelector("#selectedMoveFromX");
const selectedMoveFromY = document.querySelector("#selectedMoveFromY");
const selectedMoveToX = document.querySelector("#selectedMoveToX");
const selectedMoveToY = document.querySelector("#selectedMoveToY");
const selectedMoveDuration = document.querySelector("#selectedMoveDuration");
const selectedAnimationInDelay = document.querySelector("#selectedAnimationInDelay");
const selectedTextSize = document.querySelector("#selectedTextSize");
const imageFlipButtons = [...document.querySelectorAll("[data-image-flip]")];
const textSizeButtons = [...document.querySelectorAll("[data-text-size]")];
const textFontButtons = [...document.querySelectorAll("[data-text-font]")];
const textWeightButtons = [...document.querySelectorAll("[data-text-weight]")];
let textStyleButtons = [...document.querySelectorAll("[data-text-style]")];
const textAlignButtons = [...document.querySelectorAll("[data-text-align]")];
const animationInButtons = [...document.querySelectorAll("[data-animation-in]")];
const animationLoopButtons = [...document.querySelectorAll("[data-animation-loop]")];
const animationSpeedButtons = [...document.querySelectorAll("[data-animation-speed]")];
const animationMoveButtons = [...document.querySelectorAll("[data-animation-move]")];
const animationMoveEasingButtons = [...document.querySelectorAll("[data-animation-move-easing]")];
const animationMovePointButtons = [...document.querySelectorAll("[data-animation-move-point]")];
const selectedTextColor = document.querySelector("#selectedTextColor");
const duplicateSelected = document.querySelector("#duplicateSelected");
const editSelectedText = document.querySelector("#editSelectedText");
const deleteSelected = document.querySelector("#deleteSelected");
const selectedActions = document.querySelector(".selected-actions");
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
let slideDragState = null;
let slideClickSuppressUntil = 0;
let currentDrawTool = "select";
let activeShapeDraft = null;
let historyStack = [];
let historyIndex = -1;
const slidePreviewCache = new Map();
let isRestoringHistory = false;
let statusTimer = null;
let defaultTextColor = "#000000";
let activeProjectId = null;
let activeProjectName = "Untitled";
let nativeProjects = [];
let nativeSaveTimer = null;
let nativeSavePromise = null;
let nativeSaveQueued = false;
let nativeDraftDirty = false;
let isLoadingNativeProject = false;
let lastSaveState = "Ready";
let activeTextEditObject = null;
let textEditButtonHandledPointer = false;
const textMeasureCanvas = document.createElement("canvas");
const textMeasureContext = textMeasureCanvas.getContext("2d");
let canvasViewScale = 1;
let appSettingsState = {
  openAiApiKey: "",
  miniMaxApiKey: "",
};
let isTranslatingSlide = false;
let defaultProjectExportDir = "";
let objectAnimationPreviewFrame = null;
let objectAnimationPreviewStart = 0;
let projectSettingsState = {
  canvasWidth: 1280,
  canvasHeight: 720,
  canvasColor: "#ffffff",
  ttsProvider: "openai",
  ttsModel: "gpt-4o-mini-tts",
  ttsVoice: "sage",
  ttsSpeed: 1.12,
  ttsInstructions:
    "Read the input text naturally as written. For Korean text, keep pronunciation clear and natural. Keep the pacing conversational, warm, and not exaggerated.",
  subtitleEnabled: true,
  subtitleSize: 100,
  subtitleY: 90,
  subtitleStyleMode: "standard",
  subtitleFontFamily: "Pretendard",
  subtitleFontWeight: 700,
  subtitleTextEffect: "boldCaption",
  safeAreaSnapEnabled: false,
  safeAreaPreset: "reelsShorts",
  exportDir: "",
  backgroundMusic: null,
};
let activeExportJob = null;

const TEXT_PADDING_X = 10;
const TEXT_PADDING_Y = 8;
const TEXT_SIZE_PRESETS = {
  h4: { fontSize: 20, lineHeight: 25 },
  h3: { fontSize: 28, lineHeight: 35 },
  h2: { fontSize: 40, lineHeight: 50 },
  h1: { fontSize: 56, lineHeight: 70 },
  h0: { fontSize: 80, lineHeight: 100 },
  h00: { fontSize: 112, lineHeight: 140 },
};
const TEXT_ALIGNMENTS = new Set(["left", "center", "right"]);
const DEFAULT_TEXT_COLOR = "#000000";
const DEFAULT_TEXT_FONT_FAMILY = "Pretendard";
const DEFAULT_TEXT_FONT_WEIGHT = 600;
const DEFAULT_TEXT_EFFECT = "boldCaption";
const DEFAULT_SUBTITLE_FONT_FAMILY = "Pretendard";
const DEFAULT_SUBTITLE_FONT_WEIGHT = 700;
const DEFAULT_SUBTITLE_STYLE_MODE = "standard";
const DEFAULT_SUBTITLE_TEXT_EFFECT = "boldCaption";
const SUBTITLE_STYLE_MODES = new Set(["standard", "sticker"]);
const TEXT_FONT_FAMILIES = new Set([
  "Pretendard",
  "Gmarket Sans",
  "Jua",
  "Black Han Sans",
  "Noto Sans KR",
  "Gaegu",
  "Gamja Flower",
  "Nanum Pen Script",
  "Mona12",
  "학교안심 봄방학",
  "Gowun Dodum",
  "Gowun Batang",
  "Poor Story",
  "Bagel Fat One",
]);
const FONT_LOAD_SAMPLE_TEXT = "가나다라마바사아자차카타파하 ABC xyz 123";
const TEXT_FONT_LOAD_SIZE = 32;
const textFontLoadPromises = new Map();
const DEFAULT_VIDEO_FIT = "fill";
const VIDEO_FIT_MODES = {
  fill: { label: "Fill", objectFit: "cover" },
  fit: { label: "Fit", objectFit: "contain" },
  stretch: { label: "Stretch", objectFit: "fill" },
};
const DEFAULT_VIDEO_FRAME_RATIO = "canvas";
const VIDEO_FRAME_RATIO_MODES = {
  canvas: { label: "Full", ratio: null },
  "1:1": { label: "1:1", ratio: 1 },
  "3:4": { label: "3:4", ratio: 3 / 4 },
  "4:3": { label: "4:3", ratio: 4 / 3 },
};
const TEXT_EFFECT_PRESETS = {
  cleanCaption: {
    label: "Clean Caption",
    fontFamily: "Pretendard",
    fontWeight: 600,
    fillColor: "#ffffff",
    shadowColor: "rgba(8, 12, 22, 0.55)",
    shadowBlur: 10,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
  },
  boldCaption: {
    label: "Bold Caption",
    fontFamily: "Noto Sans KR",
    fontWeight: 700,
    fillColor: "#ffffff",
    strokeColor: "#09090d",
    strokeWidth: 7,
    shadowColor: "rgba(0, 0, 0, 0.34)",
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 3,
  },
  popPunch: {
    label: "Pop Punch",
    fontFamily: "Gmarket Sans",
    fontWeight: 700,
    fillColor: "#ffffff",
    strokeColor: "#101015",
    strokeWidth: 5,
    shadowLayerColor: "#ffd83d",
    shadowLayerStrokeWidth: 7,
    shadowLayerOffsetX: 5,
    shadowLayerOffsetY: 6,
  },
  candyBubble: {
    label: "Candy Sticker",
    fontFamily: "Bagel Fat One",
    fontWeight: 400,
    fillColor: "#ff5ca8",
    fillGradient: {
      direction: "vertical",
      stops: [
        { offset: 0, color: "#ff9fd0" },
        { offset: 0.48, color: "#ff5ca8" },
        { offset: 1, color: "#f42f96" },
      ],
    },
    strokeColor: "#ffffff",
    strokeWidth: 6,
    shadowLayerColor: "#6b1f8f",
    shadowLayerStrokeWidth: 8,
    shadowLayerOffsetX: 6,
    shadowLayerOffsetY: 7,
    decorations: [
      { type: "sparkle", phase: "front", count: 5, colors: ["#ffffff", "#ffd7f2"] },
    ],
    decorationOutsetX: 18,
    decorationOutsetY: 18,
  },
  pixelBadge: {
    label: "Pixel Badge",
    fontFamily: "Mona12",
    fontWeight: 700,
    fillColor: "#f8fff4",
    backgroundColor: "#172033",
    backgroundStrokeColor: "#f5f3c3",
    backgroundStrokeWidth: 3,
    backgroundPaddingX: 18,
    backgroundPaddingY: 10,
    backgroundRadius: 2,
    shadowColor: "rgba(0, 0, 0, 0.92)",
    shadowBlur: 0,
    shadowOffsetX: 6,
    shadowOffsetY: 6,
  },
  doodleNote: {
    label: "Doodle Note",
    fontFamily: "Gaegu",
    fontWeight: 700,
    fillColor: "#ffffff",
    strokeColor: "#1c1c24",
    strokeWidth: 3,
    shadowLayerColor: "#ff7aa8",
    shadowLayerStrokeWidth: 4.5,
    shadowLayerOffsetX: 3,
    shadowLayerOffsetY: 4,
  },
  postItNote: {
    label: "Post-it Note",
    fontFamily: "Gowun Dodum",
    fontWeight: 400,
    fillColor: "#4b371b",
    backgroundColor: "#ffea70",
    backgroundStrokeColor: "#f1c847",
    backgroundStrokeWidth: 2,
    backgroundPaddingX: 24,
    backgroundPaddingY: 15,
    backgroundRadius: 3,
    shadowColor: "rgba(92, 69, 22, 0.26)",
    shadowBlur: 0,
    shadowOffsetX: 6,
    shadowOffsetY: 7,
    decorations: [
      { type: "stripe", phase: "overBackground", color: "rgba(255, 255, 255, 0.18)", stripeWidth: 8, spacing: 26 },
    ],
    decorationOutsetX: 10,
    decorationOutsetY: 12,
  },
  impactHeadline: {
    label: "Impact Headline",
    fontFamily: "Black Han Sans",
    fontWeight: 400,
    fillColor: "#fff32e",
    strokeColor: "#111015",
    strokeWidth: 4,
    shadowLayerColor: "#ff3f3f",
    shadowLayerStrokeWidth: 6,
    shadowLayerOffsetX: 5,
    shadowLayerOffsetY: 6,
  },
  bubbleBounce: {
    label: "Bubble Bounce",
    fontFamily: "Jua",
    fontWeight: 400,
    fillColor: "#ffffff",
    strokeColor: "#1f74df",
    strokeWidth: 6,
    shadowLayerColor: "#56b5ff",
    shadowLayerStrokeWidth: 8,
    shadowLayerOffsetX: 4,
    shadowLayerOffsetY: 6,
  },
  flowerPoem: {
    label: "Poetry Page",
    fontFamily: "Gowun Batang",
    fontWeight: 400,
    fillColor: "#5d4a68",
    backgroundColor: "rgba(255, 252, 246, 0.94)",
    backgroundStrokeColor: "#e2d4e8",
    backgroundStrokeWidth: 1.5,
    backgroundPaddingX: 24,
    backgroundPaddingY: 15,
    backgroundRadius: 6,
    shadowColor: "rgba(82, 65, 91, 0.14)",
    shadowBlur: 14,
    shadowOffsetX: 0,
    shadowOffsetY: 6,
  },
  neonChromatic: {
    label: "Neon Chromatic",
    fontFamily: "Gmarket Sans",
    fontWeight: 700,
    fillColor: "#ffffff",
    strokeColor: "#101015",
    strokeWidth: 4,
    offsetLayers: [
      { color: "#00d9ff", strokeWidth: 6, offsetX: -6, offsetY: 0 },
      { color: "#ff2bbd", strokeWidth: 6, offsetX: 6, offsetY: 0 },
    ],
    glowLayers: [
      { color: "rgba(255, 48, 198, 0.45)", blur: 8 },
      { color: "rgba(0, 217, 255, 0.35)", blur: 10 },
    ],
    decorationOutsetX: 18,
    decorationOutsetY: 14,
  },
  hotPinkNeon: {
    label: "Hot Pink Neon",
    fontFamily: "Black Han Sans",
    fontWeight: 400,
    fillColor: "#151018",
    strokeColor: "#ffffff",
    strokeWidth: 4,
    shadowLayerColor: "#ff1ebd",
    shadowLayerStrokeWidth: 13,
    shadowLayerOffsetX: 0,
    shadowLayerOffsetY: 0,
    glowLayers: [
      { color: "rgba(255, 30, 189, 0.7)", blur: 14 },
      { color: "rgba(255, 30, 189, 0.42)", blur: 24 },
    ],
    decorationOutsetX: 24,
    decorationOutsetY: 24,
  },
  sparklePop: {
    label: "Sparkle Pop",
    fontFamily: "학교안심 봄방학",
    fontWeight: 400,
    fillColor: "#ff70b6",
    strokeColor: "#fff4f9",
    strokeWidth: 6,
    shadowLayerColor: "#7c2ce0",
    shadowLayerStrokeWidth: 10,
    shadowLayerOffsetX: 5,
    shadowLayerOffsetY: 6,
    decorations: [
      { type: "sparkle", phase: "front", count: 5, colors: ["#ffffff", "#ffd7f2", "#fff35f"], spread: 22, heroSize: 10, satelliteSize: 4 },
    ],
    decorationOutsetX: 28,
    decorationOutsetY: 28,
  },
  graffitiTag: {
    label: "Graffiti Tag",
    fontFamily: "Bagel Fat One",
    fontWeight: 400,
    fillColor: "#fff42c",
    fillGradient: {
      direction: "horizontal",
      stops: [
        { offset: 0, color: "#fff42c" },
        { offset: 0.48, color: "#38ff5f" },
        { offset: 1, color: "#ff2dac" },
      ],
    },
    strokeColor: "#101015",
    strokeWidth: 7,
    offsetLayers: [
      { color: "#25f06d", strokeWidth: 10, offsetX: -5, offsetY: 5 },
      { color: "#ff2dac", strokeWidth: 8, offsetX: 5, offsetY: -4 },
    ],
    shadowLayerColor: "#111015",
    shadowLayerStrokeWidth: 9,
    shadowLayerOffsetX: 4,
    shadowLayerOffsetY: 6,
  },
  goldGlow: {
    label: "Gold Glow",
    fontFamily: "Noto Sans KR",
    fontWeight: 700,
    fillColor: "#ffd84d",
    fillGradient: {
      direction: "vertical",
      stops: [
        { offset: 0, color: "#fff7a8" },
        { offset: 0.42, color: "#ffd241" },
        { offset: 1, color: "#f07b19" },
      ],
    },
    strokeColor: "#3f2500",
    strokeWidth: 6,
    glowLayers: [
      { color: "rgba(255, 214, 55, 0.54)", blur: 12 },
      { color: "rgba(255, 142, 24, 0.34)", blur: 22 },
    ],
    shadowColor: "rgba(0, 0, 0, 0.48)",
    shadowBlur: 4,
    shadowOffsetX: 3,
    shadowOffsetY: 5,
    decorationOutsetX: 24,
    decorationOutsetY: 24,
  },
  retro3d: {
    label: "Retro 3D",
    fontFamily: "Gmarket Sans",
    fontWeight: 700,
    fillColor: "#ff922d",
    strokeColor: "#3a1a0c",
    strokeWidth: 5,
    offsetLayers: [
      { color: "#b85a2e", strokeWidth: 6, offsetX: 4, offsetY: 5 },
      { color: "#2a1107", strokeWidth: 5, offsetX: 8, offsetY: 9 },
    ],
    shadowColor: "rgba(0, 0, 0, 0.32)",
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 3,
    decorationOutsetX: 22,
    decorationOutsetY: 24,
  },
  iceGlow: {
    label: "Ice Glow",
    fontFamily: "Noto Sans KR",
    fontWeight: 700,
    fillColor: "#84eaff",
    fillGradient: {
      direction: "vertical",
      stops: [
        { offset: 0, color: "#f0feff" },
        { offset: 0.55, color: "#72dfff" },
        { offset: 1, color: "#2882ff" },
      ],
    },
    strokeColor: "#ffffff",
    strokeWidth: 5,
    shadowLayerColor: "#1358d8",
    shadowLayerStrokeWidth: 8,
    shadowLayerOffsetX: 4,
    shadowLayerOffsetY: 6,
    glowLayers: [
      { color: "rgba(90, 230, 255, 0.52)", blur: 12 },
      { color: "rgba(36, 125, 255, 0.32)", blur: 20 },
    ],
    decorationOutsetX: 24,
    decorationOutsetY: 26,
  },
  tapePatch: {
    label: "Tape Patch",
    fontFamily: "Nanum Pen Script",
    fontWeight: 400,
    fillColor: "#3a1530",
    strokeColor: "#71315d",
    strokeWidth: 1.5,
    shadowColor: "rgba(68, 28, 52, 0.22)",
    shadowBlur: 4,
    shadowOffsetX: 0,
    shadowOffsetY: 3,
    decorations: [
      { type: "tape", colors: ["rgba(255, 128, 186, 0.92)", "rgba(255, 236, 167, 0.9)"], rotate: -5 },
    ],
    decorationOutsetX: 22,
    decorationOutsetY: 18,
  },
  warningBadge: {
    label: "Warning Badge",
    fontFamily: "Black Han Sans",
    fontWeight: 400,
    fillColor: "#111015",
    backgroundColor: "#ffde35",
    backgroundStrokeColor: "#111015",
    backgroundStrokeWidth: 4,
    backgroundPaddingX: 20,
    backgroundPaddingY: 12,
    backgroundRadius: 4,
    shadowColor: "rgba(0, 0, 0, 0.42)",
    shadowBlur: 0,
    shadowOffsetX: 5,
    shadowOffsetY: 6,
    decorations: [
      { type: "stripe", phase: "overBackground", color: "rgba(17, 16, 21, 0.14)", stripeWidth: 10, spacing: 24 },
    ],
    decorationOutsetX: 10,
    decorationOutsetY: 12,
  },
  sunsetGradient: {
    label: "Sunset Gradient",
    fontFamily: "Bagel Fat One",
    fontWeight: 400,
    fillColor: "#ff8d3d",
    fillGradient: {
      direction: "horizontal",
      stops: [
        { offset: 0, color: "#fff06a" },
        { offset: 0.45, color: "#ff8b3d" },
        { offset: 1, color: "#ff3fa6" },
      ],
    },
    strokeColor: "#fff6e5",
    strokeWidth: 6,
    shadowLayerColor: "#5f238a",
    shadowLayerStrokeWidth: 9,
    shadowLayerOffsetX: 5,
    shadowLayerOffsetY: 7,
    decorationOutsetX: 20,
    decorationOutsetY: 22,
  },
  aquaGradient: {
    label: "Aqua Gradient",
    fontFamily: "Jua",
    fontWeight: 400,
    fillColor: "#50e3d4",
    fillGradient: {
      direction: "horizontal",
      stops: [
        { offset: 0, color: "#e3fff8" },
        { offset: 0.5, color: "#55e7d4" },
        { offset: 1, color: "#42a5ff" },
      ],
    },
    strokeColor: "#ffffff",
    strokeWidth: 5,
    shadowLayerColor: "#0d6a80",
    shadowLayerStrokeWidth: 8,
    shadowLayerOffsetX: 4,
    shadowLayerOffsetY: 6,
    decorationOutsetX: 20,
    decorationOutsetY: 22,
  },
  blueNeon: {
    label: "Blue Neon",
    fontFamily: "Gmarket Sans",
    fontWeight: 700,
    fillColor: "#eaffff",
    strokeColor: "#0d1638",
    strokeWidth: 4,
    shadowLayerColor: "#2388ff",
    shadowLayerStrokeWidth: 9,
    shadowLayerOffsetX: 0,
    shadowLayerOffsetY: 0,
    glowLayers: [
      { color: "rgba(54, 186, 255, 0.68)", blur: 12 },
      { color: "rgba(29, 92, 255, 0.42)", blur: 24 },
    ],
    decorationOutsetX: 24,
    decorationOutsetY: 24,
  },
  limeNeon: {
    label: "Lime Neon",
    fontFamily: "Mona12",
    fontWeight: 700,
    fillColor: "#dcff3f",
    strokeColor: "#061307",
    strokeWidth: 4,
    shadowLayerColor: "#24ff6b",
    shadowLayerStrokeWidth: 9,
    shadowLayerOffsetX: 0,
    shadowLayerOffsetY: 0,
    glowLayers: [
      { color: "rgba(73, 255, 96, 0.66)", blur: 12 },
      { color: "rgba(190, 255, 35, 0.36)", blur: 22 },
    ],
    decorationOutsetX: 24,
    decorationOutsetY: 24,
  },
  auroraNeon: {
    label: "Aurora Neon",
    fontFamily: "Pretendard",
    fontWeight: 800,
    fillColor: "#9bfffb",
    fillGradient: {
      direction: "horizontal",
      stops: [
        { offset: 0, color: "#8ffcff" },
        { offset: 0.42, color: "#ff8cff" },
        { offset: 1, color: "#fff66d" },
      ],
    },
    strokeColor: "#111015",
    strokeWidth: 5,
    offsetLayers: [
      { color: "#00d7ff", strokeWidth: 7, offsetX: -4, offsetY: 5 },
      { color: "#ff2bd6", strokeWidth: 7, offsetX: 5, offsetY: -4 },
    ],
    glowLayers: [
      { color: "rgba(0, 226, 255, 0.48)", blur: 14 },
      { color: "rgba(255, 43, 214, 0.38)", blur: 22 },
    ],
    decorationOutsetX: 28,
    decorationOutsetY: 28,
  },
  prismNeon: {
    label: "Prism Neon",
    fontFamily: "Bagel Fat One",
    fontWeight: 400,
    fillColor: "#ffffff",
    fillGradient: {
      direction: "horizontal",
      stops: [
        { offset: 0, color: "#ff315f" },
        { offset: 0.28, color: "#ffd23a" },
        { offset: 0.55, color: "#35ff89" },
        { offset: 0.78, color: "#2fd9ff" },
        { offset: 1, color: "#b65cff" },
      ],
    },
    strokeColor: "#ffffff",
    strokeWidth: 5,
    shadowLayerColor: "#151043",
    shadowLayerStrokeWidth: 9,
    shadowLayerOffsetX: 5,
    shadowLayerOffsetY: 7,
    glowLayers: [
      { color: "rgba(47, 217, 255, 0.38)", blur: 12 },
      { color: "rgba(255, 49, 95, 0.28)", blur: 18 },
    ],
    decorations: [
      { type: "sparkle", phase: "front", count: 8, colors: ["#ffffff", "#fff35f", "#8de6ff"], spread: 18 },
    ],
    decorationOutsetX: 26,
    decorationOutsetY: 26,
  },
};
const TEXT_EFFECT_ALIASES = {
  schoolSticker: "candyBubble",
  softDiary: "postItNote",
};
const TEXT_EFFECT_OPTIONS = Object.keys(TEXT_EFFECT_PRESETS);
let subtitleSettingsRowHeightFrame = 0;
let subtitleSettingsRowResizeObserver = null;

function setSubtitleSettingsRowHeight(label, group) {
  if (!label || !group) {
    return;
  }
  if (label.hidden) {
    label.style.removeProperty("--settings-subtitle-row-height");
    return;
  }

  const labelText = label.querySelector(":scope > span:first-child");
  const labelTextStyle = labelText ? window.getComputedStyle(labelText) : null;
  const labelTextHeight = labelText
    ? Math.ceil(labelText.getBoundingClientRect().height + numberOr(parseFloat(labelTextStyle?.paddingTop), 0))
    : 0;
  const groupHeight = Math.ceil(group.getBoundingClientRect().height || group.scrollHeight || 0);
  label.style.setProperty("--settings-subtitle-row-height", `${Math.max(26, labelTextHeight, groupHeight)}px`);
}

function updateSubtitleSettingsRowHeights() {
  subtitleSettingsRowHeightFrame = 0;
  if (appSettings.hidden) {
    return;
  }
  setSubtitleSettingsRowHeight(settingsSubtitleFontLabel, settingsSubtitleFontGroup);
  setSubtitleSettingsRowHeight(settingsSubtitleStickerLabel, settingsSubtitleStickerGroup);
}

function scheduleSubtitleSettingsRowHeightUpdate() {
  if (subtitleSettingsRowHeightFrame) {
    window.cancelAnimationFrame(subtitleSettingsRowHeightFrame);
  }
  subtitleSettingsRowHeightFrame = window.requestAnimationFrame(updateSubtitleSettingsRowHeights);
}

function observeSubtitleSettingsRows() {
  if (typeof ResizeObserver === "undefined" || subtitleSettingsRowResizeObserver) {
    return;
  }
  subtitleSettingsRowResizeObserver = new ResizeObserver(() => scheduleSubtitleSettingsRowHeightUpdate());
  if (settingsSubtitleFontGroup) {
    subtitleSettingsRowResizeObserver.observe(settingsSubtitleFontGroup);
  }
  if (settingsSubtitleStickerGroup) {
    subtitleSettingsRowResizeObserver.observe(settingsSubtitleStickerGroup);
  }
}

const TEXT_EFFECT_PREVIEW_TEXT = "ART";
const TEXT_EFFECT_PREVIEW_WIDTH = 300;
const TEXT_EFFECT_PREVIEW_HEIGHT = 170;
const TEXT_EFFECT_PREVIEW_FONT_SIZE = 40;
const TEXT_EFFECT_PREVIEW_LINE_HEIGHT = 50;

function createTextEffectButton(effectKey, datasetKey) {
  const preset = TEXT_EFFECT_PRESETS[effectKey] || TEXT_EFFECT_PRESETS[DEFAULT_TEXT_EFFECT];
  const button = document.createElement("button");
  button.type = "button";
  button.dataset[datasetKey] = effectKey;
  button.title = preset.label || effectKey;
  button.setAttribute("aria-label", preset.label || effectKey);
  const previewCanvas = document.createElement("canvas");
  previewCanvas.className = "text-effect-preview-canvas";
  previewCanvas.dataset.textEffectPreviewCanvas = "true";
  previewCanvas.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.className = "text-effect-preview-label";
  label.textContent = preset.label || effectKey;
  button.replaceChildren(previewCanvas, label);
  return button;
}

function getTextEffectPreviewButtons() {
  return [
    ...document.querySelectorAll("[data-text-style]"),
    ...document.querySelectorAll("[data-subtitle-text-effect]"),
  ];
}

function renderTextEffectButtonPreview(button) {
  const effectKey = button.dataset.textStyle || button.dataset.subtitleTextEffect;
  const canvas = button.querySelector("[data-text-effect-preview-canvas]");
  if (!effectKey || !canvas) {
    return;
  }

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(TEXT_EFFECT_PREVIEW_WIDTH * pixelRatio);
  canvas.height = Math.round(TEXT_EFFECT_PREVIEW_HEIGHT * pixelRatio);
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  const context = canvas.getContext("2d");
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawTextLines(
    context,
    TEXT_EFFECT_PREVIEW_TEXT,
    TEXT_EFFECT_PREVIEW_WIDTH,
    TEXT_EFFECT_PREVIEW_HEIGHT,
    true,
    "h3",
    "center",
    {
      textEffect: effectKey,
      fontSize: TEXT_EFFECT_PREVIEW_FONT_SIZE,
      lineHeight: TEXT_EFFECT_PREVIEW_LINE_HEIGHT,
    }
  );
}

function renderTextEffectButtonPreviews() {
  for (const button of getTextEffectPreviewButtons()) {
    renderTextEffectButtonPreview(button);
  }
}

function getTextEffectPreviewFontRequests() {
  return TEXT_EFFECT_OPTIONS.map((effectKey) => {
    const preset = TEXT_EFFECT_PRESETS[effectKey] || TEXT_EFFECT_PRESETS[DEFAULT_TEXT_EFFECT];
    return {
      family: sanitizeTextFontFamily(preset.fontFamily),
      weight: sanitizeTextFontWeight(preset.fontWeight),
    };
  });
}

async function refreshTextEffectButtonPreviews() {
  renderTextEffectButtonPreviews();
  await ensureTextFontsReady(getTextEffectPreviewFontRequests());
  renderTextEffectButtonPreviews();
}

function applyFontPreviewToButtons(buttons) {
  for (const button of buttons) {
    const family = button.dataset.textFont || button.dataset.subtitleFont;
    if (!family) continue;
    const weight = button.dataset.textFontWeight || button.dataset.subtitleFontWeight;
    button.style.fontFamily = `"${family}", var(--font-ui)`;
    if (weight) button.style.fontWeight = weight;
  }
}

function applyTextWeightPreviewToButtons(buttons) {
  for (const button of buttons) {
    button.style.fontWeight = String(sanitizeTextFontWeight(button.dataset.textWeight));
  }
}

function renderTextEffectButtons() {
  const textStyleContainer = document.querySelector("#selectedTextStyle");
  const subtitleStickerContainer = document.querySelector("#settingsSubtitleSticker");

  if (textStyleContainer) {
    textStyleContainer.replaceChildren(
      ...TEXT_EFFECT_OPTIONS.map((effectKey) => createTextEffectButton(effectKey, "textStyle"))
    );
    textStyleButtons = [...textStyleContainer.querySelectorAll("[data-text-style]")];
  }

  if (subtitleStickerContainer) {
    subtitleStickerContainer.replaceChildren(
      ...TEXT_EFFECT_OPTIONS.map((effectKey) => createTextEffectButton(effectKey, "subtitleTextEffect"))
    );
    settingsSubtitleStickerButtons = [
      ...subtitleStickerContainer.querySelectorAll("[data-subtitle-text-effect]"),
    ];
  }
  scheduleSubtitleSettingsRowHeightUpdate();
}

applyFontPreviewToButtons(document.querySelectorAll("[data-text-font], [data-subtitle-font]"));
applyTextWeightPreviewToButtons(textWeightButtons);
observeSubtitleSettingsRows();
const DEFAULT_CANVAS_WIDTH = 1280;
const DEFAULT_CANVAS_HEIGHT = 720;
const DEFAULT_CANVAS_COLOR = "#ffffff";
const DEFAULT_SAFE_AREA_SNAP_ENABLED = false;
const DEFAULT_SAFE_AREA_PRESET = "reelsShorts";
const SAFE_AREA_PRESETS = {
  reelsShorts: {
    label: "Reels / Shorts",
    canonicalWidth: 1080,
    canonicalHeight: 1920,
    margins: { left: 90, top: 140, right: 180, bottom: 440 },
  },
  youtubeVideo: {
    label: "YouTube 16:9",
    canonicalWidth: 1920,
    canonicalHeight: 1080,
    margins: { left: 192, top: 108, right: 192, bottom: 108 },
  },
};
const SAFE_AREA_PRESET_KEYS = new Set(Object.keys(SAFE_AREA_PRESETS));
const COLOR_PRESETS = {
  light: { canvasColor: "#ffffff", textColor: "#000000" },
  dark: { canvasColor: "#000000", textColor: "#ffffff" },
};
const IMAGE_IMPORT_MAX_DIMENSION = 1920;
const IMAGE_IMPORT_JPEG_QUALITY = 0.88;
const DEFAULT_STROKE_COLOR = "#ff0000";
const DEFAULT_STROKE_WIDTH = 4;
const SHAPE_KINDS = new Set(["line", "arrow", "pen"]);
const SHAPE_DRAW_PADDING = 14;
const MIN_SHAPE_DRAW_DISTANCE = 5;
const DEFAULT_ANIMATION_IN = "none";
const DEFAULT_ANIMATION_LOOP = "none";
const DEFAULT_ANIMATION_OUT = "none";
const DEFAULT_ANIMATION_SPEED = "normal";
const DEFAULT_ANIMATION_MOVE = "none";
const DEFAULT_ANIMATION_MOVE_EASING = "linear";
const DEFAULT_ANIMATION_MOVE_DURATION = 2;
const DEFAULT_ANIMATION_IN_DELAY = 0;
const ANIMATION_IN_PRESETS = {
  none: { label: "None" },
  fade: { label: "Fade" },
  pop: { label: "Pop" },
  slideUp: { label: "Slide Up" },
};
const ANIMATION_IN_DURATIONS = {
  none: 0,
  fade: 0.45,
  pop: 0.45,
  slideUp: 0.5,
};
const ANIMATION_LOOP_PRESETS = {
  none: { label: "None" },
  spin: { label: "Spin" },
  shake: { label: "Shake" },
  pulse: { label: "Pulse" },
  blink: { label: "Blink" },
  float: { label: "Float" },
};
const ANIMATION_LOOP_PERIOD_SECONDS = {
  spin: 4,
  shake: 0.36,
  pulse: 1.2,
  blink: 1,
  float: 2.4,
};
const ANIMATION_SPEED_PRESETS = {
  slow: { label: "Slow" },
  normal: { label: "Normal" },
  fast: { label: "Fast" },
};
const ANIMATION_MOVE_PRESETS = {
  none: { label: "None" },
  move: { label: "Move" },
};
const ANIMATION_MOVE_EASINGS = {
  linear: { label: "Linear" },
  easeOut: { label: "Ease Out" },
  easeInOut: { label: "Smooth" },
};
const ANIMATION_SPEED_PERIOD_FACTORS = {
  slow: 1.5,
  normal: 1,
  fast: 0.65,
};
const MOVE_SNAP_SCREEN_THRESHOLD = 10;
const SVG_NS = "http://www.w3.org/2000/svg";
const PROJECT_FORMAT = "slide-cut-project";
const PROJECT_VERSION = 2;
const HISTORY_LIMIT = 80;
const SLIDE_PREVIEW_CACHE_LIMIT = 160;
const SLIDE_PREVIEW_WIDTH = 144;
const SLIDE_PREVIEW_HEIGHT = 81;
const NATIVE_SAVE_DEBOUNCE_MS = 1600;
const SLIDE_DRAG_THRESHOLD = 6;
const IS_MAC_PLATFORM = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "");
const DEFAULT_TTS_INSTRUCTIONS =
  "Read the input text naturally as written. For Korean text, keep pronunciation clear and natural. Keep the pacing conversational, warm, and not exaggerated.";
const DEFAULT_TTS_PROVIDER = "openai";
const OPENAI_TTS_MODELS = ["gpt-4o-mini-tts", "tts-1", "tts-1-hd"];
const OPENAI_TTS_VOICES = ["marin", "cedar", "coral", "nova", "alloy", "sage", "verse", "shimmer", "onyx", "echo", "fable", "ash", "ballad"];
const MINIMAX_TTS_MODELS = [
  "speech-2.8-turbo",
  "speech-2.8-hd",
  "speech-2.6-turbo",
  "speech-2.6-hd",
  "speech-02-turbo",
  "speech-02-hd",
  "speech-01-turbo",
  "speech-01-hd",
];
const MINIMAX_TTS_VOICES = [
  "English_expressive_narrator",
  "English_radiant_girl",
  "English_magnetic_voiced_man",
  "English_compelling_lady1",
  "English_Aussie_Bloke",
  "English_captivating_female1",
  "English_Upbeat_Woman",
  "English_Trustworth_Man",
  "English_CalmWoman",
  "English_UpsetGirl",
  "English_Gentle-voiced_man",
  "English_Whispering_girl",
  "English_Diligent_Man",
  "English_Graceful_Lady",
  "English_ReservedYoungMan",
  "English_PlayfulGirl",
  "English_ManWithDeepVoice",
  "English_MaturePartner",
  "English_FriendlyPerson",
  "English_MatureBoss",
  "English_Debator",
  "English_LovelyGirl",
  "English_Steadymentor",
  "English_Deep-VoicedGentleman",
  "English_Wiselady",
  "English_CaptivatingStoryteller",
  "English_DecentYoungMan",
  "English_SentimentalLady",
  "English_ImposingManner",
  "English_SadTeen",
  "English_PassionateWarrior",
  "English_WiseScholar",
  "English_Soft-spokenGirl",
  "English_SereneWoman",
  "English_ConfidentWoman",
  "English_PatientMan",
  "English_Comedian",
  "English_BossyLeader",
  "English_Strong-WilledBoy",
  "English_StressedLady",
  "English_AssertiveQueen",
  "English_AnimeCharacter",
  "English_Jovialman",
  "English_WhimsicalGirl",
  "English_Kind-heartedGirl",
  "Chinese (Mandarin)_Reliable_Executive",
  "Chinese (Mandarin)_News_Anchor",
  "Chinese (Mandarin)_Unrestrained_Young_Man",
  "Chinese (Mandarin)_Mature_Woman",
  "Arrogant_Miss",
  "Robot_Armor",
  "Chinese (Mandarin)_Kind-hearted_Antie",
  "Chinese (Mandarin)_HK_Flight_Attendant",
  "Chinese (Mandarin)_Humorous_Elder",
  "Chinese (Mandarin)_Gentleman",
  "Chinese (Mandarin)_Warm_Bestie",
  "Chinese (Mandarin)_Stubborn_Friend",
  "Chinese (Mandarin)_Sweet_Lady",
  "Chinese (Mandarin)_Southern_Young_Man",
  "Chinese (Mandarin)_Wise_Women",
  "Chinese (Mandarin)_Gentle_Youth",
  "Chinese (Mandarin)_Warm_Girl",
  "Chinese (Mandarin)_Male_Announcer",
  "Chinese (Mandarin)_Kind-hearted_Elder",
  "Chinese (Mandarin)_Cute_Spirit",
  "Chinese (Mandarin)_Radio_Host",
  "Chinese (Mandarin)_Lyrical_Voice",
  "Chinese (Mandarin)_Straightforward_Boy",
  "Chinese (Mandarin)_Sincere_Adult",
  "Chinese (Mandarin)_Gentle_Senior",
  "Chinese (Mandarin)_Crisp_Girl",
  "Chinese (Mandarin)_Pure-hearted_Boy",
  "Chinese (Mandarin)_Soft_Girl",
  "Chinese (Mandarin)_IntellectualGirl",
  "Chinese (Mandarin)_Warm_HeartedGirl",
  "Chinese (Mandarin)_Laid_BackGirl",
  "Chinese (Mandarin)_ExplorativeGirl",
  "Chinese (Mandarin)_Warm-HeartedAunt",
  "Chinese (Mandarin)_BashfulGirl",
  "Japanese_IntellectualSenior",
  "Japanese_DecisivePrincess",
  "Japanese_LoyalKnight",
  "Japanese_DominantMan",
  "Japanese_SeriousCommander",
  "Japanese_ColdQueen",
  "Japanese_DependableWoman",
  "Japanese_GentleButler",
  "Japanese_KindLady",
  "Japanese_CalmLady",
  "Japanese_OptimisticYouth",
  "Japanese_GenerousIzakayaOwner",
  "Japanese_SportyStudent",
  "Japanese_InnocentBoy",
  "Japanese_GracefulMaiden",
  "Cantonese_ProfessionalHost (F)",
  "Cantonese_GentleLady",
  "Cantonese_ProfessionalHost (M)",
  "Cantonese_PlayfulMan",
  "Cantonese_CuteGirl",
  "Cantonese_KindWoman",
  "Korean_AirheadedGirl",
  "Korean_AthleticGirl",
  "Korean_AthleticStudent",
  "Korean_BraveAdventurer",
  "Korean_BraveFemaleWarrior",
  "Korean_BraveYouth",
  "Korean_CalmGentleman",
  "Korean_CalmLady",
  "Korean_CaringWoman",
  "Korean_CharmingElderSister",
  "Korean_CharmingSister",
  "Korean_CheerfulBoyfriend",
  "Korean_CheerfulCoolJunior",
  "Korean_CheerfulLittleSister",
  "Korean_ChildhoodFriendGirl",
  "Korean_CockyGuy",
  "Korean_ColdGirl",
  "Korean_ColdYoungMan",
  "Korean_ConfidentBoss",
  "Korean_ConsiderateSenior",
  "Korean_DecisiveQueen",
  "Korean_DominantMan",
  "Korean_ElegantPrincess",
  "Korean_EnchantingSister",
  "Korean_EnthusiasticTeen",
  "Korean_FriendlyBigSister",
  "Korean_GentleBoss",
  "Korean_GentleWoman",
  "Korean_HaughtyLady",
  "Korean_InnocentBoy",
  "Korean_IntellectualMan",
  "Korean_IntellectualSenior",
  "Korean_LonelyWarrior",
  "Korean_MatureLady",
  "Korean_MysteriousGirl",
  "Korean_OptimisticYouth",
  "Korean_PlayboyCharmer",
  "Korean_PossessiveMan",
  "Korean_QuirkyGirl",
  "Korean_ReliableSister",
  "Korean_ReliableYouth",
  "Korean_SassyGirl",
  "Korean_ShyGirl",
  "Korean_SoothingLady",
  "Korean_StrictBoss",
  "Korean_SweetGirl",
  "Korean_ThoughtfulWoman",
  "Korean_WiseElf",
  "Korean_WiseTeacher",
  "Spanish_SereneWoman",
  "Spanish_MaturePartner",
  "Spanish_CaptivatingStoryteller",
  "Spanish_Narrator",
  "Spanish_WiseScholar",
  "Spanish_Kind-heartedGirl",
  "Spanish_DeterminedManager",
  "Spanish_BossyLeader",
  "Spanish_ReservedYoungMan",
  "Spanish_ConfidentWoman",
  "Spanish_ThoughtfulMan",
  "Spanish_Strong-WilledBoy",
  "Spanish_SophisticatedLady",
  "Spanish_RationalMan",
  "Spanish_AnimeCharacter",
  "Spanish_Deep-tonedMan",
  "Spanish_Fussyhostess",
  "Spanish_SincereTeen",
  "Spanish_FrankLady",
  "Spanish_Comedian",
  "Spanish_Debator",
  "Spanish_ToughBoss",
  "Spanish_Wiselady",
  "Spanish_Steadymentor",
  "Spanish_Jovialman",
  "Spanish_SantaClaus",
  "Spanish_Rudolph",
  "Spanish_Intonategirl",
  "Spanish_Arnold",
  "Spanish_Ghost",
  "Spanish_HumorousElder",
  "Spanish_EnergeticBoy",
  "Spanish_WhimsicalGirl",
  "Spanish_StrictBoss",
  "Spanish_ReliableMan",
  "Spanish_SereneElder",
  "Spanish_AngryMan",
  "Spanish_AssertiveQueen",
  "Spanish_CaringGirlfriend",
  "Spanish_PowerfulSoldier",
  "Spanish_PassionateWarrior",
  "Spanish_ChattyGirl",
  "Spanish_RomanticHusband",
  "Spanish_CompellingGirl",
  "Spanish_PowerfulVeteran",
  "Spanish_SensibleManager",
  "Spanish_ThoughtfulLady",
  "Portuguese_SentimentalLady",
  "Portuguese_BossyLeader",
  "Portuguese_Wiselady",
  "Portuguese_Strong-WilledBoy",
  "Portuguese_Deep-VoicedGentleman",
  "Portuguese_UpsetGirl",
  "Portuguese_PassionateWarrior",
  "Portuguese_AnimeCharacter",
  "Portuguese_ConfidentWoman",
  "Portuguese_AngryMan",
  "Portuguese_CaptivatingStoryteller",
  "Portuguese_Godfather",
  "Portuguese_ReservedYoungMan",
  "Portuguese_SmartYoungGirl",
  "Portuguese_Kind-heartedGirl",
  "Portuguese_Pompouslady",
  "Portuguese_Grinch",
  "Portuguese_Debator",
  "Portuguese_SweetGirl",
  "Portuguese_AttractiveGirl",
  "Portuguese_ThoughtfulMan",
  "Portuguese_PlayfulGirl",
  "Portuguese_GorgeousLady",
  "Portuguese_LovelyLady",
  "Portuguese_SereneWoman",
  "Portuguese_SadTeen",
  "Portuguese_MaturePartner",
  "Portuguese_Comedian",
  "Portuguese_NaughtySchoolgirl",
  "Portuguese_Narrator",
  "Portuguese_ToughBoss",
  "Portuguese_Fussyhostess",
  "Portuguese_Dramatist",
  "Portuguese_Steadymentor",
  "Portuguese_Jovialman",
  "Portuguese_CharmingQueen",
  "Portuguese_SantaClaus",
  "Portuguese_Rudolph",
  "Portuguese_Arnold",
  "Portuguese_CharmingSanta",
  "Portuguese_CharmingLady",
  "Portuguese_Ghost",
  "Portuguese_HumorousElder",
  "Portuguese_CalmLeader",
  "Portuguese_GentleTeacher",
  "Portuguese_EnergeticBoy",
  "Portuguese_ReliableMan",
  "Portuguese_SereneElder",
  "Portuguese_GrimReaper",
  "Portuguese_AssertiveQueen",
  "Portuguese_WhimsicalGirl",
  "Portuguese_StressedLady",
  "Portuguese_FriendlyNeighbor",
  "Portuguese_CaringGirlfriend",
  "Portuguese_PowerfulSoldier",
  "Portuguese_FascinatingBoy",
  "Portuguese_RomanticHusband",
  "Portuguese_StrictBoss",
  "Portuguese_InspiringLady",
  "Portuguese_PlayfulSpirit",
  "Portuguese_ElegantGirl",
  "Portuguese_CompellingGirl",
  "Portuguese_PowerfulVeteran",
  "Portuguese_SensibleManager",
  "Portuguese_ThoughtfulLady",
  "Portuguese_TheatricalActor",
  "Portuguese_FragileBoy",
  "Portuguese_ChattyGirl",
  "Portuguese_Conscientiousinstructor",
  "Portuguese_RationalMan",
  "Portuguese_WiseScholar",
  "Portuguese_FrankLady",
  "Portuguese_DeterminedManager",
  "French_Male_Speech_New",
  "French_Female_News Anchor",
  "French_CasualMan",
  "French_MovieLeadFemale",
  "French_FemaleAnchor",
  "French_MaleNarrator",
  "Indonesian_SweetGirl",
  "Indonesian_ReservedYoungMan",
  "Indonesian_CharmingGirl",
  "Indonesian_CalmWoman",
  "Indonesian_ConfidentWoman",
  "Indonesian_CaringMan",
  "Indonesian_BossyLeader",
  "Indonesian_DeterminedBoy",
  "Indonesian_GentleGirl",
  "German_FriendlyMan",
  "German_SweetLady",
  "German_PlayfulMan",
  "Russian_HandsomeChildhoodFriend",
  "Russian_BrightHeroine",
  "Russian_AmbitiousWoman",
  "Russian_ReliableMan",
  "Russian_CrazyQueen",
  "Russian_PessimisticGirl",
  "Russian_AttractiveGuy",
  "Russian_Bad-temperedBoy",
  "Italian_BraveHeroine",
  "Italian_Narrator",
  "Italian_WanderingSorcerer",
  "Italian_DiligentLeader",
  "Dutch_kindhearted_girl",
  "Dutch_bossy_leader",
  "Vietnamese_kindhearted_girl",
  "Arabic_CalmWoman",
  "Arabic_FriendlyGuy",
  "Turkish_CalmWoman",
  "Turkish_Trustworthyman",
  "Ukrainian_CalmWoman",
  "Ukrainian_WiseScholar",
  "Thai_male_1_sample8",
  "Thai_male_2_sample2",
  "Thai_female_1_sample1",
  "Thai_female_2_sample2",
  "Polish_male_1_sample4",
  "Polish_male_2_sample3",
  "Polish_female_1_sample1",
  "Polish_female_2_sample3",
  "Romanian_male_1_sample2",
  "Romanian_male_2_sample1",
  "Romanian_female_1_sample4",
  "Romanian_female_2_sample1",
  "greek_male_1a_v1",
  "Greek_female_1_sample1",
  "Greek_female_2_sample3",
  "czech_male_1_v1",
  "czech_female_5_v7",
  "czech_female_2_v2",
  "finnish_male_3_v1",
  "finnish_male_1_v2",
  "finnish_female_4_v1",
  "hindi_male_1_v2",
  "hindi_female_2_v1",
  "hindi_female_1_v2",
];
const TTS_PROVIDER_CONFIGS = {
  openai: {
    label: "OpenAI",
    models: OPENAI_TTS_MODELS,
    voices: OPENAI_TTS_VOICES,
    defaultModel: "gpt-4o-mini-tts",
    defaultVoice: "sage",
    defaultSpeed: 1.12,
    speedMin: 0.25,
    speedMax: 4,
    defaultInstructions: DEFAULT_TTS_INSTRUCTIONS,
    voicePlaceholder: "sage",
    instructionsPlaceholder: "Tone, pacing, and delivery style",
  },
  minimax: {
    label: "MiniMax",
    models: MINIMAX_TTS_MODELS,
    voices: MINIMAX_TTS_VOICES,
    defaultModel: "speech-2.8-turbo",
    defaultVoice: "Korean_SweetGirl",
    defaultSpeed: 1,
    speedMin: 0.5,
    speedMax: 2,
    defaultInstructions: "",
    voicePlaceholder: "Korean_SweetGirl or custom voice_id",
    instructionsPlaceholder: "MiniMax ignores OpenAI-style voice instructions",
  },
};
const TTS_PROVIDERS = new Set(Object.keys(TTS_PROVIDER_CONFIGS));
const DEFAULT_TTS_SETTINGS = {
  provider: DEFAULT_TTS_PROVIDER,
  model: TTS_PROVIDER_CONFIGS[DEFAULT_TTS_PROVIDER].defaultModel,
  voice: TTS_PROVIDER_CONFIGS[DEFAULT_TTS_PROVIDER].defaultVoice,
  speed: TTS_PROVIDER_CONFIGS[DEFAULT_TTS_PROVIDER].defaultSpeed,
  instructions: TTS_PROVIDER_CONFIGS[DEFAULT_TTS_PROVIDER].defaultInstructions,
};
const DEFAULT_SUBTITLE_ENABLED = true;
const DEFAULT_SUBTITLE_SIZE = 100;
const DEFAULT_SUBTITLE_Y = 90;
const SUBTITLE_MAX_LINES = 2;
const VIDEO_EXPORT_FPS = 30;
const VIDEO_EXPORT_FALLBACK_DURATION = 3;
const DYNAMIC_FRAME_RATE = VIDEO_EXPORT_FPS;
const DYNAMIC_MAX_DURATION = 60;
const DEFAULT_GIT_TYPING_SPEED = 90;
const DEFAULT_CHAT_TYPING_SPEED = 80;
const DEFAULT_CHAT_TEXT_SCALE = 1.25;
const CHAT_ANSWER_DELAY_SECONDS = 0.55;
const GIT_CODE_MAX_RENDER_LINES = 700;
const GIT_DIFF_MAX_LCS_CELLS = 220000;
const MAX_GIT_COMMIT_OPTIONS = 80;
const MAX_GIT_FILE_OPTIONS = 300;
const GIT_SLIDE_HELPER_TEXTS = new Set([
  "Choose a repository, then load commits and files.",
  "Load the commit history of the repository.",
  "Loading the list of files changed in this commit.",
  "No readable commits were found in this repository.",
  "Press Load Diff to load changes from the selected file.",
  "No files were changed in this commit.",
]);
const SLIDE_KINDS = new Set(["canvas", "gitTyping", "chatTyping"]);

const { drawTextLines, drawGitTypingSlide, renderSlideToDataUrl } = createRenderer({
  TEXT_PADDING_X,
  TEXT_PADDING_Y,
  DEFAULT_TEXT_COLOR,
  getTextPreset,
  getTextRenderStyle,
  getTextEffectOutset,
  sanitizeTextAlign,
  wrapTextLines,
  getGitTypingData,
  getGitEditorFrame,
  getFileNameFromPath,
  clamp,
  fillRoundedRect,
  traceRoundedRect,
  strokeRoundedRect,
  drawCodeLine,
  isDynamicSlide,
  renderDynamicSlideToDataUrl,
  getDynamicSlideDuration,
  roundedCanvasSize,
  sanitizeColor,
  ensureSlideFontsReady,
  drawSlideObjectsForExport,
  drawSubtitleBox,
  getSubtitleTextForRender,
});

renderTextEffectButtons();
refreshTextEffectButtonPreviews().catch(() => renderTextEffectButtonPreviews());

const { serializeObject, serializeCurrentSlide, cloneProjectValue, normalizeProjectData } = createProjectModel({
  canvas,
  slideNotes,
  getSlides: () => slides,
  getActiveSlideIndex: () => activeSlideIndex,
  setSlideAtIndex: (index, slide) => {
    slides[index] = slide;
  },
  getState,
  syncTextEditorValue,
  getCanvasState,
  normalizeSlideVideo,
  normalizeSlideStartSound,
  SHAPE_KINDS,
  DEFAULT_STROKE_COLOR,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_TEXT_COLOR,
  TEXT_SIZE_PRESETS,
  PROJECT_FORMAT,
  DEFAULT_GIT_TYPING_SPEED,
  DEFAULT_CHAT_TYPING_SPEED,
  clamp,
  numberOr,
  parseShapePoints,
  sanitizeTextAlign,
  sanitizeTextFontFamily,
  sanitizeTextFontWeight,
  sanitizeTextEffect,
  sanitizeAnimationIn,
  sanitizeAnimationInDelay,
  sanitizeAnimationLoop,
  sanitizeAnimationOut,
  sanitizeAnimationSpeed,
  sanitizeAnimationMove,
  sanitizeAnimationMoveCoordinate,
  sanitizeAnimationMoveDuration,
  sanitizeAnimationMoveEasing,
  sanitizeColor,
  sanitizeNumber,
  normalizeFlipFlag,
  isAnimatedGifSource,
  sanitizeSlideKind,
  isDynamicSlide,
  normalizeContinueAfterTts,
  normalizeNoteSegments,
  createDefaultSlide,
  createDefaultGitTypingData,
  createDefaultChatTypingData,
  stripGitSlideHelperText,
  sanitizeGitCommitOptions,
  sanitizeGitFileOptions,
  sanitizeTypingSpeed,
  sanitizeChatTextScale,
  normalizeProjectSettings,
});

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

function formatErrorMessage(error, fallback) {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}

function toLucideIconKey(name) {
  return String(name || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function createLucideSvg(iconName, className = "button-icon") {
  const lucideApi = window.lucide;
  const icon = lucideApi?.icons?.[toLucideIconKey(iconName)];
  if (!icon || !lucideApi?.createElement) {
    return null;
  }
  return lucideApi.createElement(icon, {
    class: className,
    "aria-hidden": "true",
    focusable: "false",
  });
}

function hydrateButtonIcons(root = document) {
  if (!window.lucide?.icons || !window.lucide?.createElement) {
    return;
  }

  for (const button of root.querySelectorAll("button[data-icon]")) {
    if (button.querySelector(".button-icon")) {
      button.classList.add("has-icon");
      continue;
    }
    const svg = createLucideSvg(button.dataset.icon);
    if (!svg) {
      continue;
    }
    button.prepend(svg);
    button.classList.add("has-icon");
  }
}

function setButtonLabel(button, label) {
  if (!button) {
    return;
  }
  const icon = button.querySelector(".button-icon");
  button.textContent = label;
  if (icon) {
    button.prepend(icon);
  }
}

function getDefaultTextColorForCanvas(canvasValue) {
  return sanitizeColor(canvasValue, DEFAULT_CANVAS_COLOR).toLowerCase() === COLOR_PRESETS.dark.canvasColor
    ? COLOR_PRESETS.dark.textColor
    : DEFAULT_TEXT_COLOR;
}

function normalizeTtsProvider(value) {
  const provider = typeof value === "string" ? value.trim().toLowerCase() : "";
  return TTS_PROVIDERS.has(provider) ? provider : DEFAULT_TTS_PROVIDER;
}

function getTtsProviderConfig(provider) {
  return TTS_PROVIDER_CONFIGS[normalizeTtsProvider(provider)];
}

function normalizeTtsModel(value, provider = DEFAULT_TTS_PROVIDER) {
  const config = getTtsProviderConfig(provider);
  const model = typeof value === "string" ? value.trim() : "";
  return config.models.includes(model) ? model : config.defaultModel;
}

function normalizeTtsVoice(value, provider = DEFAULT_TTS_PROVIDER) {
  const config = getTtsProviderConfig(provider);
  const voice = typeof value === "string" ? value.trim() : "";
  if (normalizeTtsProvider(provider) === "openai") {
    return config.voices.includes(voice) ? voice : config.defaultVoice;
  }
  return voice || config.defaultVoice;
}

function normalizeTtsSpeed(value, provider = DEFAULT_TTS_PROVIDER) {
  const config = getTtsProviderConfig(provider);
  return clamp(numberOr(value, config.defaultSpeed), config.speedMin, config.speedMax);
}

function normalizeTtsInstructions(value, provider = DEFAULT_TTS_PROVIDER) {
  const config = getTtsProviderConfig(provider);
  return typeof value === "string" ? value.trim() : config.defaultInstructions;
}

function normalizeSubtitleEnabled(value) {
  return value === undefined ? DEFAULT_SUBTITLE_ENABLED : Boolean(value);
}

function normalizeSubtitleSize(value) {
  return sanitizeNumber(value, DEFAULT_SUBTITLE_SIZE, 60, 180);
}

function normalizeSubtitleY(value) {
  return sanitizeNumber(value, DEFAULT_SUBTITLE_Y, 5, 95);
}

function normalizeSubtitleStyleMode(value) {
  return SUBTITLE_STYLE_MODES.has(value) ? value : DEFAULT_SUBTITLE_STYLE_MODE;
}

function normalizeSubtitleFontFamily(value) {
  return sanitizeTextFontFamily(value || DEFAULT_SUBTITLE_FONT_FAMILY);
}

function normalizeSubtitleFontWeight(value) {
  return sanitizeTextFontWeight(value, DEFAULT_SUBTITLE_FONT_WEIGHT);
}

function normalizeSubtitleTextEffect(value) {
  return sanitizeTextEffect(value || DEFAULT_SUBTITLE_TEXT_EFFECT);
}

function normalizeSafeAreaSnapEnabled(value) {
  return value === undefined ? DEFAULT_SAFE_AREA_SNAP_ENABLED : Boolean(value);
}

function normalizeSafeAreaPreset(value) {
  return SAFE_AREA_PRESET_KEYS.has(value) ? value : DEFAULT_SAFE_AREA_PRESET;
}

function normalizeContinueAfterTts(value) {
  return Boolean(value);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeFlipFlag(value) {
  return value === true || value === "true" || value === "1";
}

function sanitizeTextAlign(value) {
  return TEXT_ALIGNMENTS.has(value) ? value : "left";
}

function sanitizeTextFontFamily(value) {
  return TEXT_FONT_FAMILIES.has(value) ? value : DEFAULT_TEXT_FONT_FAMILY;
}

function sanitizeTextEffect(value) {
  const effectKey = TEXT_EFFECT_ALIASES[value] || value;
  return TEXT_EFFECT_PRESETS[effectKey] ? effectKey : DEFAULT_TEXT_EFFECT;
}

function sanitizeTextFontWeight(value, fallback = DEFAULT_TEXT_FONT_WEIGHT) {
  return clamp(numberOr(value, fallback), 100, 900);
}

function sanitizeAnimationIn(value) {
  return ANIMATION_IN_PRESETS[value] ? value : DEFAULT_ANIMATION_IN;
}

function sanitizeAnimationInDelay(value) {
  return sanitizeNumber(value, DEFAULT_ANIMATION_IN_DELAY, 0, 60);
}

function sanitizeAnimationLoop(value) {
  return ANIMATION_LOOP_PRESETS[value] ? value : DEFAULT_ANIMATION_LOOP;
}

function sanitizeAnimationOut() {
  return DEFAULT_ANIMATION_OUT;
}

function sanitizeAnimationSpeed(value) {
  return ANIMATION_SPEED_PRESETS[value] ? value : DEFAULT_ANIMATION_SPEED;
}

function sanitizeAnimationMove(value) {
  return ANIMATION_MOVE_PRESETS[value] ? value : DEFAULT_ANIMATION_MOVE;
}

function sanitizeAnimationMoveEasing(value) {
  return ANIMATION_MOVE_EASINGS[value] ? value : DEFAULT_ANIMATION_MOVE_EASING;
}

function sanitizeAnimationMoveCoordinate(value) {
  return sanitizeNumber(value, 0, -8192, 8192);
}

function sanitizeAnimationMoveDuration(value) {
  return sanitizeNumber(value, DEFAULT_ANIMATION_MOVE_DURATION, 0.1, 60);
}

function getObjectAnimationConfig(data = {}) {
  return {
    animationIn: sanitizeAnimationIn(data.animationIn),
    animationInDelay: sanitizeAnimationInDelay(data.animationInDelay),
    animationLoop: sanitizeAnimationLoop(data.animationLoop),
    animationOut: sanitizeAnimationOut(data.animationOut),
    animationSpeed: sanitizeAnimationSpeed(data.animationSpeed),
    animationMove: sanitizeAnimationMove(data.animationMove),
    animationMoveFromX: sanitizeAnimationMoveCoordinate(data.animationMoveFromX),
    animationMoveFromY: sanitizeAnimationMoveCoordinate(data.animationMoveFromY),
    animationMoveToX: sanitizeAnimationMoveCoordinate(data.animationMoveToX),
    animationMoveToY: sanitizeAnimationMoveCoordinate(data.animationMoveToY),
    animationMoveDuration: sanitizeAnimationMoveDuration(data.animationMoveDuration),
    animationMoveEasing: sanitizeAnimationMoveEasing(data.animationMoveEasing),
  };
}

function hasObjectAnimation(data = {}) {
  const config = getObjectAnimationConfig(data);
  return (
    config.animationIn !== DEFAULT_ANIMATION_IN ||
    config.animationInDelay > DEFAULT_ANIMATION_IN_DELAY ||
    config.animationLoop !== DEFAULT_ANIMATION_LOOP ||
    config.animationMove !== DEFAULT_ANIMATION_MOVE
  );
}

function canAnimateObjectData(data = {}) {
  if (data.type === "text") {
    return true;
  }
  return data.type === "image" && !isAnimatedGifSource(data.src);
}

function setDefaultAnimationDataset(element) {
  element.dataset.animationIn = DEFAULT_ANIMATION_IN;
  element.dataset.animationInDelay = String(DEFAULT_ANIMATION_IN_DELAY);
  element.dataset.animationLoop = DEFAULT_ANIMATION_LOOP;
  element.dataset.animationOut = DEFAULT_ANIMATION_OUT;
  element.dataset.animationSpeed = DEFAULT_ANIMATION_SPEED;
  element.dataset.animationMove = DEFAULT_ANIMATION_MOVE;
  element.dataset.animationMoveFromX = "0";
  element.dataset.animationMoveFromY = "0";
  element.dataset.animationMoveToX = "0";
  element.dataset.animationMoveToY = "0";
  element.dataset.animationMoveDuration = String(DEFAULT_ANIMATION_MOVE_DURATION);
  element.dataset.animationMoveEasing = DEFAULT_ANIMATION_MOVE_EASING;
}

function setAnimationDatasetFromData(element, data = {}) {
  element.dataset.animationIn = sanitizeAnimationIn(data.animationIn);
  element.dataset.animationInDelay = String(sanitizeAnimationInDelay(data.animationInDelay));
  element.dataset.animationLoop = sanitizeAnimationLoop(data.animationLoop);
  element.dataset.animationOut = DEFAULT_ANIMATION_OUT;
  element.dataset.animationSpeed = sanitizeAnimationSpeed(data.animationSpeed);
  element.dataset.animationMove = sanitizeAnimationMove(data.animationMove);
  element.dataset.animationMoveFromX = String(sanitizeAnimationMoveCoordinate(data.animationMoveFromX));
  element.dataset.animationMoveFromY = String(sanitizeAnimationMoveCoordinate(data.animationMoveFromY));
  element.dataset.animationMoveToX = String(sanitizeAnimationMoveCoordinate(data.animationMoveToX));
  element.dataset.animationMoveToY = String(sanitizeAnimationMoveCoordinate(data.animationMoveToY));
  element.dataset.animationMoveDuration = String(sanitizeAnimationMoveDuration(data.animationMoveDuration));
  element.dataset.animationMoveEasing = sanitizeAnimationMoveEasing(data.animationMoveEasing);
}

function quoteFontFamily(value) {
  return `"${String(value || DEFAULT_TEXT_FONT_FAMILY).replace(/"/g, "")}"`;
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
  return /^(data:|blob:|asset:)/i.test(String(value || ""));
}

function isAnimatedGifSource(value) {
  const source = String(value || "").trim();
  return /^data:image\/gif[;,]/i.test(source) || source.split(/[?#]/)[0].toLowerCase().endsWith(".gif");
}

function getDisplayAssetUrl(value) {
  const path = String(value || "");
  if (!path || isExternalUrl(path)) {
    return path;
  }
  return nativeApi.toAssetUrl(path);
}

async function getRenderAssetUrl(value) {
  const path = String(value || "");
  if (!path || isExternalUrl(path)) {
    return path;
  }
  return nativeApi.readAssetDataUrl(path);
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

function sanitizeChatTextScale(value) {
  return clamp(numberOr(value, DEFAULT_CHAT_TEXT_SCALE), 1, 1.75);
}

function truncateText(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n\n... truncated ...` : text;
}

function normalizeCodeText(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function splitCodeLines(value) {
  const normalized = normalizeCodeText(value);
  if (!normalized) {
    return [""];
  }
  return normalized.split("\n").slice(0, GIT_CODE_MAX_RENDER_LINES);
}

function getCodeDisplayText(value) {
  return truncateText(normalizeCodeText(value), 12000);
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

function getTextRenderStyle(data = {}) {
  const effectKey = sanitizeTextEffect(data.textEffect);
  const preset = TEXT_EFFECT_PRESETS[effectKey] || TEXT_EFFECT_PRESETS[DEFAULT_TEXT_EFFECT];
  return {
    ...preset,
    effectKey,
    fontFamily: sanitizeTextFontFamily(data.fontFamily || preset.fontFamily),
    fontWeight: sanitizeTextFontWeight(data.fontWeight, preset.fontWeight || DEFAULT_TEXT_FONT_WEIGHT),
    fillColor: data.textColor || preset.fillColor || DEFAULT_TEXT_COLOR,
  };
}

function getTextDecorationScale(renderStyle = {}) {
  const fontSize = numberOr(renderStyle.fontSize, TEXT_SIZE_PRESETS.h3.fontSize);
  return clamp(fontSize / TEXT_SIZE_PRESETS.h3.fontSize, 0.7, 3);
}

function getTextEffectOutset(renderStyle = {}) {
  const strokeOutset = Math.max(
    0,
    numberOr(renderStyle.strokeWidth, 0) / 2,
    numberOr(renderStyle.backgroundStrokeWidth, 0) / 2
  );
  const shadowBlur = Math.max(0, numberOr(renderStyle.shadowBlur, 0));
  const shadowLayerOutset = Math.max(0, numberOr(renderStyle.shadowLayerStrokeWidth, 0) / 2);
  const shadowX = Math.max(
    Math.abs(numberOr(renderStyle.shadowOffsetX, 0)),
    Math.abs(numberOr(renderStyle.shadowLayerOffsetX, renderStyle.shadowOffsetX || 0))
  );
  const shadowY = Math.max(
    Math.abs(numberOr(renderStyle.shadowOffsetY, 0)),
    Math.abs(numberOr(renderStyle.shadowLayerOffsetY, renderStyle.shadowOffsetY || 0))
  );
  let glowBlur = 0;
  let glowX = 0;
  let glowY = 0;
  if (Array.isArray(renderStyle.glowLayers)) {
    for (const layer of renderStyle.glowLayers) {
      if (!layer) continue;
      glowBlur = Math.max(glowBlur, numberOr(layer.blur, 0));
      glowX = Math.max(glowX, Math.abs(numberOr(layer.offsetX, 0)));
      glowY = Math.max(glowY, Math.abs(numberOr(layer.offsetY, 0)));
    }
  }
  let offsetLayerX = 0;
  let offsetLayerY = 0;
  if (Array.isArray(renderStyle.offsetLayers)) {
    for (const layer of renderStyle.offsetLayers) {
      if (!layer) continue;
      const layerStroke = Math.max(0, numberOr(layer.strokeWidth, 0) / 2);
      offsetLayerX = Math.max(offsetLayerX, Math.abs(numberOr(layer.offsetX, 0)) + layerStroke);
      offsetLayerY = Math.max(offsetLayerY, Math.abs(numberOr(layer.offsetY, 0)) + layerStroke);
    }
  }
  const decorationScale = getTextDecorationScale(renderStyle);
  let decorationX = Math.max(0, numberOr(renderStyle.decorationOutsetX, 0)) * decorationScale;
  let decorationY = Math.max(0, numberOr(renderStyle.decorationOutsetY, 0)) * decorationScale;
  if (Array.isArray(renderStyle.decorations)) {
    const defaultOutsets = {
      sparkle: 24,
      confetti: 18,
      paintBurst: 30,
      spray: 34,
      burst: 36,
      drip: 26,
      tape: 18,
      stripe: 4,
    };
    for (const decoration of renderStyle.decorations) {
      if (!decoration) continue;
      const fallbackOutset = defaultOutsets[decoration.type] || 0;
      decorationX = Math.max(decorationX, numberOr(decoration.outsetX, fallbackOutset) * decorationScale);
      decorationY = Math.max(decorationY, numberOr(decoration.outsetY, fallbackOutset) * decorationScale);
    }
  }
  const existingX = Math.max(strokeOutset, shadowLayerOutset) + Math.max(shadowBlur + shadowX, glowBlur + glowX);
  const existingY = Math.max(strokeOutset, shadowLayerOutset) + Math.max(shadowBlur + shadowY, glowBlur + glowY);
  return {
    x: Math.ceil(Math.max(existingX, offsetLayerX, decorationX)),
    y: Math.ceil(Math.max(existingY, offsetLayerY, decorationY)),
  };
}

function getTextRenderFontRequest(data = {}) {
  const renderStyle = getTextRenderStyle(data);
  return {
    family: renderStyle.fontFamily,
    weight: renderStyle.fontWeight,
  };
}

function getFontLoadKey(fontRequest) {
  return `${fontRequest.family}:${fontRequest.weight}`;
}

function getFontLoadSpec(fontRequest) {
  return `${fontRequest.weight} ${TEXT_FONT_LOAD_SIZE}px ${quoteFontFamily(fontRequest.family)}`;
}

function isDocumentFontReady(fontRequest) {
  if (!document.fonts) {
    return true;
  }
  try {
    return document.fonts.check(getFontLoadSpec(fontRequest), FONT_LOAD_SAMPLE_TEXT);
  } catch {
    return false;
  }
}

async function loadDocumentFont(fontRequest) {
  if (!document.fonts || isDocumentFontReady(fontRequest)) {
    return true;
  }

  const key = getFontLoadKey(fontRequest);
  if (!textFontLoadPromises.has(key)) {
    const promise = document.fonts
      .load(getFontLoadSpec(fontRequest), FONT_LOAD_SAMPLE_TEXT)
      .then((faces) => faces.length > 0)
      .catch(() => false);
    textFontLoadPromises.set(key, promise);
  }

  const loaded = await textFontLoadPromises.get(key);
  try {
    await document.fonts.ready;
  } catch {
    // A failed optional font should not block rendering/export entirely.
  }
  return loaded && isDocumentFontReady(fontRequest);
}

async function ensureTextFontsReady(fontRequests = []) {
  const uniqueRequests = new Map();
  for (const request of fontRequests) {
    if (!request?.family) {
      continue;
    }
    uniqueRequests.set(getFontLoadKey(request), request);
  }
  await Promise.all([...uniqueRequests.values()].map(loadDocumentFont));
}

function getSubtitleFontRequest(options = {}) {
  if (normalizeSubtitleStyleMode(options.subtitleStyleMode ?? projectSettingsState.subtitleStyleMode) === "sticker") {
    return getTextRenderFontRequest({
      textEffect: normalizeSubtitleTextEffect(options.subtitleTextEffect ?? projectSettingsState.subtitleTextEffect),
    });
  }
  return {
    family: normalizeSubtitleFontFamily(options.subtitleFontFamily ?? projectSettingsState.subtitleFontFamily),
    weight: normalizeSubtitleFontWeight(options.subtitleFontWeight ?? projectSettingsState.subtitleFontWeight),
  };
}

function getSlideFontRequests(slide, options = {}) {
  const requests = [];
  if (isDynamicSlide(slide)) {
    requests.push({ family: "Pretendard", weight: 600 }, { family: "Pretendard", weight: 700 });
  }
  for (const object of slide?.objects || []) {
    if (object.type === "text") {
      requests.push(getTextRenderFontRequest(object));
    }
  }
  const subtitleText = typeof options.subtitleText === "string" ? options.subtitleText : slide?.notes;
  if ((options.subtitles || options.reserveSubtitles) && String(subtitleText || "").trim()) {
    requests.push(getSubtitleFontRequest(options));
  }
  return requests;
}

async function ensureSlideFontsReady(slide, options = {}) {
  await ensureTextFontsReady(getSlideFontRequests(slide, options));
}

function getCanvasFontRequests(options = {}) {
  const requests = [...canvas.querySelectorAll(".text-object")].map((element) =>
    getTextRenderFontRequest({
      fontFamily: element.dataset.fontFamily,
      fontWeight: element.dataset.fontWeight,
      textEffect: element.dataset.textEffect,
      textColor: element.dataset.textColor,
    })
  );
  if (options.subtitles && String(options.subtitleText || "").trim()) {
    requests.push(getSubtitleFontRequest(options));
  }
  return requests;
}

async function ensureCanvasFontsReady(options = {}) {
  await ensureTextFontsReady(getCanvasFontRequests(options));
}

function scheduleTextFontRerender(element) {
  if (!element || element.dataset.type !== "text" || !document.fonts) {
    return;
  }
  const fontRequest = getTextRenderFontRequest({
    fontFamily: element.dataset.fontFamily,
    fontWeight: element.dataset.fontWeight,
    textEffect: element.dataset.textEffect,
    textColor: element.dataset.textColor,
  });
  if (isDocumentFontReady(fontRequest)) {
    delete element.dataset.pendingFontRender;
    return;
  }

  const key = getFontLoadKey(fontRequest);
  if (element.dataset.pendingFontRender === key) {
    return;
  }
  element.dataset.pendingFontRender = key;
  loadDocumentFont(fontRequest).then((loaded) => {
    if (!loaded || !element.isConnected || element.dataset.pendingFontRender !== key) {
      return;
    }
    delete element.dataset.pendingFontRender;
    renderTextObject(element);
  });
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
    flipX: normalizeFlipFlag(element.dataset.flipX),
    flipY: normalizeFlipFlag(element.dataset.flipY),
  };
}

function getElementAnimationData(element) {
  const state = getState(element);
  const image = element.dataset.type === "image" ? element.querySelector("img") : null;
  return {
    type: element.dataset.type,
    src: image?.dataset.src || image?.currentSrc || image?.src || "",
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    rotation: state.rotation,
    flipX: state.flipX,
    flipY: state.flipY,
    animationIn: element.dataset.animationIn,
    animationInDelay: element.dataset.animationInDelay,
    animationLoop: element.dataset.animationLoop,
    animationOut: element.dataset.animationOut,
    animationSpeed: element.dataset.animationSpeed,
    animationMove: element.dataset.animationMove,
    animationMoveFromX: element.dataset.animationMoveFromX,
    animationMoveFromY: element.dataset.animationMoveFromY,
    animationMoveToX: element.dataset.animationMoveToX,
    animationMoveToY: element.dataset.animationMoveToY,
    animationMoveDuration: element.dataset.animationMoveDuration,
    animationMoveEasing: element.dataset.animationMoveEasing,
  };
}

function canAnimateElement(element) {
  return Boolean(element) && canAnimateObjectData(getElementAnimationData(element));
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - clamp(value, 0, 1), 3);
}

function getMoveAnimationDuration(data = {}) {
  const config = getObjectAnimationConfig(data);
  return config.animationMove === "move" ? config.animationMoveDuration : 0;
}

function getAnimationInDuration(data = {}) {
  const config = getObjectAnimationConfig(data);
  return config.animationInDelay + (ANIMATION_IN_DURATIONS[config.animationIn] || 0);
}

function hasLoopAnimation(data = {}) {
  return getObjectAnimationConfig(data).animationLoop !== DEFAULT_ANIMATION_LOOP;
}

function getObjectOneShotAnimationDuration(data = {}) {
  return Math.max(getAnimationInDuration(data), getMoveAnimationDuration(data));
}

function getSlideObjectAnimationDuration(slide) {
  return Math.max(0, ...(slide?.objects || []).map(getObjectOneShotAnimationDuration));
}

function getCanvasObjectAnimationDuration() {
  return Math.max(
    0,
    ...[...canvas.querySelectorAll(".object")].map((element) => getObjectOneShotAnimationDuration(getElementAnimationData(element)))
  );
}

function shouldLoopAnimationFrames(slide) {
  return !isDynamicSlide(slide) && slideHasLoopAnimations(slide) && getSlideObjectAnimationDuration(slide) <= 0;
}

function getBlinkOpacityForPhase(angle) {
  return Math.pow((1 + Math.cos(angle)) / 2, 2);
}

function getObjectAnimationState(object, timeSeconds = 0, durationSeconds = VIDEO_EXPORT_FALLBACK_DURATION) {
  const base = {
    x: numberOr(object.x, 0),
    y: numberOr(object.y, 0),
    width: Math.max(1, numberOr(object.width, 1)),
    height: Math.max(1, numberOr(object.height, 1)),
    rotation: numberOr(object.rotation, 0),
    flipX: normalizeFlipFlag(object.flipX),
    flipY: normalizeFlipFlag(object.flipY),
    opacity: 1,
    scale: 1,
  };
  if (!canAnimateObjectData(object) || !hasObjectAnimation(object)) {
    return base;
  }

  const config = getObjectAnimationConfig(object);
  const time = Math.max(0, numberOr(timeSeconds, 0));
  const entranceTime = time - config.animationInDelay;
  const state = { ...base };

  if (config.animationMove === "move") {
    const moveProgress = clamp(time / config.animationMoveDuration, 0, 1);
    const easedMoveProgress =
      config.animationMoveEasing === "easeOut"
        ? easeOutCubic(moveProgress)
        : config.animationMoveEasing === "easeInOut"
          ? moveProgress < 0.5
            ? 4 * moveProgress * moveProgress * moveProgress
            : 1 - Math.pow(-2 * moveProgress + 2, 3) / 2
          : moveProgress;
    state.x = config.animationMoveFromX + (config.animationMoveToX - config.animationMoveFromX) * easedMoveProgress;
    state.y = config.animationMoveFromY + (config.animationMoveToY - config.animationMoveFromY) * easedMoveProgress;
  }

  if (config.animationInDelay > 0 && entranceTime < 0) {
    state.opacity = 0;
  } else if (config.animationIn === "fade" && entranceTime < 0.45) {
    state.opacity *= clamp(entranceTime / 0.45, 0, 1);
  } else if (config.animationIn === "pop" && entranceTime < 0.45) {
    const progress = clamp(entranceTime / 0.45, 0, 1);
    if (progress < 0.72) {
      state.scale *= 0.82 + easeOutCubic(progress / 0.72) * 0.24;
    } else {
      state.scale *= 1.06 - easeOutCubic((progress - 0.72) / 0.28) * 0.06;
    }
  } else if (config.animationIn === "slideUp" && entranceTime < 0.5) {
    state.y += (1 - easeOutCubic(entranceTime / 0.5)) * 28;
  }

  const periodFactor = ANIMATION_SPEED_PERIOD_FACTORS[config.animationSpeed] || 1;
  if (config.animationLoop !== "none") {
    const period = (ANIMATION_LOOP_PERIOD_SECONDS[config.animationLoop] || 1) * periodFactor;
    const phase = (time % period) / period;
    const angle = phase * Math.PI * 2;
    const wave = Math.sin(angle);
    const riseAndFall = (1 - Math.cos(angle)) / 2;
    if (config.animationLoop === "spin") {
      state.rotation += phase * 360;
    } else if (config.animationLoop === "shake") {
      state.x += wave * 5;
      state.rotation += wave * 1.5;
    } else if (config.animationLoop === "pulse") {
      state.scale *= 1 + riseAndFall * 0.08;
    } else if (config.animationLoop === "blink") {
      state.opacity *= getBlinkOpacityForPhase(angle);
    } else if (config.animationLoop === "float") {
      state.y += wave * 8;
    }
  }

  state.opacity = clamp(state.opacity, 0, 1);
  return state;
}

function getAnimatedObjectTransform(animatedState, baseState) {
  const translateX = animatedState.x - baseState.x;
  const translateY = animatedState.y - baseState.y;
  const scale = numberOr(animatedState.scale, 1);
  return `translate(${translateX}px, ${translateY}px) rotate(${animatedState.rotation}deg) scale(${scale})`;
}

function getSnapGuideElements() {
  let vertical = canvas.querySelector(".snap-guide.vertical");
  let horizontal = canvas.querySelector(".snap-guide.horizontal");
  if (!vertical) {
    vertical = document.createElement("div");
    vertical.className = "snap-guide vertical";
    vertical.setAttribute("aria-hidden", "true");
    canvas.append(vertical);
  }
  if (!horizontal) {
    horizontal = document.createElement("div");
    horizontal.className = "snap-guide horizontal";
    horizontal.setAttribute("aria-hidden", "true");
    canvas.append(horizontal);
  }
  return { vertical, horizontal };
}

function hideSnapGuides() {
  for (const guide of canvas.querySelectorAll(".snap-guide")) {
    guide.classList.remove("is-visible");
  }
}

function getScaledSafeAreaRect(canvasWidth = canvas.offsetWidth, canvasHeight = canvas.offsetHeight) {
  const width = Math.max(1, roundedCanvasSize(canvasWidth || DEFAULT_CANVAS_WIDTH));
  const height = Math.max(1, roundedCanvasSize(canvasHeight || DEFAULT_CANVAS_HEIGHT));
  const preset = SAFE_AREA_PRESETS[normalizeSafeAreaPreset(projectSettingsState.safeAreaPreset)] || SAFE_AREA_PRESETS[DEFAULT_SAFE_AREA_PRESET];
  const scaleX = width / preset.canonicalWidth;
  const scaleY = height / preset.canonicalHeight;
  const leftMargin = clamp(Math.round(preset.margins.left * scaleX), 0, Math.max(0, width - 1));
  const rightMargin = clamp(Math.round(preset.margins.right * scaleX), 0, Math.max(0, width - leftMargin - 1));
  const topMargin = clamp(Math.round(preset.margins.top * scaleY), 0, Math.max(0, height - 1));
  const bottomMargin = clamp(Math.round(preset.margins.bottom * scaleY), 0, Math.max(0, height - topMargin - 1));
  const safeWidth = Math.max(1, width - leftMargin - rightMargin);
  const safeHeight = Math.max(1, height - topMargin - bottomMargin);

  return {
    left: leftMargin,
    top: topMargin,
    width: safeWidth,
    height: safeHeight,
    right: leftMargin + safeWidth,
    bottom: topMargin + safeHeight,
  };
}

function getSafeAreaSnapTargets(canvasWidth, canvasHeight) {
  if (!projectSettingsState.safeAreaSnapEnabled) {
    return { x: [], y: [] };
  }

  const rect = getScaledSafeAreaRect(canvasWidth, canvasHeight);
  return {
    x: [rect.left, rect.left + rect.width / 2, rect.right],
    y: [rect.top, rect.top + rect.height / 2, rect.bottom],
  };
}

function updateSafeAreaOverlay() {
  let overlay = canvas.querySelector(".safe-area-overlay");
  if (!projectSettingsState.safeAreaSnapEnabled) {
    overlay?.classList.remove("is-visible");
    return;
  }

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "safe-area-overlay";
    overlay.setAttribute("aria-hidden", "true");
    canvas.append(overlay);
  }

  const rect = getScaledSafeAreaRect();
  overlay.style.left = `${rect.left}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.dataset.safeAreaPreset = normalizeSafeAreaPreset(projectSettingsState.safeAreaPreset);
  overlay.classList.add("is-visible");
}

function updateSnapGuides(snap) {
  const { vertical, horizontal } = getSnapGuideElements();
  const canvasWidth = canvas.offsetWidth;
  const canvasHeight = canvas.offsetHeight;

  if (Number.isFinite(snap?.snapX)) {
    vertical.style.left = `${snap.snapX}px`;
    vertical.style.height = `${canvasHeight}px`;
    vertical.classList.add("is-visible");
  } else {
    vertical.classList.remove("is-visible");
  }

  if (Number.isFinite(snap?.snapY)) {
    horizontal.style.top = `${snap.snapY}px`;
    horizontal.style.width = `${canvasWidth}px`;
    horizontal.classList.add("is-visible");
  } else {
    horizontal.classList.remove("is-visible");
  }
}

function findSnapDelta(markers, targets, threshold) {
  let best = null;
  for (const marker of markers) {
    for (const target of targets) {
      const distance = Math.abs(marker - target);
      if (distance <= threshold && (!best || distance < best.distance)) {
        best = {
          distance,
          delta: target - marker,
          guide: target,
        };
      }
    }
  }
  return best;
}

function getMoveSnapState(state) {
  const canvasWidth = canvas.offsetWidth;
  const canvasHeight = canvas.offsetHeight;
  const threshold = MOVE_SNAP_SCREEN_THRESHOLD / Math.max(canvasViewScale, 0.05);
  const xMarkers = [state.x, state.x + state.width / 2, state.x + state.width];
  const yMarkers = [state.y, state.y + state.height / 2, state.y + state.height];
  const safeAreaTargets = getSafeAreaSnapTargets(canvasWidth, canvasHeight);
  const xSnap = findSnapDelta(xMarkers, [0, canvasWidth / 2, canvasWidth, ...safeAreaTargets.x], threshold);
  const ySnap = findSnapDelta(yMarkers, [0, canvasHeight / 2, canvasHeight, ...safeAreaTargets.y], threshold);

  return {
    ...state,
    x: xSnap ? state.x + xSnap.delta : state.x,
    y: ySnap ? state.y + ySnap.delta : state.y,
    snapX: xSnap?.guide,
    snapY: ySnap?.guide,
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
    a.rotation === b.rotation &&
    a.flipX === b.flipX &&
    a.flipY === b.flipY
  );
}

function applyState(element, nextState) {
  const previousWidth = Number(element.dataset.width);
  const state = {
    x: numberOr(nextState.x, 0),
    y: numberOr(nextState.y, 0),
    width: Math.max(8, numberOr(nextState.width, 8)),
    height: Math.max(8, numberOr(nextState.height, 8)),
    rotation: numberOr(nextState.rotation, 0),
    flipX: nextState.flipX === undefined ? normalizeFlipFlag(element.dataset.flipX) : normalizeFlipFlag(nextState.flipX),
    flipY: nextState.flipY === undefined ? normalizeFlipFlag(element.dataset.flipY) : normalizeFlipFlag(nextState.flipY),
  };

  element.dataset.x = String(state.x);
  element.dataset.y = String(state.y);
  element.dataset.width = String(state.width);
  element.dataset.height = String(state.height);
  element.dataset.rotation = String(state.rotation);
  element.dataset.flipX = String(state.flipX);
  element.dataset.flipY = String(state.flipY);

  element.style.left = `${state.x}px`;
  element.style.top = `${state.y}px`;
  element.style.width = `${state.width}px`;
  element.style.height = `${state.height}px`;
  element.style.transform = `rotate(${state.rotation}deg)`;
  const image = element.querySelector("img");
  if (image) {
    image.style.transform = `scale(${state.flipX ? -1 : 1}, ${state.flipY ? -1 : 1})`;
  }

  if (element.dataset.type === "text") {
    renderTextObject(element);
    if (
      element.classList.contains("is-editing") &&
      element.dataset.isFittingTextHeight !== "true" &&
      state.width !== previousWidth
    ) {
      fitTextBoxToContent(element);
    }
  }

  if (element.dataset.type === "shape") {
    renderShapeObject(element);
  }

  if (element === selectedObject) {
    syncSelectedInputs();
  }
}

function resetObjectAnimationPreview(element) {
  const state = getState(element);
  element.style.transform = `rotate(${state.rotation}deg)`;
  element.style.opacity = "";
}

function updateObjectAnimationPreview(timeSeconds, durationSeconds) {
  for (const element of canvas.querySelectorAll(".object")) {
    const data = getElementAnimationData(element);
    if (!canAnimateObjectData(data) || !hasObjectAnimation(data)) {
      resetObjectAnimationPreview(element);
      continue;
    }
    const animatedState = getObjectAnimationState(data, timeSeconds, durationSeconds);
    element.style.transform = getAnimatedObjectTransform(animatedState, data);
    element.style.opacity = String(animatedState.opacity);
  }
}

function canvasHasObjectAnimations() {
  return [...canvas.querySelectorAll(".object")].some((element) => {
    const data = getElementAnimationData(element);
    return canAnimateObjectData(data) && hasObjectAnimation(data);
  });
}

function canvasHasLoopAnimations() {
  return [...canvas.querySelectorAll(".object")].some((element) => {
    const data = getElementAnimationData(element);
    return canAnimateObjectData(data) && hasLoopAnimation(data);
  });
}

function stopObjectAnimationPreview() {
  if (objectAnimationPreviewFrame) {
    window.cancelAnimationFrame(objectAnimationPreviewFrame);
  }
  objectAnimationPreviewFrame = null;
  objectAnimationPreviewStart = 0;
  for (const element of canvas.querySelectorAll(".object")) {
    resetObjectAnimationPreview(element);
  }
}

function runObjectAnimationPreview(timestamp) {
  if (!canvasHasObjectAnimations()) {
    stopObjectAnimationPreview();
    return;
  }
  if (!objectAnimationPreviewStart) {
    objectAnimationPreviewStart = timestamp;
  }
  const oneShotDuration = getCanvasObjectAnimationDuration();
  const hasLoop = canvasHasLoopAnimations();
  const time = (timestamp - objectAnimationPreviewStart) / 1000;
  const duration = Math.max(VIDEO_EXPORT_FALLBACK_DURATION, oneShotDuration);
  updateObjectAnimationPreview(time, duration);
  if (!hasLoop && time >= Math.max(0.5, oneShotDuration)) {
    objectAnimationPreviewFrame = null;
    objectAnimationPreviewStart = 0;
    return;
  }
  objectAnimationPreviewFrame = window.requestAnimationFrame(runObjectAnimationPreview);
}

function syncObjectAnimationPreview() {
  if (!canvasHasObjectAnimations()) {
    stopObjectAnimationPreview();
    return;
  }
  if (!objectAnimationPreviewFrame) {
    objectAnimationPreviewFrame = window.requestAnimationFrame(runObjectAnimationPreview);
  }
}

function syncTextEditorValue(element, options = {}) {
  if (!element || element.dataset.type !== "text" || !element.classList.contains("is-editing")) {
    return false;
  }
  const editor = element.querySelector(".text-editor");
  element.dataset.text = editor.value;
  const fitted = fitTextBoxToContent(element);
  if (!fitted && options.render !== false) {
    renderTextObject(element);
  }
  return fitted;
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
  const selectedImageObjects = selectedObjects.filter((object) => object.dataset.type === "image");
  const hasImageSelection = selectedImageObjects.length > 0;
  const hasAnimationSelection = canAnimateElement(selectedObject);
  selectedPanel.hidden = !hasSelection;
  selectedPanel.classList.toggle("is-empty", !hasSelection);
  const visibleSections = {
    position: hasSelection,
    image: hasImageSelection,
    animation: hasAnimationSelection,
    text: hasTextSelection,
    layer: hasSelection,
    actions: hasSelection,
  };
  for (const [key, section] of Object.entries(selectedSections)) {
    section.hidden = !visibleSections[key];
  }
  for (const input of [selectedX, selectedY, selectedW, selectedH, selectedR]) {
    input.disabled = !hasSelection;
  }
  for (const button of imageFlipButtons) {
    const axis = button.dataset.imageFlip;
    const isActive =
      hasImageSelection &&
      selectedImageObjects.every((object) => normalizeFlipFlag(axis === "y" ? object.dataset.flipY : object.dataset.flipX));
    button.disabled = !hasImageSelection;
    button.classList.toggle("is-active", isActive);
  }
  for (const button of Object.values(arrangeButtons)) {
    button.disabled = !hasSelection;
  }
  for (const button of textSizeButtons) {
    button.disabled = !hasTextSelection;
  }
  for (const button of textFontButtons) {
    button.disabled = !hasTextSelection;
  }
  for (const button of textWeightButtons) {
    button.disabled = !hasTextSelection;
  }
  for (const button of textStyleButtons) {
    button.disabled = !hasTextSelection;
  }
  for (const button of textAlignButtons) {
    button.disabled = !hasTextSelection;
  }
  for (const button of [...animationInButtons, ...animationLoopButtons, ...animationSpeedButtons]) {
    button.disabled = !hasAnimationSelection;
  }
  for (const button of [...animationMoveButtons, ...animationMoveEasingButtons, ...animationMovePointButtons]) {
    button.disabled = !hasAnimationSelection;
  }
  for (const input of [selectedAnimationInDelay, selectedMoveFromX, selectedMoveFromY, selectedMoveToX, selectedMoveToY, selectedMoveDuration]) {
    input.disabled = !hasAnimationSelection;
  }
  duplicateSelected.disabled = !hasSelection;
  selectedTextColor.disabled = !hasTextSelection;
  editSelectedText.disabled = !hasTextSelection;
  editSelectedText.hidden = !hasTextSelection;
  selectedActions.classList.toggle("is-text-selection", hasTextSelection);
  setButtonLabel(editSelectedText, activeTextEditObject === selectedObject ? "Done" : "Edit Text");
  deleteSelected.disabled = !hasSelection;

  if (!selectedObject) {
    selectedX.value = "";
    selectedY.value = "";
    selectedW.value = "";
    selectedH.value = "";
    selectedR.value = "";
    setActiveTextSizeButton("h3");
    setActiveTextFontButton(DEFAULT_TEXT_FONT_FAMILY, DEFAULT_TEXT_FONT_WEIGHT);
    setActiveTextWeightButton(DEFAULT_TEXT_FONT_WEIGHT);
    setActiveTextStyleButton(DEFAULT_TEXT_EFFECT);
    setActiveTextAlignButton("left");
    syncAnimationButtons({
      animationIn: DEFAULT_ANIMATION_IN,
      animationInDelay: DEFAULT_ANIMATION_IN_DELAY,
      animationLoop: DEFAULT_ANIMATION_LOOP,
      animationSpeed: DEFAULT_ANIMATION_SPEED,
      animationMove: DEFAULT_ANIMATION_MOVE,
      animationMoveEasing: DEFAULT_ANIMATION_MOVE_EASING,
    });
    selectedMoveFromX.value = "";
    selectedMoveFromY.value = "";
    selectedMoveToX.value = "";
    selectedMoveToY.value = "";
    selectedMoveDuration.value = "";
    selectedAnimationInDelay.value = "";
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
  setActiveTextFontButton(selectedObject.dataset.fontFamily, selectedObject.dataset.fontWeight);
  setActiveTextWeightButton(selectedObject.dataset.fontWeight);
  setActiveTextStyleButton(selectedObject.dataset.textEffect || DEFAULT_TEXT_EFFECT);
  setActiveTextAlignButton(selectedObject.dataset.textAlign || "left");
  const animationData = getElementAnimationData(selectedObject);
  const hasMoveAnimation = sanitizeAnimationMove(animationData.animationMove) === "move";
  syncAnimationButtons(animationData);
  selectedAnimationInDelay.value = String(sanitizeAnimationInDelay(animationData.animationInDelay));
  selectedMoveFromX.value = Math.round(hasMoveAnimation ? sanitizeAnimationMoveCoordinate(animationData.animationMoveFromX) : state.x);
  selectedMoveFromY.value = Math.round(hasMoveAnimation ? sanitizeAnimationMoveCoordinate(animationData.animationMoveFromY) : state.y);
  selectedMoveToX.value = Math.round(hasMoveAnimation ? sanitizeAnimationMoveCoordinate(animationData.animationMoveToX) : state.x);
  selectedMoveToY.value = Math.round(hasMoveAnimation ? sanitizeAnimationMoveCoordinate(animationData.animationMoveToY) : state.y);
  selectedMoveDuration.value = String(sanitizeAnimationMoveDuration(animationData.animationMoveDuration));
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

function getClosestTextFontButton(fontFamily, fontWeight) {
  const safeFamily = sanitizeTextFontFamily(fontFamily);
  const safeWeight = sanitizeTextFontWeight(fontWeight);
  let closestButton = null;
  let closestWeightDistance = Infinity;

  for (const button of textFontButtons) {
    const buttonFamily = sanitizeTextFontFamily(button.dataset.textFont);
    if (buttonFamily !== safeFamily) {
      continue;
    }

    const buttonWeight = sanitizeTextFontWeight(button.dataset.textFontWeight);
    if (buttonWeight === safeWeight) {
      return button;
    }

    const weightDistance = Math.abs(buttonWeight - safeWeight);
    if (weightDistance < closestWeightDistance) {
      closestButton = button;
      closestWeightDistance = weightDistance;
    }
  }

  return closestButton;
}

function setActiveTextFontButton(fontFamily, fontWeight) {
  const activeButton = getClosestTextFontButton(fontFamily, fontWeight);
  for (const button of textFontButtons) {
    button.classList.toggle("is-active", button === activeButton);
  }
}

function getClosestTextWeightButton(fontWeight) {
  const safeWeight = sanitizeTextFontWeight(fontWeight);
  let closestButton = null;
  let closestWeightDistance = Infinity;

  for (const button of textWeightButtons) {
    const buttonWeight = sanitizeTextFontWeight(button.dataset.textWeight);
    if (buttonWeight === safeWeight) {
      return button;
    }

    const weightDistance = Math.abs(buttonWeight - safeWeight);
    if (weightDistance < closestWeightDistance) {
      closestButton = button;
      closestWeightDistance = weightDistance;
    }
  }

  return closestButton;
}

function setActiveTextWeightButton(fontWeight) {
  const activeButton = getClosestTextWeightButton(fontWeight);
  for (const button of textWeightButtons) {
    button.classList.toggle("is-active", button === activeButton);
  }
}

function setActiveTextStyleButton(effectKey) {
  const safeEffect = sanitizeTextEffect(effectKey);
  for (const button of textStyleButtons) {
    button.classList.toggle("is-active", button.dataset.textStyle === safeEffect);
  }
}

function setActiveAnimationButtons(buttons, dataKey, value) {
  for (const button of buttons) {
    button.classList.toggle("is-active", button.dataset[dataKey] === value);
  }
}

function syncAnimationButtons(config) {
  setActiveAnimationButtons(animationInButtons, "animationIn", sanitizeAnimationIn(config?.animationIn));
  setActiveAnimationButtons(animationLoopButtons, "animationLoop", sanitizeAnimationLoop(config?.animationLoop));
  setActiveAnimationButtons(animationSpeedButtons, "animationSpeed", sanitizeAnimationSpeed(config?.animationSpeed));
  setActiveAnimationButtons(animationMoveButtons, "animationMove", sanitizeAnimationMove(config?.animationMove));
  setActiveAnimationButtons(
    animationMoveEasingButtons,
    "animationMoveEasing",
    sanitizeAnimationMoveEasing(config?.animationMoveEasing)
  );
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

function detectColorPreset(canvasValue = settingsCanvasColor.value, textValue = getDefaultTextColorForCanvas(canvasValue)) {
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
      setStatus(`Selected ${selectedObjects.length} object${selectedObjects.length === 1 ? "" : "s"}.`);
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
  image.src = getDisplayAssetUrl(src);
  image.dataset.src = src;

  const maxWidth = canvas.clientWidth * 0.7;
  const maxHeight = canvas.clientHeight * 0.7;
  const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
  const width = Math.max(48, naturalWidth * scale);
  const height = Math.max(48, naturalHeight * scale);
  const position = centerPosition(width, height);

  element.dataset.id = `object-${++objectSeed}`;
  setDefaultAnimationDataset(element);
  canvas.append(element);
  attachObjectEvents(element);
  applyState(element, { ...position, width, height, rotation: 0 });
  selectObject(element);
  setStatus("Image pasted. Drag corner handles to resize, the top handle to rotate.");
  recordHistory();
}

function blobToBase64(blob) {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  });
}

function loadImageElementFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to read image."));
    };
    image.src = url;
  });
}

function getConstrainedImageSize(width, height, maxDimension = IMAGE_IMPORT_MAX_DIMENSION) {
  const safeWidth = Math.max(1, Math.round(width || 1));
  const safeHeight = Math.max(1, Math.round(height || 1));
  const scale = Math.min(1, maxDimension / Math.max(safeWidth, safeHeight));
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

function isGifBlob(blob) {
  return /^image\/gif$/i.test(blob?.type || "");
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function canvasHasTransparentPixels(context, width, height) {
  const { data } = context.getImageData(0, 0, width, height);
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) {
      return true;
    }
  }
  return false;
}

async function optimizeImageBlob(blob, image, name = "image") {
  const naturalWidth = image.naturalWidth || image.width || 1;
  const naturalHeight = image.naturalHeight || image.height || 1;
  if (isGifBlob(blob)) {
    const gifName = String(name || "image").replace(/\.[a-z0-9]+$/i, "");
    return {
      blob,
      width: naturalWidth,
      height: naturalHeight,
      name: `${gifName || "image"}.gif`,
    };
  }

  const size = getConstrainedImageSize(naturalWidth, naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, size.width, size.height);

  const hasTransparency = !/^image\/jpe?g$/i.test(blob.type || "") && canvasHasTransparentPixels(context, size.width, size.height);
  const mimeType = hasTransparency ? "image/png" : "image/jpeg";
  const extension = hasTransparency ? "png" : "jpg";
  const output = await canvasToBlob(canvas, mimeType, hasTransparency ? undefined : IMAGE_IMPORT_JPEG_QUALITY);
  return {
    blob: output || blob,
    width: size.width,
    height: size.height,
    name: `clipboard-image.${extension}`,
  };
}

async function ensureActiveProjectForAsset() {
  if (activeProjectId) {
    return activeProjectId;
  }
  const record = await saveActiveNativeProject({ forceCreate: true });
  if (!record?.meta?.id) {
    throw new Error("Failed to create a project to store the image.");
  }
  return record.meta.id;
}

async function importImageBlobAsset(blob, name = "clipboard-image") {
  const projectId = await ensureActiveProjectForAsset();
  const dataBase64 = await blobToBase64(blob);
  return nativeApi.importImageBlob({
    projectId,
    dataBase64,
    mimeType: blob.type || "image/png",
    name,
  });
}

async function importImageFileAsset(path) {
  const projectId = await ensureActiveProjectForAsset();
  const importedAsset = await nativeApi.importProjectAsset(projectId, path);
  let width = numberOr(importedAsset.width, 0);
  let height = numberOr(importedAsset.height, 0);
  if (width <= 0 || height <= 0) {
    if (isAnimatedGifSource(importedAsset.path || path)) {
      width = 300;
      height = 200;
    } else {
      const image = await loadImageForRender(importedAsset.path);
      width = image.naturalWidth || image.width || 1;
      height = image.naturalHeight || image.height || 1;
    }
  }
  addImageObject(importedAsset.path, width, height);
}

function addTextObject(text, statusMessage = "Text pasted. The font is fixed to Pretendard.") {
  const cleanText = text.trimEnd();
  if (!cleanText) {
    setStatus("No text to paste.");
    return;
  }

  const element = textTemplate.content.firstElementChild.cloneNode(true);
  element.dataset.id = `object-${++objectSeed}`;
  element.dataset.text = cleanText;
  element.dataset.textSize = "h3";
  element.dataset.textAlign = "left";
  element.dataset.textColor = defaultTextColor;
  element.dataset.fontFamily = DEFAULT_TEXT_FONT_FAMILY;
  element.dataset.fontWeight = String(DEFAULT_TEXT_FONT_WEIGHT);
  element.dataset.textEffect = DEFAULT_TEXT_EFFECT;
  setDefaultAnimationDataset(element);
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
    setStatus("Select tool active. Move, rotate, or resize objects.");
  } else {
    const label = nextTool === "arrow" ? "arrow" : nextTool === "line" ? "line" : "pen stroke";
    setStatus(`Drag on the canvas to create a ${label} object.`);
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

function getArrowGeometry(start, end, strokeWidth) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.1) {
    return null;
  }

  const angle = Math.atan2(dy, dx);
  const length = Math.min(Math.max(16, strokeWidth * 4), Math.max(1, distance * 0.65));
  const halfWidth = Math.min(Math.max(7, strokeWidth * 1.8), Math.max(3, length * 0.55));
  const baseX = end.x - Math.cos(angle) * length;
  const baseY = end.y - Math.sin(angle) * length;
  const normalX = Math.cos(angle + Math.PI / 2);
  const normalY = Math.sin(angle + Math.PI / 2);

  return {
    shaftEnd: { x: baseX, y: baseY },
    headPoints: [
      { x: end.x, y: end.y },
      { x: baseX + normalX * halfWidth, y: baseY + normalY * halfWidth },
      { x: baseX - normalX * halfWidth, y: baseY - normalY * halfWidth },
    ],
  };
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
  const arrowGeometry = data.shapeKind === "arrow" ? getArrowGeometry(start, end, data.strokeWidth) : null;
  const lineEnd = arrowGeometry?.shaftEnd || end;
  svg.append(
    createSvgElement("line", {
      x1: start.x,
      y1: start.y,
      x2: lineEnd.x,
      y2: lineEnd.y,
      stroke: data.strokeColor,
      "stroke-width": data.strokeWidth,
      "stroke-linecap": "round",
    })
  );

  if (arrowGeometry) {
    svg.append(
      createSvgElement("polygon", {
        points: arrowGeometry.headPoints.map((point) => `${point.x},${point.y}`).join(" "),
        fill: data.strokeColor,
      })
    );
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
    // Pointer capture can fail during edge-case drags; document-level handlers still finish the draw.
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
    setStatus("Stroke too short — nothing was created.");
    return true;
  }

  selectObject(draft.element);
  setDrawTool("select", { silent: true });
  renderSlideList();
  setStatus("Object added. Move, rotate, or resize it while selected.");
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
  drawTextLines(context, text, width, height, true, element.dataset.textSize || "h3", element.dataset.textAlign || "left", {
    fontFamily: element.dataset.fontFamily,
    fontWeight: element.dataset.fontWeight,
    textEffect: element.dataset.textEffect,
    textColor: element.dataset.textColor,
  });
  delete context.__textColor;
  scheduleTextFontRerender(element);
}

function getTextContentHeight(element) {
  const state = getState(element);
  const preset = getTextPreset(element);
  const renderStyle = {
    ...getTextRenderStyle({
      fontFamily: element.dataset.fontFamily,
      fontWeight: element.dataset.fontWeight,
      textEffect: element.dataset.textEffect,
      textColor: element.dataset.textColor,
    }),
    fontSize: preset.fontSize,
    lineHeight: preset.lineHeight,
  };
  const outset = getTextEffectOutset(renderStyle);
  textMeasureContext.font = `${renderStyle.fontWeight} ${preset.fontSize}px ${quoteFontFamily(renderStyle.fontFamily)}`;
  const measureWidth = Math.max(1, state.width - outset.x * 2);
  const lines = wrapTextLines(textMeasureContext, element.dataset.text || "", measureWidth);
  const backgroundPadding = renderStyle.backgroundColor ? (renderStyle.backgroundPaddingY || 6) * 2 : 0;
  return Math.max(16, Math.ceil(lines.length * preset.lineHeight + TEXT_PADDING_Y * 2 + backgroundPadding + outset.y * 2));
}

function fitTextBoxToContent(element) {
  const state = getState(element);
  const nextHeight = getTextContentHeight(element);
  if (nextHeight === state.height) {
    return false;
  }

  element.dataset.isFittingTextHeight = "true";
  try {
    applyState(element, {
      ...state,
      height: nextHeight,
    });
    return true;
  } finally {
    delete element.dataset.isFittingTextHeight;
  }
}

function fitTextBoxToContentAfterWidthChange(element, previousWidth) {
  if (
    !element ||
    element.dataset.type !== "text" ||
    element.dataset.isFittingTextHeight === "true" ||
    getState(element).width === previousWidth
  ) {
    return false;
  }
  return fitTextBoxToContent(element);
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
  editor.style.fontFamily = quoteFontFamily(sanitizeTextFontFamily(element.dataset.fontFamily));
  editor.style.fontWeight = String(sanitizeTextFontWeight(element.dataset.fontWeight));
  editor.style.color = element.dataset.textColor || DEFAULT_TEXT_COLOR;
  editor.style.textAlign = sanitizeTextAlign(element.dataset.textAlign);
  window.requestAnimationFrame(() => {
    editor.focus({ preventScroll: true });
    selectEditableContent(editor);
  });
  syncSelectedInputs();
  setStatus("Editing text. Press Esc or Done to exit.");
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
    setStatus("Text editing ended.");
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
  hideSnapGuides();
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
    const nextState = {
      ...state,
      x: state.x + dx,
      y: state.y + dy,
    };
    const snappedState = event.altKey ? nextState : getMoveSnapState(nextState);
    applyState(element, snappedState);
    updateSnapGuides(event.altKey ? null : snappedState);
    return;
  }

  if (activePointer.type === "rotate") {
    hideSnapGuides();
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
  let width = Math.max(16, state.width + dx * horizontalSign);
  let height = Math.max(16, state.height + dy * verticalSign);
  if (element.dataset.type === "image" && event.shiftKey) {
    const aspectRatio = Math.max(0.01, state.width / Math.max(1, state.height));
    const widthRatio = Math.abs(width - state.width) / Math.max(1, state.width);
    const heightRatio = Math.abs(height - state.height) / Math.max(1, state.height);
    if (widthRatio >= heightRatio) {
      height = Math.max(16, width / aspectRatio);
    } else {
      width = Math.max(16, height * aspectRatio);
    }
  }
  const x = activePointer.handle.includes("w") ? state.x + (state.width - width) : state.x;
  const y = activePointer.handle.includes("n") ? state.y + (state.height - height) : state.y;

  hideSnapGuides();
  applyState(element, {
    ...state,
    x,
    y,
    width,
    height,
  });
  fitTextBoxToContentAfterWidthChange(element, state.width);
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
  hideSnapGuides();
  if (changed) {
    renderSlideList();
    recordHistory();
  }
}

async function pasteImageFromClipboard() {
  if (!navigator.clipboard?.read) {
    setStatus("Clipboard image read is not available in this desktop environment. Use Cmd+V to paste.");
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
    setStatus("No image found on the clipboard.");
  } catch (error) {
    setStatus("Permission required to paste images. Try Cmd+V instead.");
  }
}

async function loadImageBlob(blob, name = "clipboard-image") {
  if (!blob) {
    setStatus("Failed to read image.");
    return;
  }

  setStatus("Optimizing image and saving to project assets...");
  const image = await loadImageElementFromBlob(blob);
  const optimized = await optimizeImageBlob(blob, image, name);
  const importedAsset = await importImageBlobAsset(optimized.blob, optimized.name || name);
  addImageObject(importedAsset.path, optimized.width, optimized.height);
}

async function chooseImageFileForCurrentSlide() {
  try {
    const path = await nativeApi.selectImageFile();
    if (!path) {
      return;
    }
    setStatus(`Saving ${isAnimatedGifSource(path) ? "GIF" : "image"} to project assets...`);
    await importImageFileAsset(path);
  } catch (error) {
    setStatus(error?.message || "Failed to add image file.");
  }
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
  context.drawImage(image, 0, 0, width, height);
}

function drawFlippedFittedImage(context, image, width, height, data = {}) {
  const flipX = normalizeFlipFlag(data.flipX);
  const flipY = normalizeFlipFlag(data.flipY);
  context.save();
  if (flipX || flipY) {
    context.translate(width / 2, height / 2);
    context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    context.translate(-width / 2, -height / 2);
  }
  drawFittedImage(context, image, width, height);
  context.restore();
}

function drawCoverMedia(context, media, width, height) {
  const naturalWidth = media.videoWidth || media.naturalWidth || width;
  const naturalHeight = media.videoHeight || media.naturalHeight || height;
  const scale = Math.max(width / naturalWidth, height / naturalHeight);
  const drawWidth = naturalWidth * scale;
  const drawHeight = naturalHeight * scale;
  context.drawImage(media, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function sanitizeVideoFit(value) {
  return VIDEO_FIT_MODES[value] ? value : DEFAULT_VIDEO_FIT;
}

function sanitizeVideoFrameRatio(value) {
  return VIDEO_FRAME_RATIO_MODES[value] ? value : DEFAULT_VIDEO_FRAME_RATIO;
}

function getVideoFrameRect(width, height, frameRatio = DEFAULT_VIDEO_FRAME_RATIO) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const ratio = VIDEO_FRAME_RATIO_MODES[sanitizeVideoFrameRatio(frameRatio)]?.ratio;
  if (!ratio) {
    return {
      x: 0,
      y: 0,
      width: safeWidth,
      height: safeHeight,
    };
  }

  const canvasRatio = safeWidth / safeHeight;
  let frameWidth = safeWidth;
  let frameHeight = safeHeight;
  if (canvasRatio > ratio) {
    frameWidth = safeHeight * ratio;
  } else {
    frameHeight = safeWidth / ratio;
  }

  return {
    x: (safeWidth - frameWidth) / 2,
    y: (safeHeight - frameHeight) / 2,
    width: frameWidth,
    height: frameHeight,
  };
}

function drawBackgroundMedia(context, media, width, height, fit = DEFAULT_VIDEO_FIT, frameRatio = DEFAULT_VIDEO_FRAME_RATIO) {
  const safeFit = sanitizeVideoFit(fit);
  const frame = getVideoFrameRect(width, height, frameRatio);
  context.save();
  context.beginPath();
  context.rect(frame.x, frame.y, frame.width, frame.height);
  context.clip();
  if (safeFit === "stretch") {
    context.drawImage(media, frame.x, frame.y, frame.width, frame.height);
    context.restore();
    return;
  }

  if (safeFit === "fit") {
    context.fillStyle = "#000000";
    context.fillRect(frame.x, frame.y, frame.width, frame.height);
  }

  const naturalWidth = media.videoWidth || media.naturalWidth || frame.width;
  const naturalHeight = media.videoHeight || media.naturalHeight || frame.height;
  const scale =
    safeFit === "fit"
      ? Math.min(frame.width / naturalWidth, frame.height / naturalHeight)
      : Math.max(frame.width / naturalWidth, frame.height / naturalHeight);
  const drawWidth = naturalWidth * scale;
  const drawHeight = naturalHeight * scale;
  context.drawImage(media, frame.x + (frame.width - drawWidth) / 2, frame.y + (frame.height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
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

function drawTextObject(context, object, width, height) {
  context.__textColor = object.dataset.textColor || DEFAULT_TEXT_COLOR;
  drawTextLines(
    context,
    object.dataset.text || "",
    width,
    height,
    false,
    object.dataset.textSize || "h3",
    object.dataset.textAlign || "left",
    {
      fontFamily: object.dataset.fontFamily,
      fontWeight: object.dataset.fontWeight,
      textEffect: object.dataset.textEffect,
      textColor: object.dataset.textColor,
    }
  );
  delete context.__textColor;
}

function traceRoundedRect(context, x, y, width, height, radius) {
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
}

function fillRoundedRect(context, x, y, width, height, radius) {
  traceRoundedRect(context, x, y, width, height, radius);
  context.fill();
}

function strokeRoundedRect(context, x, y, width, height, radius) {
  traceRoundedRect(context, x, y, width, height, radius);
  context.stroke();
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

function getSubtitleTextMetrics(width, options = {}) {
  const subtitleSize = normalizeSubtitleSize(options.subtitleSize);
  const baseFontSize = clamp(Math.round(width * 0.032), 22, 34);
  const fontSize = clamp(Math.round(baseFontSize * (subtitleSize / 100)), 14, 72);
  return {
    fontSize,
    lineHeight: Math.round(fontSize * 1.24),
  };
}

function getSubtitleLayout(context, text, width, height, options = {}) {
  const cleanText = String(text || "").trim();
  if (!cleanText) {
    return null;
  }

  const subtitleStyleMode = normalizeSubtitleStyleMode(options.subtitleStyleMode);
  const subtitleY = normalizeSubtitleY(options.subtitleY);
  const { fontSize, lineHeight } = getSubtitleTextMetrics(width, options);
  const paddingX = Math.round(fontSize * 0.45);
  const paddingY = Math.round(fontSize * 0.22);
  const maxTextWidth = Math.round(width * 0.78);
  const textEffect = normalizeSubtitleTextEffect(options.subtitleTextEffect);
  const renderStyle =
    subtitleStyleMode === "sticker"
      ? {
          ...getTextRenderStyle({
            textEffect,
          }),
          fontSize,
          lineHeight,
        }
      : null;
  const fontFamily =
    subtitleStyleMode === "sticker" ? renderStyle.fontFamily : normalizeSubtitleFontFamily(options.subtitleFontFamily);
  const fontWeight =
    subtitleStyleMode === "sticker" ? renderStyle.fontWeight : normalizeSubtitleFontWeight(options.subtitleFontWeight);

  context.save();
  context.font = `${fontWeight} ${fontSize}px ${quoteFontFamily(fontFamily)}`;
  const lines = trimSubtitleLines(wrapTextLines(context, cleanText, maxTextWidth + TEXT_PADDING_X * 2), SUBTITLE_MAX_LINES);
  const measuredWidth = Math.min(maxTextWidth, Math.max(...lines.map((line) => context.measureText(line).width)));
  context.restore();
  const stickerOutset = renderStyle ? getTextEffectOutset(renderStyle) : { x: 0, y: 0 };
  const stickerPaddingX = renderStyle?.backgroundColor ? Math.max(paddingX, renderStyle.backgroundPaddingX || 12) : paddingX;
  const stickerPaddingY = renderStyle?.backgroundColor ? Math.max(paddingY, renderStyle.backgroundPaddingY || 6) : paddingY;
  const boxWidth = Math.min(width - 48, Math.ceil(measuredWidth + stickerPaddingX * 2 + stickerOutset.x * 2));
  const boxHeight = Math.ceil(lines.length * lineHeight + stickerPaddingY * 2 + stickerOutset.y * 2);
  const boxX = (width - boxWidth) / 2;
  const verticalMargin = Math.round(height * 0.02);
  const targetCenterY = (height * subtitleY) / 100;
  const maxBoxY = Math.max(verticalMargin, height - boxHeight - verticalMargin);
  const boxY = clamp(targetCenterY - boxHeight / 2, verticalMargin, maxBoxY);
  const bottomOffset = Math.max(0, height - boxY - boxHeight);
  return {
    subtitleStyleMode,
    textEffect,
    fontSize,
    fontFamily,
    fontWeight,
    lineHeight,
    paddingY,
    lines,
    boxWidth,
    boxHeight,
    boxX,
    boxY,
    bottomOffset,
    subtitleY,
  };
}

function getSubtitleReservedHeight(context, text, width, height, options = {}) {
  const layout = getSubtitleLayout(context, text, width, height, options);
  if (!layout) {
    return 0;
  }
  if (layout.subtitleY < 70) {
    return 0;
  }
  return Math.ceil(layout.boxHeight + layout.bottomOffset + Math.round(height * 0.03));
}

function drawSubtitleBox(context, text, width, height, options = {}) {
  const layout = getSubtitleLayout(context, text, width, height, options);
  if (!layout) {
    return;
  }

  const { subtitleStyleMode, textEffect, fontSize, fontFamily, fontWeight, lineHeight, paddingY, lines, boxWidth, boxHeight, boxX, boxY } = layout;
  if (subtitleStyleMode === "sticker") {
    context.save();
    context.translate(boxX, boxY);
    drawTextLines(context, lines.join("\n"), boxWidth, boxHeight, false, "h3", "center", {
      textEffect,
      fontSize,
      lineHeight,
    });
    context.restore();
    return;
  }

  context.save();
  context.fillStyle = "rgba(0, 0, 0, 0.8)";
  fillRoundedRect(context, boxX, boxY, boxWidth, boxHeight, 6);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.font = `${fontWeight} ${fontSize}px ${quoteFontFamily(fontFamily)}`;
  for (const [index, line] of lines.entries()) {
    context.fillText(line, width / 2, boxY + paddingY + index * lineHeight);
  }
  context.restore();
}

function getExportNotesText(notes) {
  return String(notes || "").replace(/\r\n/g, "\n").trim();
}

function splitNotesForTtsSegments(notes) {
  const cleanText = getExportNotesText(notes);
  if (!cleanText) {
    return [];
  }
  return cleanText
    .split(/\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

let isRenderingNoteSegments = false;

function sanitizeNoteSegmentValue(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}

function splitNotesForEditorSegments(notes) {
  const cleanText = getExportNotesText(notes);
  if (!cleanText) {
    return [];
  }
  return cleanText
    .split(/\n+/)
    .map(sanitizeNoteSegmentValue)
    .filter(Boolean);
}

function normalizeNoteSegmentAudio(value) {
  return normalizeAudioAsset(value);
}

function createNoteSegmentsFromNotes(notes) {
  return splitNotesForEditorSegments(notes).map((text) => ({
    text,
    audio: null,
  }));
}

function normalizeNoteSegment(value) {
  if (typeof value === "string") {
    return {
      text: sanitizeNoteSegmentValue(value),
      audio: null,
    };
  }
  return {
    text: sanitizeNoteSegmentValue(value?.text),
    audio: normalizeNoteSegmentAudio(value?.audio),
  };
}

function normalizeNoteSegments(value, fallbackNotes = "") {
  const segments = Array.isArray(value)
    ? value.map(normalizeNoteSegment).filter((segment) => segment.text || segment.audio)
    : [];
  return segments.length ? segments : createNoteSegmentsFromNotes(fallbackNotes);
}

function noteSegmentsEqual(a, b) {
  const left = normalizeNoteSegments(a);
  const right = normalizeNoteSegments(b);
  if (left.length !== right.length) {
    return false;
  }
  return left.every((segment, index) => {
    const other = right[index];
    return (
      segment.text === other.text &&
      (segment.audio?.path || "") === (other.audio?.path || "") &&
      (segment.audio?.name || "") === (other.audio?.name || "")
    );
  });
}

function getSlideNoteSegments(slide) {
  return normalizeNoteSegments(slide?.noteSegments, slide?.notes);
}

function getNoteSegmentRows() {
  return noteSegmentList ? [...noteSegmentList.querySelectorAll(".note-segment-row")] : [];
}

function getNoteSegmentInputs() {
  return noteSegmentList ? [...noteSegmentList.querySelectorAll(".note-segment-input")] : [];
}

function resizeNoteSegmentInput(input) {
  if (!input) {
    return;
  }
  input.style.height = "0px";
  const nextHeight = clamp(input.scrollHeight, 28, 82);
  input.style.height = `${nextHeight}px`;
  input.style.overflowY = input.scrollHeight > 82 ? "auto" : "hidden";
}

function updateNoteSegmentSummary() {
  if (!slideNotesSummary) {
    return;
  }
  const count = getNoteSegmentInputs().filter((input) => input.value.trim()).length;
  slideNotesSummary.textContent = `${count} subtitle line${count === 1 ? "" : "s"}`;
}

function renumberNoteSegments() {
  getNoteSegmentRows().forEach((row, index) => {
    const marker = row.querySelector(".note-segment-index");
    if (marker) {
      marker.textContent = String(index + 1);
    }
  });
}

function getNoteSegmentRowAudio(row) {
  if (!row?.dataset.audioPath) {
    return null;
  }
  return normalizeNoteSegmentAudio({
    path: row.dataset.audioPath,
    name: row.dataset.audioName,
  });
}

function setNoteSegmentRowAudio(row, audio) {
  if (!row) {
    return;
  }
  const normalized = normalizeNoteSegmentAudio(audio);
  if (normalized) {
    row.dataset.audioPath = normalized.path;
    row.dataset.audioName = normalized.name;
  } else {
    delete row.dataset.audioPath;
    delete row.dataset.audioName;
  }
  updateNoteSegmentAudioView(row);
}

function updateNoteSegmentAudioView(row) {
  if (!row) {
    return;
  }
  const audio = getNoteSegmentRowAudio(row);
  const audioName = row.querySelector(".note-segment-audio-name");
  const attachButton = row.querySelector("[data-note-segment-audio-action='attach']");
  const playButton = row.querySelector("[data-note-segment-audio-action='play']");
  const clearButton = row.querySelector("[data-note-segment-audio-action='clear']");
  row.classList.toggle("has-audio", Boolean(audio));
  if (audioName) {
    audioName.textContent = audio?.name || "TTS";
    audioName.title = audio?.name || "Uses generated TTS";
  }
  if (attachButton) {
    attachButton.title = audio ? "Replace narration audio" : "Attach narration audio";
    attachButton.setAttribute("aria-label", attachButton.title);
  }
  if (playButton) {
    playButton.disabled = !audio;
  }
  if (clearButton) {
    clearButton.disabled = !audio;
  }
}

function collectNoteSegments() {
  return getNoteSegmentRows()
    .map((row) => {
      const input = row.querySelector(".note-segment-input");
      return {
        text: sanitizeNoteSegmentValue(input?.value),
        audio: getNoteSegmentRowAudio(row),
      };
    })
    .filter((segment) => segment.text || segment.audio);
}

function collectNoteSegmentText(segments = collectNoteSegments()) {
  return segments
    .map((segment) => sanitizeNoteSegmentValue(segment.text))
    .filter(Boolean)
    .join("\n");
}

function syncSlideNotesFromSegments({ save = false, record = false } = {}) {
  if (isRenderingNoteSegments) {
    return;
  }
  const nextSegments = collectNoteSegments();
  const nextNotes = collectNoteSegmentText(nextSegments);
  const activeSlide = slides[activeSlideIndex];
  const changed =
    slideNotes.value !== nextNotes ||
    !noteSegmentsEqual(activeSlide?.noteSegments, nextSegments);
  slideNotes.value = nextNotes;
  if (activeSlide) {
    activeSlide.notes = nextNotes;
    activeSlide.noteSegments = nextSegments;
  }
  updateNoteSegmentSummary();
  if (!changed) {
    return;
  }
  if (save) {
    scheduleNativeProjectSave();
  }
  if (record) {
    recordHistory();
  }
}

function focusNoteSegmentInput(input) {
  if (!input) {
    return;
  }
  input.focus();
  const cursor = input.value.length;
  input.setSelectionRange(cursor, cursor);
}

async function chooseAudioForNoteSegment(row) {
  try {
    const path = await nativeApi.selectAudioFile();
    if (!path || !row) {
      return;
    }
    if (!activeProjectId) {
      await saveActiveNativeProject({ forceCreate: true });
    }
    const importedAsset = activeProjectId
      ? await nativeApi.importProjectAsset(activeProjectId, path)
      : { path, name: getFileNameFromPath(path) };
    setNoteSegmentRowAudio(row, {
      path: importedAsset.path,
      name: importedAsset.name || getFileNameFromPath(path),
    });
    syncSlideNotesFromSegments({ save: true, record: true });
    setStatus("Narration audio copied into the project and linked.");
  } catch (error) {
    setStatus(error?.message || "Failed to attach narration audio.");
  }
}

function playNoteSegmentAudio(row) {
  const audio = getNoteSegmentRowAudio(row);
  if (!audio) {
    return;
  }
  const player = new Audio(getDisplayAssetUrl(audio.path));
  player.play().catch((error) => {
    setStatus(error?.message || "Failed to play narration audio.");
  });
}

function clearNoteSegmentAudio(row) {
  if (!getNoteSegmentRowAudio(row)) {
    return;
  }
  setNoteSegmentRowAudio(row, null);
  syncSlideNotesFromSegments({ save: true, record: true });
  setStatus("Narration audio removed from this line.");
}

function createNoteSegmentRow(value = "") {
  const segment = normalizeNoteSegment(value);
  const row = document.createElement("div");
  row.className = "note-segment-row";

  const marker = document.createElement("span");
  marker.className = "note-segment-index";
  marker.setAttribute("aria-hidden", "true");

  const input = document.createElement("textarea");
  input.className = "note-segment-input";
  input.rows = 1;
  input.spellcheck = false;
  input.placeholder = "Subtitle line";
  input.value = segment.text;
  input.addEventListener("input", () => handleNoteSegmentInput(input));
  input.addEventListener("change", () => syncSlideNotesFromSegments({ record: true }));
  input.addEventListener("keydown", (event) => handleNoteSegmentKeyDown(event, input));
  input.addEventListener("paste", (event) => handleNoteSegmentPaste(event, input));

  const audioControls = document.createElement("div");
  audioControls.className = "note-segment-audio";

  const audioName = document.createElement("span");
  audioName.className = "note-segment-audio-name";

  const attachAudioButton = document.createElement("button");
  attachAudioButton.className = "note-segment-audio-button";
  attachAudioButton.type = "button";
  attachAudioButton.dataset.icon = "paperclip";
  attachAudioButton.dataset.noteSegmentAudioAction = "attach";
  attachAudioButton.addEventListener("click", () => chooseAudioForNoteSegment(row));

  const playAudioButton = document.createElement("button");
  playAudioButton.className = "note-segment-audio-button";
  playAudioButton.type = "button";
  playAudioButton.dataset.icon = "play";
  playAudioButton.dataset.noteSegmentAudioAction = "play";
  playAudioButton.title = "Play narration audio";
  playAudioButton.setAttribute("aria-label", "Play narration audio");
  playAudioButton.addEventListener("click", () => playNoteSegmentAudio(row));

  const clearAudioButton = document.createElement("button");
  clearAudioButton.className = "note-segment-audio-button danger";
  clearAudioButton.type = "button";
  clearAudioButton.dataset.icon = "x";
  clearAudioButton.dataset.noteSegmentAudioAction = "clear";
  clearAudioButton.title = "Remove narration audio";
  clearAudioButton.setAttribute("aria-label", "Remove narration audio");
  clearAudioButton.addEventListener("click", () => clearNoteSegmentAudio(row));

  audioControls.append(audioName, attachAudioButton, playAudioButton, clearAudioButton);

  const removeButton = document.createElement("button");
  removeButton.className = "note-segment-remove danger";
  removeButton.type = "button";
  removeButton.dataset.icon = "trash-2";
  removeButton.title = "Remove subtitle line";
  removeButton.setAttribute("aria-label", "Remove subtitle line");
  removeButton.addEventListener("click", () => removeNoteSegmentRow(row));

  row.append(marker, input, audioControls, removeButton);
  setNoteSegmentRowAudio(row, segment.audio);
  return row;
}

function insertNoteSegmentAfter(row, value = "", { focus = false } = {}) {
  if (!noteSegmentList) {
    return null;
  }
  const nextRow = createNoteSegmentRow(value);
  if (row?.nextSibling) {
    noteSegmentList.insertBefore(nextRow, row.nextSibling);
  } else {
    noteSegmentList.append(nextRow);
  }
  hydrateButtonIcons(nextRow);
  renumberNoteSegments();
  resizeNoteSegmentInput(nextRow.querySelector(".note-segment-input"));
  updateNoteSegmentSummary();
  if (focus) {
    focusNoteSegmentInput(nextRow.querySelector(".note-segment-input"));
  }
  return nextRow;
}

function handleNoteSegmentInput(input) {
  const normalizedValue = input.value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (normalizedValue.includes("\n")) {
    const segments = splitNotesForEditorSegments(normalizedValue);
    input.value = segments[0] || "";
    let anchorRow = input.closest(".note-segment-row");
    for (const segment of segments.slice(1)) {
      anchorRow = insertNoteSegmentAfter(anchorRow, segment);
    }
  }
  resizeNoteSegmentInput(input);
  syncSlideNotesFromSegments({ save: true });
}

function handleNoteSegmentKeyDown(event, input) {
  if (event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.isComposing) {
    event.preventDefault();
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const before = sanitizeNoteSegmentValue(input.value.slice(0, start));
    const after = sanitizeNoteSegmentValue(input.value.slice(end));
    input.value = before;
    resizeNoteSegmentInput(input);
    insertNoteSegmentAfter(input.closest(".note-segment-row"), after, { focus: true });
    syncSlideNotesFromSegments({ save: true, record: Boolean(before || after) });
    return;
  }

  if (event.key === "Backspace" && !input.value && getNoteSegmentRows().length > 1) {
    event.preventDefault();
    removeNoteSegmentRow(input.closest(".note-segment-row"));
  }
}

function handleNoteSegmentPaste(event, input) {
  const pastedText = event.clipboardData?.getData("text") || "";
  const segments = splitNotesForEditorSegments(pastedText);
  if (segments.length <= 1) {
    return;
  }

  event.preventDefault();
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  const prefix = input.value.slice(0, start);
  const suffix = input.value.slice(end);
  input.value = sanitizeNoteSegmentValue(`${prefix}${segments[0]}${suffix}`);
  resizeNoteSegmentInput(input);

  let anchorRow = input.closest(".note-segment-row");
  for (const segment of segments.slice(1)) {
    anchorRow = insertNoteSegmentAfter(anchorRow, segment);
  }
  syncSlideNotesFromSegments({ save: true, record: true });
  focusNoteSegmentInput(anchorRow?.querySelector(".note-segment-input"));
}

function removeNoteSegmentRow(row) {
  if (!row || !noteSegmentList) {
    return;
  }
  const rows = getNoteSegmentRows();
  const currentInput = row.querySelector(".note-segment-input");
  if (rows.length <= 1) {
    if (currentInput) {
      currentInput.value = "";
      resizeNoteSegmentInput(currentInput);
      focusNoteSegmentInput(currentInput);
    }
    syncSlideNotesFromSegments({ save: true, record: true });
    return;
  }

  const nextFocusInput =
    row.previousElementSibling?.querySelector(".note-segment-input") || row.nextElementSibling?.querySelector(".note-segment-input");
  row.remove();
  renumberNoteSegments();
  syncSlideNotesFromSegments({ save: true, record: true });
  focusNoteSegmentInput(nextFocusInput);
}

function addNoteSegment(value = "", { focus = true, record = false } = {}) {
  const rows = getNoteSegmentRows();
  const row = insertNoteSegmentAfter(rows[rows.length - 1], value, { focus });
  syncSlideNotesFromSegments({ save: true, record });
  return row;
}

function renderNoteSegmentsFromSlide(slide) {
  if (!noteSegmentList) {
    return;
  }
  isRenderingNoteSegments = true;
  const segments = getSlideNoteSegments(slide);
  noteSegmentList.replaceChildren(...(segments.length ? segments : [""]).map((segment) => createNoteSegmentRow(segment)));
  hydrateButtonIcons(noteSegmentList);
  renumberNoteSegments();
  for (const input of getNoteSegmentInputs()) {
    resizeNoteSegmentInput(input);
  }
  const normalizedSegments = collectNoteSegments();
  slideNotes.value = collectNoteSegmentText(normalizedSegments);
  if (slides[activeSlideIndex]) {
    slides[activeSlideIndex].notes = slideNotes.value;
    slides[activeSlideIndex].noteSegments = normalizedSegments;
  }
  updateNoteSegmentSummary();
  isRenderingNoteSegments = false;
}

function getNarrationSegmentsForExport(slide) {
  return getSlideNoteSegments(slide)
    .map((segment) => ({
      text: sanitizeNoteSegmentValue(segment.text),
      audioPath: segment.audio?.path || null,
    }))
    .filter((segment) => segment.text || segment.audioPath);
}

function estimateNoteFrameDuration(notes) {
  const text = String(notes || "").trim();
  if (!text) {
    return VIDEO_EXPORT_FALLBACK_DURATION;
  }
  const characterCount = text.replace(/\s+/g, "").length;
  return clamp(characterCount / 7 + 1.2, VIDEO_EXPORT_FALLBACK_DURATION, DYNAMIC_MAX_DURATION);
}

function estimateSegmentedNoteFrameDuration(notes) {
  const segments = splitNotesForTtsSegments(notes);
  if (segments.length <= 1) {
    return estimateNoteFrameDuration(notes);
  }
  const totalDuration = segments.reduce((sum, segment) => sum + estimateNoteFrameDuration(segment), 0);
  return clamp(totalDuration, VIDEO_EXPORT_FALLBACK_DURATION, DYNAMIC_MAX_DURATION);
}

function slideHasLoopAnimations(slide) {
  return (slide?.objects || []).some((object) => canAnimateObjectData(object) && hasLoopAnimation(object));
}

function getSlideAnimationFrameDuration(slide, notes = "") {
  const visualDuration = Math.max(
    isDynamicSlide(slide) ? getDynamicSlideDuration(slide) : VIDEO_EXPORT_FALLBACK_DURATION,
    getSlideObjectAnimationDuration(slide),
    VIDEO_EXPORT_FALLBACK_DURATION
  );
  if (slideHasLoopAnimations(slide) && String(notes || "").trim()) {
    const noteDuration = estimateSegmentedNoteFrameDuration(notes);
    const oneShotDuration = getSlideObjectAnimationDuration(slide);
    const loopDuration = oneShotDuration > 0 ? noteDuration * 1.5 : noteDuration;
    return Math.max(visualDuration, clamp(loopDuration, VIDEO_EXPORT_FALLBACK_DURATION, DYNAMIC_MAX_DURATION));
  }
  return visualDuration;
}

function getSubtitleTextForRender(slide, options = {}) {
  return typeof options.subtitleText === "string" ? options.subtitleText : slide.notes;
}

function getProjectSubtitleRenderOptions() {
  return {
    subtitleSize: projectSettingsState.subtitleSize,
    subtitleY: projectSettingsState.subtitleY,
    subtitleStyleMode: projectSettingsState.subtitleStyleMode,
    subtitleFontFamily: projectSettingsState.subtitleFontFamily,
    subtitleFontWeight: projectSettingsState.subtitleFontWeight,
    subtitleTextEffect: projectSettingsState.subtitleTextEffect,
  };
}

async function renderSubtitleOverlayToDataUrl(slide, text, options = {}) {
  await ensureTextFontsReady([getSubtitleFontRequest(options)]);
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = Math.max(1, roundedCanvasSize(slide.width));
  exportCanvas.height = Math.max(1, roundedCanvasSize(slide.height));
  const context = exportCanvas.getContext("2d");
  drawSubtitleBox(context, text, exportCanvas.width, exportCanvas.height, options);
  return exportCanvas.toDataURL("image/png");
}

async function renderSubtitleImagesForSegments(slide, segments) {
  if (!projectSettingsState.subtitleEnabled || !segments.length) {
    return [];
  }
  return Promise.all(
    segments.map((segment) =>
      renderSubtitleOverlayToDataUrl(slide, segment, {
        ...getProjectSubtitleRenderOptions(),
      })
    )
  );
}

function getGitTypingData(slide) {
  const data = {
    ...createDefaultGitTypingData(),
    ...(slide?.gitTyping || {}),
  };
  const content = stripGitSlideHelperText(typeof data.content === "string" ? data.content : "");
  const rawAfterContent = stripGitSlideHelperText(typeof data.afterContent === "string" ? data.afterContent : content);
  const afterContent = rawAfterContent || content;
  return {
    ...data,
    commits: sanitizeGitCommitOptions(data.commits),
    files: sanitizeGitFileOptions(data.files),
    typingSpeed: sanitizeTypingSpeed(slide?.gitTyping?.typingSpeed, DEFAULT_GIT_TYPING_SPEED),
    beforeContent: typeof data.beforeContent === "string" ? data.beforeContent : "",
    afterContent,
    beforePath: typeof data.beforePath === "string" ? data.beforePath : "",
    content: content || afterContent,
  };
}

function getGitEditorModel(data) {
  const beforeText = getCodeDisplayText(data.beforeContent);
  const afterText = getCodeDisplayText(typeof data.afterContent === "string" ? data.afterContent : data.content);
  const beforeLines = splitCodeLines(beforeText);
  const afterLines = splitCodeLines(afterText);
  const lineEdits = computeAfterLineEdits(beforeLines, afterLines);
  const changedLineIndexes = lineEdits
    .map((edit, index) => (edit.changed ? index : -1))
    .filter((index) => index >= 0);
  return {
    beforeText,
    afterText,
    beforeLines,
    afterLines,
    lineEdits,
    changedLineIndexes,
  };
}

function createLineEditState(afterLines) {
  return afterLines.map(() => ({
    changed: false,
    oldText: "",
    kind: "unchanged",
  }));
}

function computeAfterLineEdits(beforeLines, afterLines) {
  const edits = createLineEditState(afterLines);
  if (afterLines.length === 0) {
    return [];
  }
  if (beforeLines.length === 0 || (beforeLines.length === 1 && beforeLines[0] === "")) {
    return edits.map(() => ({ changed: true, oldText: "", kind: "added" }));
  }
  if (beforeLines.length * afterLines.length > GIT_DIFF_MAX_LCS_CELLS) {
    return edits.map((edit, index) =>
      beforeLines[index] === afterLines[index]
        ? edit
        : { changed: true, oldText: beforeLines[index] || "", kind: beforeLines[index] ? "modified" : "added" }
    );
  }

  const rows = beforeLines.length + 1;
  const cols = afterLines.length + 1;
  const table = Array.from({ length: rows }, () => new Uint16Array(cols));
  for (let i = beforeLines.length - 1; i >= 0; i -= 1) {
    for (let j = afterLines.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        beforeLines[i] === afterLines[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const deleted = [];
  const inserted = [];
  const flushChanges = () => {
    const pairCount = Math.min(deleted.length, inserted.length);
    for (const [insertIndex, insertion] of inserted.entries()) {
      const pairedDeletion = insertIndex < pairCount ? deleted[insertIndex] : "";
      edits[insertion.index] = {
        changed: true,
        oldText: pairedDeletion,
        kind: pairedDeletion ? "modified" : "added",
      };
    }
    deleted.length = 0;
    inserted.length = 0;
  };
  let beforeIndex = 0;
  let afterIndex = 0;
  while (beforeIndex < beforeLines.length && afterIndex < afterLines.length) {
    if (beforeLines[beforeIndex] === afterLines[afterIndex]) {
      flushChanges();
      beforeIndex += 1;
      afterIndex += 1;
    } else if (table[beforeIndex + 1][afterIndex] >= table[beforeIndex][afterIndex + 1]) {
      deleted.push(beforeLines[beforeIndex]);
      beforeIndex += 1;
    } else {
      inserted.push({ index: afterIndex, text: afterLines[afterIndex] });
      afterIndex += 1;
    }
  }
  while (beforeIndex < beforeLines.length) {
    deleted.push(beforeLines[beforeIndex]);
    beforeIndex += 1;
  }
  while (afterIndex < afterLines.length) {
    inserted.push({ index: afterIndex, text: afterLines[afterIndex] });
    afterIndex += 1;
  }
  flushChanges();

  if (!edits.some((edit) => edit.changed) && beforeLines.join("\n") !== afterLines.join("\n")) {
    return edits.map((edit, index) =>
      beforeLines[index] === afterLines[index]
        ? edit
        : { changed: true, oldText: beforeLines[index] || "", kind: beforeLines[index] ? "modified" : "added" }
    );
  }
  return edits;
}

function getGitTypingCharacterCount(data) {
  const model = getGitEditorModel(data);
  if (model.changedLineIndexes.length === 0) {
    return 0;
  }
  return model.changedLineIndexes.reduce((sum, lineIndex) => sum + (model.afterLines[lineIndex]?.length || 0) + 1, 0);
}

function gitTypingDataHasChanges(data) {
  return getGitEditorModel(data).changedLineIndexes.length > 0;
}

function getChatTypingData(slide) {
  return {
    ...createDefaultChatTypingData(),
    ...(slide?.chatTyping || {}),
    typingSpeed: sanitizeTypingSpeed(slide?.chatTyping?.typingSpeed, DEFAULT_CHAT_TYPING_SPEED),
    textScale: sanitizeChatTextScale(slide?.chatTyping?.textScale),
  };
}

function getDynamicSlideDuration(slide) {
  const kind = sanitizeSlideKind(slide?.kind);
  if (kind === "gitTyping") {
    const data = getGitTypingData(slide);
    return clamp(getGitTypingCharacterCount(data) / data.typingSpeed + 1.2, 4, DYNAMIC_MAX_DURATION);
  }
  if (kind === "chatTyping") {
    const data = getChatTypingData(slide);
    return clamp(
      CHAT_ANSWER_DELAY_SECONDS + (data.answer || "").length / data.typingSpeed + 1.1,
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

function getGitEditorFrame(data, timeSeconds) {
  const model = getGitEditorModel(data);
  const changedSet = new Set(model.changedLineIndexes);
  let remainingCharacters = Math.floor(timeSeconds * data.typingSpeed);
  let activeLineIndex = model.changedLineIndexes[model.changedLineIndexes.length - 1] || 0;
  let cursorColumn = 0;
  let hasActiveLine = false;
  const lines = model.afterLines.map((line, index) => {
    if (!changedSet.has(index)) {
      return { text: line, changed: false, kind: "unchanged", pendingOld: false, cursor: false };
    }

    const edit = model.lineEdits[index] || { oldText: "", kind: "modified" };
    const revealCost = line.length + 1;
    if (remainingCharacters <= 0) {
      const oldLine = edit.oldText || "";
      const isActive = !hasActiveLine;
      if (isActive) {
        activeLineIndex = index;
        cursorColumn = 0;
        hasActiveLine = true;
      }
      return {
        text: oldLine,
        changed: true,
        kind: edit.kind,
        pendingOld: Boolean(oldLine && oldLine !== line),
        cursor: isActive,
      };
    }
    if (remainingCharacters < revealCost) {
      const visibleText = line.slice(0, remainingCharacters);
      activeLineIndex = index;
      cursorColumn = visibleText.length;
      hasActiveLine = true;
      remainingCharacters = 0;
      return { text: visibleText, changed: true, kind: edit.kind, pendingOld: false, cursor: true };
    }

    remainingCharacters -= revealCost;
    return { text: line, changed: true, kind: edit.kind, pendingOld: false, cursor: false };
  });

  if (model.changedLineIndexes.length > 0 && remainingCharacters > 0) {
    activeLineIndex = model.changedLineIndexes[model.changedLineIndexes.length - 1];
    cursorColumn = lines[activeLineIndex]?.text.length || 0;
  }

  return {
    ...model,
    lines,
    activeLineIndex,
    cursorColumn,
  };
}

function getSyntaxTokens(line) {
  const text = String(line || "");
  if (!text) {
    return [];
  }
  const commentIndex = (() => {
    const candidates = ["//", "#"].map((marker) => text.indexOf(marker)).filter((index) => index >= 0);
    return candidates.length ? Math.min(...candidates) : -1;
  })();
  const codePart = commentIndex >= 0 ? text.slice(0, commentIndex) : text;
  const commentPart = commentIndex >= 0 ? text.slice(commentIndex) : "";
  const tokenPattern =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|return|if|else|for|while|class|extends|import|from|export|async|await|try|catch|throw|new|this|true|false|null|undefined|type|interface|struct|enum|fn|impl|pub|use|match|Some|None|Ok|Err|def|self|in|and|or|not)\b|\b\d+(?:\.\d+)?\b)/g;
  const tokens = [];
  let cursor = 0;
  for (const match of codePart.matchAll(tokenPattern)) {
    if (match.index > cursor) {
      tokens.push({ text: codePart.slice(cursor, match.index), color: "#d4d4d4" });
    }
    const token = match[0];
    const color =
      token.startsWith("\"") || token.startsWith("'") || token.startsWith("`")
        ? "#ce9178"
        : /^\d/.test(token)
          ? "#b5cea8"
          : "#569cd6";
    tokens.push({ text: token, color });
    cursor = match.index + token.length;
  }
  if (cursor < codePart.length) {
    tokens.push({ text: codePart.slice(cursor), color: "#d4d4d4" });
  }
  if (commentPart) {
    tokens.push({ text: commentPart, color: "#6a9955" });
  }
  return tokens;
}

function drawCodeLine(context, line, x, y, colorOverride = "") {
  if (colorOverride) {
    context.fillStyle = colorOverride;
    context.fillText(line, x, y);
    return;
  }

  let drawX = x;
  for (const token of getSyntaxTokens(line)) {
    context.fillStyle = token.color;
    context.fillText(token.text, drawX, y);
    drawX += context.measureText(token.text).width;
  }
}

function drawChatTypingSlide(context, slide, width, height, timeSeconds, options = {}) {
  const data = getChatTypingData(slide);
  const speed = data.typingSpeed;
  const textScale = sanitizeChatTextScale(data.textScale);
  const questionSource = data.question || "";
  const answerSource = data.answer || "";
  const answerStart = CHAT_ANSWER_DELAY_SECONDS;
  const visibleAnswerCount = clamp(Math.floor((timeSeconds - answerStart) * speed), 0, answerSource.length);
  const questionText = questionSource;
  const answerText = timeSeconds >= answerStart ? answerSource.slice(0, visibleAnswerCount) : "";
  const marginX = Math.round(width * 0.036);
  const topMargin = Math.round(height * 0.022);
  const bottomMargin = Math.round(height * 0.045);
  const shouldReserveSubtitle = Boolean(options.subtitles || options.reserveSubtitles);
  const subtitleReserve = shouldReserveSubtitle
    ? getSubtitleReservedHeight(context, getSubtitleTextForRender(slide, options), width, height, options)
    : 0;
  const questionSize = clamp(Math.round(width * 0.0175 * textScale), 16, 40);
  const answerSize = clamp(Math.round(width * 0.017 * textScale), 15, 38);
  const questionLineHeight = Math.round(questionSize * 1.36);
  const answerLineHeight = Math.round(answerSize * 1.52);
  const questionMaxWidth = Math.round(width * 0.68);
  const answerMaxWidth = Math.min(width - marginX * 2, Math.round(width * 0.74));
  const viewportY = topMargin;
  const viewportHeight = height - topMargin - bottomMargin;
  const messageGap = Math.round(height * 0.075);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.textBaseline = "top";

  context.font = `600 ${questionSize}px "Pretendard"`;
  const questionLines = questionText ? wrapTextLines(context, questionText, questionMaxWidth + TEXT_PADDING_X * 2) : [];
  const questionPaddingX = Math.round(questionSize * 1.08);
  const questionPaddingY = Math.round(questionSize * 0.62);
  const questionHeight = questionLines.length ? questionLines.length * questionLineHeight + questionPaddingY * 2 : 0;
  const questionBlockHeight = questionHeight;

  context.font = `600 ${answerSize}px "Pretendard"`;
  const answerLines = answerText ? wrapTextLines(context, answerText, answerMaxWidth + TEXT_PADDING_X * 2) : [];
  const answerHeight = answerLines.length * answerLineHeight;
  const totalContentHeight =
    questionBlockHeight + (questionLines.length && answerLines.length ? messageGap : 0) + answerHeight;
  const safeViewportHeight = Math.max(answerLineHeight * 2, viewportHeight - subtitleReserve);
  const scrollOffset = Math.max(0, totalContentHeight - safeViewportHeight);
  let contentY = viewportY - scrollOffset;

  context.save();
  context.beginPath();
  context.rect(0, viewportY, width, safeViewportHeight);
  context.clip();

  if (questionLines.length) {
    context.font = `600 ${questionSize}px "Pretendard"`;
    const questionTextWidth = Math.min(questionMaxWidth, getMeasuredTextWidth(context, questionLines, questionSize * 4));
    const questionWidth = Math.min(width - marginX * 2, Math.ceil(questionTextWidth + questionPaddingX * 2));
    const questionX = width - marginX - questionWidth;
    const questionRadius = questionLines.length > 1 ? Math.round(questionSize * 0.92) : Math.round(questionHeight / 2);
    context.fillStyle = "#050505";
    fillRoundedRect(context, questionX, contentY, questionWidth, questionHeight, questionRadius);
    context.fillStyle = "#ffffff";
    context.textAlign = "left";
    for (const [index, line] of questionLines.entries()) {
      context.fillText(line, questionX + questionPaddingX, contentY + questionPaddingY + index * questionLineHeight);
    }
    contentY += questionBlockHeight + (answerLines.length ? messageGap : 0);
  }

  if (answerLines.length) {
    context.font = `600 ${answerSize}px "Pretendard"`;
    context.fillStyle = "#111111";
    context.textAlign = "left";
    for (const [index, line] of answerLines.entries()) {
      const lineY = contentY + index * answerLineHeight;
      if (lineY + answerLineHeight < viewportY || lineY > viewportY + safeViewportHeight) {
        continue;
      }
      context.fillText(line, marginX, lineY);
    }
  }

  context.restore();
}

function drawDynamicSlide(context, slide, width, height, timeSeconds, options = {}) {
  if (sanitizeSlideKind(slide?.kind) === "gitTyping") {
    drawGitTypingSlide(context, slide, width, height, timeSeconds);
  } else {
    drawChatTypingSlide(context, slide, width, height, timeSeconds, options);
  }
  if (options.subtitles) {
    drawSubtitleBox(context, getSubtitleTextForRender(slide, options), width, height, options);
  }
}

function isAnimatedGifObject(object) {
  return object?.type === "image" && isAnimatedGifSource(object.src);
}

function getAnimatedGifOverlays(slide) {
  return (slide?.objects || [])
    .filter(isAnimatedGifObject)
    .map((object) => ({
      src: object.src,
      x: numberOr(object.x, 0),
      y: numberOr(object.y, 0),
      width: Math.max(1, numberOr(object.width, 1)),
      height: Math.max(1, numberOr(object.height, 1)),
      rotation: numberOr(object.rotation, 0),
      flipX: normalizeFlipFlag(object.flipX),
      flipY: normalizeFlipFlag(object.flipY),
    }));
}

async function drawSlideObjectsForExport(context, objects = [], options = {}) {
  const imageCache = options instanceof Map ? options : options.imageCache || new Map();
  const excludeAnimatedGifs = !(options instanceof Map) && Boolean(options.excludeAnimatedGifs);
  const timeSeconds = !(options instanceof Map) ? numberOr(options.timeSeconds, 0) : 0;
  const durationSeconds = !(options instanceof Map)
    ? numberOr(options.durationSeconds, VIDEO_EXPORT_FALLBACK_DURATION)
    : VIDEO_EXPORT_FALLBACK_DURATION;
  for (const object of objects) {
    if (excludeAnimatedGifs && isAnimatedGifObject(object)) {
      continue;
    }
    const renderState = getObjectAnimationState(object, timeSeconds, durationSeconds);
    const center = {
      x: renderState.x + renderState.width / 2,
      y: renderState.y + renderState.height / 2,
    };
    context.save();
    try {
      context.translate(center.x, center.y);
      context.rotate((renderState.rotation * Math.PI) / 180);
      context.scale(renderState.scale, renderState.scale);
      context.translate(-renderState.width / 2, -renderState.height / 2);

      if (object.type === "image") {
        context.globalAlpha = clamp(context.globalAlpha * renderState.opacity, 0, 1);
        let imagePromise = imageCache.get(object.src);
        if (!imagePromise) {
          imagePromise = loadImageForRender(object.src);
          imageCache.set(object.src, imagePromise);
        }
        let image;
        try {
          image = await imagePromise;
        } catch (error) {
          if (isAnimatedGifObject(object)) {
            continue;
          }
          throw error;
        }
        drawFlippedFittedImage(context, image, renderState.width, renderState.height, object);
      } else if (object.type === "text") {
        context.__textColor = object.textColor || DEFAULT_TEXT_COLOR;
        drawTextLines(
          context,
          object.text || "",
          renderState.width,
          renderState.height,
          false,
          object.textSize || "h3",
          object.textAlign || "left",
          {
            ...object,
            renderOpacity: renderState.opacity,
          }
        );
        delete context.__textColor;
      } else if (object.type === "shape") {
        context.globalAlpha = clamp(context.globalAlpha * renderState.opacity, 0, 1);
        drawShapeData(context, object, renderState.width, renderState.height);
      }
    } finally {
      delete context.__textColor;
      context.restore();
    }
  }
}

async function renderDynamicSlideToDataUrl(slide, timeSeconds, options = {}) {
  await ensureSlideFontsReady(slide, options);
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = Math.max(1, roundedCanvasSize(slide.width));
  exportCanvas.height = Math.max(1, roundedCanvasSize(slide.height));
  const context = exportCanvas.getContext("2d");
  drawDynamicSlide(context, slide, exportCanvas.width, exportCanvas.height, timeSeconds, {
    ...options,
    subtitles: false,
    reserveSubtitles: options.subtitles || options.reserveSubtitles,
  });
  const defaultObjectTimelineDuration = Math.max(getDynamicSlideDuration(slide), getSlideObjectAnimationDuration(slide));
  await drawSlideObjectsForExport(context, slide.objects || [], {
    ...options,
    timeSeconds,
    durationSeconds: Math.max(
      defaultObjectTimelineDuration,
      numberOr(options.durationSeconds, defaultObjectTimelineDuration)
    ),
  });
  if (options.subtitles) {
    drawSubtitleBox(context, getSubtitleTextForRender(slide, options), exportCanvas.width, exportCanvas.height, options);
  }
  return exportCanvas.toDataURL("image/png");
}

async function renderDynamicSlideFrames(slide, options = {}) {
  const defaultDuration = Math.max(getDynamicSlideDuration(slide), getSlideObjectAnimationDuration(slide));
  const duration = Math.max(0.5, numberOr(options.durationSeconds, defaultDuration));
  const frameRate = DYNAMIC_FRAME_RATE;
  const frameCount = Math.max(2, Math.ceil(duration * frameRate));
  const frames = [];
  const imageCache = new Map();
  for (let index = 0; index < frameCount; index += 1) {
    throwIfExportCancelled();
    if (index % frameRate === 0) {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    }
    const timeSeconds = Math.min(duration, index / frameRate);
    frames.push(
      await renderDynamicSlideToDataUrl(slide, timeSeconds, {
        ...options,
        imageCache,
        durationSeconds: duration,
      })
    );
  }
  frames.push(
    await renderDynamicSlideToDataUrl(slide, duration, {
      ...options,
      imageCache,
      durationSeconds: duration,
    })
  );
  return {
    frames,
    frameRate,
    duration,
    framePng: frames[frames.length - 1],
  };
}

function slideHasObjectAnimations(slide) {
  return (slide?.objects || []).some((object) => canAnimateObjectData(object) && hasObjectAnimation(object));
}

async function renderCanvasSlideAnimationFrames(slide, options = {}) {
  const duration = Math.max(0.5, numberOr(options.durationSeconds, VIDEO_EXPORT_FALLBACK_DURATION));
  const frameRate = VIDEO_EXPORT_FPS;
  const frameCount = Math.max(2, Math.ceil(duration * frameRate));
  const frames = [];
  const imageCache = new Map();
  for (let index = 0; index < frameCount; index += 1) {
    throwIfExportCancelled();
    if (index % frameRate === 0) {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    }
    const timeSeconds = Math.min(duration, index / frameRate);
    frames.push(
      await renderSlideToDataUrl(slide, {
        ...options,
        imageCache,
        timeSeconds,
        durationSeconds: duration,
      })
    );
  }
  if (!options.loopFrames) {
    frames.push(
      await renderSlideToDataUrl(slide, {
        ...options,
        imageCache,
        timeSeconds: duration,
        durationSeconds: duration,
      })
    );
  }
  return {
    frames,
    frameRate,
    duration,
    framePng: frames[frames.length - 1],
  };
}

async function refreshGitTypingSlideForExport(slide) {
  if (sanitizeSlideKind(slide?.kind) !== "gitTyping") {
    return slide;
  }
  const data = getGitTypingData(slide);
  if (gitTypingDataHasChanges(data) || !data.repoPath || !data.commitHash || !data.filePath) {
    return slide;
  }

  try {
    const result = await nativeApi.readGitCommitFileChange(data.repoPath, data.commitHash, data.filePath);
    return {
      ...slide,
      gitTyping: {
        ...data,
        repoPath: result.repoPath || data.repoPath,
        commitHash: result.commitHash || data.commitHash,
        commitLabel: data.commitLabel || result.commitHash || data.commitHash,
        filePath: result.filePath || data.filePath,
        title: result.title || data.title,
        content: result.afterContent || result.beforeContent || result.content || data.content,
        beforeContent: result.beforeContent || "",
        afterContent: result.afterContent || result.content || "",
        beforePath: result.beforePath || data.beforePath || "",
      },
    };
  } catch {
    return slide;
  }
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
  const arrowGeometry = shapeKind === "arrow" ? getArrowGeometry(start, end, lineWidth) : null;
  const lineEnd = arrowGeometry?.shaftEnd || end;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(lineEnd.x, lineEnd.y);
  context.stroke();

  if (arrowGeometry) {
    context.beginPath();
    context.moveTo(arrowGeometry.headPoints[0].x, arrowGeometry.headPoints[0].y);
    context.lineTo(arrowGeometry.headPoints[1].x, arrowGeometry.headPoints[1].y);
    context.lineTo(arrowGeometry.headPoints[2].x, arrowGeometry.headPoints[2].y);
    context.closePath();
    context.fill();
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
    image.onerror = () => reject(new Error("Failed to render image."));
    getRenderAssetUrl(src)
      .then((url) => {
        image.src = url;
      })
      .catch(reject);
  });
}

function createDefaultSlide() {
  return {
    id: `slide-${++slideSeed}`,
    kind: "canvas",
    width: projectSettingsState.canvasWidth,
    height: projectSettingsState.canvasHeight,
    color: projectSettingsState.canvasColor,
    notes: "",
    noteSegments: [],
    video: null,
    startSound: null,
    continueAfterTts: false,
    objects: [],
  };
}

function createDefaultGitTypingData() {
  return {
    title: "Git Diff",
    repoPath: "",
    commitHash: "",
    commitLabel: "",
    filePath: "",
    commits: [],
    files: [],
    content: "",
    beforeContent: "",
    afterContent: "",
    beforePath: "",
    typingSpeed: DEFAULT_GIT_TYPING_SPEED,
  };
}

function stripGitSlideHelperText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return GIT_SLIDE_HELPER_TEXTS.has(value.trim()) ? "" : value;
}

function createDefaultChatTypingData() {
  return {
    title: "GPT Conversation",
    question: "Ask a question here.",
    answer: "Add a response here. In the exported video, it will appear as a live typing animation.",
    typingSpeed: DEFAULT_CHAT_TYPING_SPEED,
    textScale: DEFAULT_CHAT_TEXT_SCALE,
  };
}

function createDynamicSlide(kind) {
  const slide = createDefaultSlide();
  slide.kind = kind;
  slide.continueAfterTts = false;
  slide.color = kind === "gitTyping" ? "#0b1020" : "#f4f7fb";
  slide.notes =
    kind === "gitTyping"
      ? "Shows Git changes as if they were being edited in a code editor."
      : "Plays out a GPT question and answer as a live conversation.";
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
    fit: sanitizeVideoFit(value.fit),
    frameRatio: sanitizeVideoFrameRatio(value.frameRatio),
  };
}

function normalizeAudioAsset(value) {
  if (!value || typeof value.path !== "string" || !value.path.trim()) {
    return null;
  }
  return {
    path: value.path,
    name: typeof value.name === "string" && value.name.trim() ? value.name : getFileNameFromPath(value.path),
  };
}

function normalizeSlideStartSound(value) {
  return normalizeAudioAsset(value);
}

function normalizeProjectBackgroundMusic(value) {
  return normalizeAudioAsset(value);
}

function getActiveSlideVideo() {
  const slide = slides[activeSlideIndex];
  if (isDynamicSlide(slide)) {
    return null;
  }
  return normalizeSlideVideo(slide?.video);
}

function getActiveSlideStartSound() {
  return normalizeSlideStartSound(slides[activeSlideIndex]?.startSound);
}

function applySlideVideoFrame(frameRatio = DEFAULT_VIDEO_FRAME_RATIO) {
  if (!slideVideo) {
    return;
  }
  const canvasWidth = roundedCanvasSize(canvas.style.width || canvas.clientWidth);
  const canvasHeight = roundedCanvasSize(canvas.style.height || canvas.clientHeight);
  const frame = getVideoFrameRect(canvasWidth, canvasHeight, frameRatio);
  slideVideo.style.left = `${frame.x}px`;
  slideVideo.style.top = `${frame.y}px`;
  slideVideo.style.width = `${frame.width}px`;
  slideVideo.style.height = `${frame.height}px`;
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
    delete slideVideo.dataset.fit;
    delete slideVideo.dataset.frameRatio;
    slideVideo.load();
    slideVideo.hidden = true;
    applySlideVideoFrame();
    slideVideoInfo.textContent = "No video selected";
    slideVideoInfo.title = "";
    clearSlideVideo.disabled = true;
    syncVideoFitButtons(null);
    syncVideoFrameRatioButtons(null);
    return;
  }

  const assetUrl = nativeApi.toAssetUrl(video.path);
  if (slideVideo.dataset.path !== video.path) {
    slideVideo.src = assetUrl;
    slideVideo.dataset.path = video.path;
    slideVideo.load();
  }
  slideVideo.hidden = false;
  slideVideo.dataset.fit = video.fit;
  slideVideo.dataset.frameRatio = video.frameRatio;
  slideVideo.style.objectFit = VIDEO_FIT_MODES[video.fit]?.objectFit || VIDEO_FIT_MODES[DEFAULT_VIDEO_FIT].objectFit;
  applySlideVideoFrame(video.frameRatio);
  slideVideo.muted = true;
  slideVideo.loop = true;
  slideVideo.play().catch(() => {});
  slideVideoInfo.textContent = video.name;
  slideVideoInfo.title = video.name;
  clearSlideVideo.disabled = false;
  syncVideoFitButtons(video.fit);
  syncVideoFrameRatioButtons(video.frameRatio);
}

function syncVideoFitButtons(value) {
  const fit = value ? sanitizeVideoFit(value) : DEFAULT_VIDEO_FIT;
  for (const button of videoFitButtons) {
    button.classList.toggle("is-active", sanitizeVideoFit(button.dataset.videoFit) === fit);
    button.disabled = !value;
  }
}

function syncVideoFrameRatioButtons(value) {
  const frameRatio = value ? sanitizeVideoFrameRatio(value) : DEFAULT_VIDEO_FRAME_RATIO;
  for (const button of videoFrameRatioButtons) {
    button.classList.toggle("is-active", sanitizeVideoFrameRatio(button.dataset.videoFrameRatio) === frameRatio);
    button.disabled = !value;
  }
}

function updateSlideSoundView() {
  const sound = getActiveSlideStartSound();
  if (!slideSoundInfo || !clearSlideSound) {
    return;
  }

  if (!sound) {
    slideSoundInfo.textContent = "No sound selected";
    clearSlideSound.disabled = true;
    return;
  }

  slideSoundInfo.textContent = sound.name;
  clearSlideSound.disabled = false;
}

function updateBackgroundMusicView() {
  const music = normalizeProjectBackgroundMusic(projectSettingsState.backgroundMusic);
  if (!backgroundMusicInfo || !clearBackgroundMusic) {
    return;
  }

  if (!music) {
    backgroundMusicInfo.textContent = "No BGM";
    backgroundMusicInfo.title = "";
    clearBackgroundMusic.disabled = true;
    return;
  }

  backgroundMusicInfo.textContent = music.name;
  backgroundMusicInfo.title = music.name;
  clearBackgroundMusic.disabled = false;
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
    data.repoPath ? "Select commit..." : "Choose repository...",
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
    const codeWindow = createPreviewElement("div", "dynamic-preview-code-window");
    const titleBar = createPreviewElement("div", "dynamic-preview-code-titlebar");
    const lights = createPreviewElement("div", "dynamic-preview-code-lights");
    lights.append(
      createPreviewElement("span", "dynamic-preview-code-light red"),
      createPreviewElement("span", "dynamic-preview-code-light yellow"),
      createPreviewElement("span", "dynamic-preview-code-light green")
    );
    const title = createPreviewElement("div", "dynamic-preview-code-filename", getFileNameFromPath(data.filePath || data.title));
    const code = createPreviewElement(
      "pre",
      "dynamic-preview-code",
      truncateText(typeof data.afterContent === "string" ? data.afterContent : data.content, 2400)
    );
    titleBar.append(lights, title);
    codeWindow.append(titleBar, code);
    surface.append(codeWindow);
    dynamicSlidePreview.append(surface);
    return;
  }
  if (kind === "chatTyping") {
    const data = getChatTypingData(slide);
    const surface = createPreviewElement("div", "dynamic-preview-surface chat");
    const chat = createPreviewElement("div", "dynamic-preview-chat");
    const questionBlock = createPreviewElement("div", "dynamic-preview-question-block");
    const question = createPreviewElement("div", "dynamic-preview-bubble question", data.question);
    const answer = createPreviewElement("div", "dynamic-preview-answer", data.answer);
    if (data.question.length < 42 && !data.question.includes("\n")) {
      question.classList.add("is-compact");
    }
    questionBlock.append(question);
    chat.append(questionBlock, answer);
    surface.append(chat);
    dynamicSlidePreview.append(surface);
    window.requestAnimationFrame(() => {
      chat.scrollTop = chat.scrollHeight;
    });
  }
}

function syncSlideOptionPanels(kind) {
  const isCanvasSlide = kind === "canvas";
  drawPanel.hidden = false;
  slideVideoPanel.hidden = !isCanvasSlide;
  slideSoundPanel.hidden = false;
  dynamicSlidePanel.hidden = isCanvasSlide;
}

function syncDynamicSlidePanel() {
  const slide = slides[activeSlideIndex];
  const kind = sanitizeSlideKind(slide?.kind);
  syncSlideOptionPanels(kind);
  gitTypingControls.hidden = kind !== "gitTyping";
  chatTypingControls.hidden = kind !== "chatTyping";
  canvasSlideHint.hidden = true;
  if (dynamicContinueAfterTts) {
    dynamicContinueAfterTts.checked = isDynamicSlide(slide) && normalizeContinueAfterTts(slide.continueAfterTts);
  }

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
    syncChatTextScaleButtons(data.textScale);
    chatQuestion.value = data.question;
    chatAnswer.value = data.answer;
  }

  renderDynamicSlidePreview(slide);
  syncSlideTranslationControls();
}

function applyCanvasFrame(width, height, color) {
  const safeWidth = roundedCanvasSize(width || DEFAULT_CANVAS_WIDTH);
  const safeHeight = roundedCanvasSize(height || DEFAULT_CANVAS_HEIGHT);
  const safeColor = sanitizeColor(color, DEFAULT_CANVAS_COLOR);
  canvas.style.width = `${safeWidth}px`;
  canvas.style.height = `${safeHeight}px`;
  canvas.style.backgroundColor = safeColor;
  canvas.dataset.canvasColor = safeColor;
  updateSafeAreaOverlay();
}

function getCanvasState() {
  return {
    width: roundedCanvasSize(canvas.style.width || canvas.offsetWidth),
    height: roundedCanvasSize(canvas.style.height || canvas.offsetHeight),
    color: canvas.dataset.canvasColor || DEFAULT_CANVAS_COLOR,
  };
}

function clearCanvasObjects() {
  stopObjectAnimationPreview();
  selectObject(null);
  for (const object of canvas.querySelectorAll(".object")) {
    object.remove();
  }
}

function addImageObjectFromData(data) {
  const element = imageTemplate.content.firstElementChild.cloneNode(true);
  const image = element.querySelector("img");
  element.dataset.id = `object-${++objectSeed}`;
  setAnimationDatasetFromData(element, data);
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
  element.dataset.fontFamily = sanitizeTextFontFamily(data.fontFamily);
  element.dataset.fontWeight = String(sanitizeTextFontWeight(data.fontWeight));
  element.dataset.textEffect = sanitizeTextEffect(data.textEffect);
  setAnimationDatasetFromData(element, data);
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
  applyCanvasFrame(slide.width, slide.height, slide.color);
  slideNotes.value = typeof slide.notes === "string" ? slide.notes : "";
  renderNoteSegmentsFromSlide(slide);
  slides[activeSlideIndex].video = normalizeSlideVideo(slide.video);
  slides[activeSlideIndex].startSound = normalizeSlideStartSound(slide.startSound);
  updateSlideVideoView();
  updateSlideSoundView();
  syncDynamicSlidePanel();
  defaultTextColor = getDefaultTextColorForCanvas(slide.color);

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
  syncObjectAnimationPreview();
}

function getSlidePreviewMetrics(slide) {
  const slideWidth = Math.max(1, roundedCanvasSize(slide.width));
  const slideHeight = Math.max(1, roundedCanvasSize(slide.height));
  if (isDynamicSlide(slide)) {
    return {
      width: SLIDE_PREVIEW_WIDTH,
      height: SLIDE_PREVIEW_HEIGHT,
      offsetX: 0,
      offsetY: 0,
      scaleX: SLIDE_PREVIEW_WIDTH / slideWidth,
      scaleY: SLIDE_PREVIEW_HEIGHT / slideHeight,
    };
  }
  const scale = Math.min(SLIDE_PREVIEW_WIDTH / slideWidth, SLIDE_PREVIEW_HEIGHT / slideHeight);
  return {
    width: SLIDE_PREVIEW_WIDTH,
    height: SLIDE_PREVIEW_HEIGHT,
    offsetX: (SLIDE_PREVIEW_WIDTH - slideWidth * scale) / 2,
    offsetY: (SLIDE_PREVIEW_HEIGHT - slideHeight * scale) / 2,
    scaleX: scale,
    scaleY: scale,
  };
}

function renderSlidePreview(slide, previewCanvas, options = {}) {
  const metrics = getSlidePreviewMetrics(slide);
  const { width, height } = metrics;
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

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#eef0f4";
  context.fillRect(0, 0, width, height);
  context.save();
  context.translate(metrics.offsetX, metrics.offsetY);
  context.scale(metrics.scaleX, metrics.scaleY);
  context.fillStyle = slide.color;
  context.fillRect(0, 0, slide.width, slide.height);
  const video = normalizeSlideVideo(slide.video);
  if (video) {
    const frame = getVideoFrameRect(slide.width, slide.height, video.frameRatio);
    context.fillStyle = "#000000";
    context.fillRect(frame.x, frame.y, frame.width, frame.height);
    context.fillStyle = "rgba(255, 255, 255, 0.82)";
    context.font = '700 42px "Pretendard"';
    const label = video.frameRatio === DEFAULT_VIDEO_FRAME_RATIO ? "VIDEO" : `VIDEO ${VIDEO_FRAME_RATIO_MODES[video.frameRatio].label}`;
    context.fillText(label, frame.x + 28, Math.min(slide.height - 72, frame.y + frame.height - 28));
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
      if (options.excludeAnimatedGifs && isAnimatedGifObject(object)) {
        context.restore();
        continue;
      }
      context.fillStyle = "#dbeafe";
      context.fillRect(0, 0, object.width, object.height);
      context.strokeStyle = "#93c5fd";
      context.strokeRect(0, 0, object.width, object.height);
    } else if (object.type === "text") {
      context.__textColor = object.textColor || DEFAULT_TEXT_COLOR;
      drawTextLines(context, object.text || "", object.width, object.height, false, object.textSize || "h3", object.textAlign || "left", object);
      delete context.__textColor;
    } else if (object.type === "shape") {
      drawShapeData(context, object, object.width, object.height);
    }

    context.restore();
  }

  context.restore();
}

function getSlidePreviewCacheKey(slide) {
  return JSON.stringify(compactHistoryValue(slide));
}

function rememberSlidePreview(key, dataUrl) {
  slidePreviewCache.set(key, dataUrl);
  if (slidePreviewCache.size <= SLIDE_PREVIEW_CACHE_LIMIT) {
    return;
  }
  const [oldestKey] = slidePreviewCache.keys();
  slidePreviewCache.delete(oldestKey);
}

function getSlidePreviewDataUrl(slide) {
  const key = getSlidePreviewCacheKey(slide);
  const cached = slidePreviewCache.get(key);
  if (cached) {
    slidePreviewCache.delete(key);
    slidePreviewCache.set(key, cached);
    return cached;
  }

  const preview = document.createElement("canvas");
  renderSlidePreview(slide, preview, {
    excludeAnimatedGifs: getAnimatedGifOverlays(slide).length > 0,
  });
  const dataUrl = preview.toDataURL("image/png");
  rememberSlidePreview(key, dataUrl);
  return dataUrl;
}

function createSlidePreviewGifOverlay(object, metrics) {
  const image = document.createElement("img");
  image.className = "slide-preview-gif";
  image.alt = "";
  image.decoding = "async";
  image.loading = "lazy";
  image.src = getDisplayAssetUrl(object.src);
  image.style.left = `${metrics.offsetX + object.x * metrics.scaleX}px`;
  image.style.top = `${metrics.offsetY + object.y * metrics.scaleY}px`;
  image.style.width = `${Math.max(1, object.width * metrics.scaleX)}px`;
  image.style.height = `${Math.max(1, object.height * metrics.scaleY)}px`;
  image.style.transform = `rotate(${numberOr(object.rotation, 0)}deg) scale(${normalizeFlipFlag(object.flipX) ? -1 : 1}, ${
    normalizeFlipFlag(object.flipY) ? -1 : 1
  })`;
  return image;
}

function createSlidePreviewFrame(slide) {
  const frame = document.createElement("span");
  frame.className = "slide-preview-frame";

  const preview = document.createElement("img");
  preview.className = "slide-preview";
  preview.alt = "";
  preview.decoding = "async";
  preview.src = getSlidePreviewDataUrl(slide);
  frame.append(preview);

  const gifOverlays = getAnimatedGifOverlays(slide);
  if (gifOverlays.length) {
    const metrics = getSlidePreviewMetrics(slide);
    frame.classList.add("has-gif-preview");
    for (const object of gifOverlays) {
      frame.append(createSlidePreviewGifOverlay(object, metrics));
    }
  }

  return frame;
}

function clearSlideDropTargets() {
  slideList.classList.remove("is-reordering");
  for (const card of slideList.querySelectorAll(".slide-card")) {
    card.classList.remove("is-dragging", "is-drop-target", "is-drop-before", "is-drop-after");
  }
}

function getSlideInsertionIndex(clientY) {
  const cards = [...slideList.querySelectorAll(".slide-card")];
  for (const card of cards) {
    const index = Number(card.dataset.slideIndex);
    const rect = card.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      return index;
    }
  }
  return slides.length;
}

function updateSlideDropTarget(insertionIndex) {
  for (const card of slideList.querySelectorAll(".slide-card")) {
    card.classList.remove("is-drop-target", "is-drop-before", "is-drop-after");
  }
  if (!slideDragState || insertionIndex === slideDragState.fromIndex || insertionIndex === slideDragState.fromIndex + 1) {
    return;
  }

  const targetIndex = insertionIndex >= slides.length ? slides.length - 1 : insertionIndex;
  const targetCard = slideList.querySelector(`[data-slide-index="${targetIndex}"]`);
  if (!targetCard) {
    return;
  }
  targetCard.classList.add("is-drop-target", insertionIndex >= slides.length ? "is-drop-after" : "is-drop-before");
}

function beginSlidePointerDrag(event, index, card) {
  if (event.button !== 0 || slides.length <= 1) {
    return;
  }
  slideDragState = {
    fromIndex: index,
    insertionIndex: index,
    startX: event.clientX,
    startY: event.clientY,
    card,
    didDrag: false,
  };
  try {
    card.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture can be unavailable in some WebView paths.
  }
}

function handleSlidePointerMove(event) {
  if (!slideDragState) {
    return;
  }
  const deltaX = event.clientX - slideDragState.startX;
  const deltaY = event.clientY - slideDragState.startY;
  if (!slideDragState.didDrag && Math.hypot(deltaX, deltaY) < SLIDE_DRAG_THRESHOLD) {
    return;
  }

  event.preventDefault();
  slideDragState.didDrag = true;
  slideList.classList.add("is-reordering");
  slideDragState.card.classList.add("is-dragging");
  slideDragState.insertionIndex = getSlideInsertionIndex(event.clientY);
  updateSlideDropTarget(slideDragState.insertionIndex);
}

function finishSlidePointerDrag(event) {
  if (!slideDragState) {
    return;
  }
  const state = slideDragState;
  slideDragState = null;
  try {
    state.card.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture can be unavailable in some WebView paths.
  }
  clearSlideDropTargets();
  if (!state.didDrag) {
    if (event.type === "pointerup") {
      loadSlide(state.fromIndex);
    }
    return;
  }

  event.preventDefault();
  slideClickSuppressUntil = performance.now() + 350;
  let toIndex = state.insertionIndex;
  if (state.fromIndex < toIndex) {
    toIndex -= 1;
  }
  toIndex = clamp(toIndex, 0, slides.length - 1);
  reorderSlide(state.fromIndex, toIndex);
}

function renderSlideList() {
  serializeCurrentSlide();
  slideList.replaceChildren();

  slides.forEach((slide, index) => {
    const card = document.createElement("div");
    card.className = `slide-card${index === activeSlideIndex ? " is-active" : ""}`;
    card.draggable = false;
    card.dataset.slideIndex = String(index);
    card.addEventListener("pointerdown", (event) => beginSlidePointerDrag(event, index, card));
    card.addEventListener("pointermove", handleSlidePointerMove);
    card.addEventListener("pointerup", finishSlidePointerDrag);
    card.addEventListener("pointercancel", finishSlidePointerDrag);

    const thumbButton = document.createElement("button");
    thumbButton.className = "slide-thumb-button";
    thumbButton.type = "button";
    thumbButton.addEventListener("click", (event) => {
      if (performance.now() < slideClickSuppressUntil) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      loadSlide(index);
    });

    const previewFrame = createSlidePreviewFrame(slide);

    const name = document.createElement("span");
    name.className = "slide-name";
    name.textContent = `Slide ${index + 1}`;

    const grip = document.createElement("span");
    grip.className = "slide-grip";
    grip.setAttribute("aria-hidden", "true");

    thumbButton.append(previewFrame, grip, name);
    card.append(thumbButton);
    slideList.append(card);
  });
  deleteSlide.disabled = slides.length <= 1;
  updateStatusBar();
  syncSlideTranslationControls();
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
  setStatus("Slide order changed.");
  recordHistory();
}

function addNewSlide() {
  serializeCurrentSlide();
  slides.push(createDefaultSlide());
  loadSlide(slides.length - 1, false);
  setStatus("Added a new slide.");
  recordHistory();
}

function addDynamicSlide(kind) {
  serializeCurrentSlide();
  slides.push(createDynamicSlide(kind));
  loadSlide(slides.length - 1, false);
  setStatus(kind === "gitTyping" ? "Added a Git typing slide." : "Added a GPT chat typing slide.");
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
  setStatus("Current slide duplicated.");
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
  syncObjectAnimationPreview();
  setStatus(`Duplicated ${copies.length} object${copies.length === 1 ? "" : "s"}.`);
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
  setStatus("Object order changed.");
  recordHistory();
}

function getObjectBounds(object) {
  const state = getState(object);
  return {
    left: state.x,
    top: state.y,
    right: state.x + state.width,
    bottom: state.y + state.height,
  };
}

function getSelectedBounds() {
  if (selectedObjects.length === 0) {
    return null;
  }
  return selectedObjects.map(getObjectBounds).reduce(
    (bounds, objectBounds) => ({
      left: Math.min(bounds.left, objectBounds.left),
      top: Math.min(bounds.top, objectBounds.top),
      right: Math.max(bounds.right, objectBounds.right),
      bottom: Math.max(bounds.bottom, objectBounds.bottom),
    }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
  );
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

function flipSelectedImages(axis) {
  if (axis !== "x" && axis !== "y") {
    return false;
  }
  const imageObjects = selectedObjects.filter((object) => object.dataset.type === "image");
  if (imageObjects.length === 0) {
    return false;
  }

  for (const object of imageObjects) {
    const state = getState(object);
    applyState(object, {
      ...state,
      flipX: axis === "x" ? !state.flipX : state.flipX,
      flipY: axis === "y" ? !state.flipY : state.flipY,
    });
  }

  syncSelectedInputs();
  renderSlideList();
  setStatus(`Flipped ${imageObjects.length} image${imageObjects.length === 1 ? "" : "s"} ${axis === "x" ? "horizontally" : "vertically"}.`);
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
  syncObjectAnimationPreview();
  setStatus("Selected objects deleted.");
  renderSlideList();
  recordHistory();
  return true;
}

function deleteCurrentSlide() {
  if (slides.length <= 1) {
    setStatus("Cannot delete the last slide.");
    return;
  }
  serializeCurrentSlide();
  slides.splice(activeSlideIndex, 1);
  activeSlideIndex = clamp(activeSlideIndex, 0, slides.length - 1);
  loadSlide(activeSlideIndex, false);
  setStatus("Current slide deleted.");
  recordHistory();
}

function createProjectData() {
  serializeCurrentSlide();
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    settings: cloneProjectValue(projectSettingsState),
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

  const savedBackgroundMusic = normalizeProjectBackgroundMusic(savedData.settings?.backgroundMusic);
  const currentBackgroundMusic = normalizeProjectBackgroundMusic(projectSettingsState.backgroundMusic);
  if ((savedBackgroundMusic?.path || "") !== (currentBackgroundMusic?.path || "")) {
    projectSettingsState = normalizeProjectSettings({
      ...projectSettingsState,
      backgroundMusic: savedBackgroundMusic,
    });
    updateBackgroundMusicView();
  }

  let shouldRefreshActiveVideo = false;
  let shouldRefreshActiveSound = false;
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

    const savedSound = normalizeSlideStartSound(savedSlide.startSound);
    const currentSound = normalizeSlideStartSound(slides[index].startSound);
    if ((savedSound?.path || "") !== (currentSound?.path || "")) {
      slides[index].startSound = savedSound;
      shouldRefreshSlides = true;
      if (index === activeSlideIndex) {
        shouldRefreshActiveSound = true;
      }
    }

    const savedNoteSegments = normalizeNoteSegments(savedSlide.noteSegments, savedSlide.notes);
    const currentNoteSegments = normalizeNoteSegments(slides[index].noteSegments, slides[index].notes);
    if (!noteSegmentsEqual(savedNoteSegments, currentNoteSegments)) {
      slides[index].noteSegments = savedNoteSegments;
      shouldRefreshSlides = true;
      if (index === activeSlideIndex) {
        renderNoteSegmentsFromSlide(slides[index]);
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
  if (shouldRefreshActiveSound) {
    updateSlideSoundView();
  }
  if (shouldRefreshSlides) {
    renderSlideList();
  }
}

function shouldPersistActiveNativeProject(options = {}) {
  return Boolean(activeProjectId || nativeDraftDirty || options.forceCreate);
}

async function saveActiveNativeProject(options = {}) {
  if (isLoadingNativeProject) {
    return null;
  }

  window.clearTimeout(nativeSaveTimer);
  if (nativeSavePromise) {
    nativeSaveQueued = true;
    return nativeSavePromise;
  }
  if (!shouldPersistActiveNativeProject(options)) {
    setSaveState("Ready");
    return null;
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
      nativeDraftDirty = false;
      applyMaterializedAssetPaths(record.data);
      await refreshNativeProjectList();
      setSaveState("Saved");
      if (options.showStatus) {
        setStatus("Project saved to app storage.");
      }
      return record;
    })
    .catch((error) => {
      setSaveState("Save failed");
      setStatus(error?.message || "Failed to save the project.");
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

function isInteractiveChangeInProgress() {
  return Boolean(activePointer || activeShapeDraft || slideDragState);
}

function scheduleNativeProjectSave() {
  if (isLoadingNativeProject) {
    return;
  }
  if (!activeProjectId) {
    nativeDraftDirty = true;
  }
  setSaveState("Saving...");
  window.clearTimeout(nativeSaveTimer);
  nativeSaveTimer = window.setTimeout(() => {
    if (isInteractiveChangeInProgress()) {
      scheduleNativeProjectSave();
      return;
    }
    if (nativeSavePromise) {
      nativeSaveQueued = true;
      return;
    }
    saveActiveNativeProject();
  }, NATIVE_SAVE_DEBOUNCE_MS);
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
    empty.textContent = "No saved projects.";
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
    openButton.dataset.icon = "folder-open";
    openButton.textContent = "Open";
    openButton.addEventListener("click", () => openNativeProject(project.id));

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.dataset.icon = "copy";
    copyButton.textContent = "Duplicate";
    copyButton.addEventListener("click", () => duplicateNativeProject(project.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger";
    deleteButton.dataset.icon = "trash-2";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteNativeProject(project.id));

    actions.append(openButton, copyButton, deleteButton);
    item.append(thumb, details, actions);
    projectLibraryList.append(item);
  }
  hydrateButtonIcons(projectLibraryList);
}

async function showProjectLibrary() {
  await refreshNativeProjectList();
  projectLibrary.hidden = false;
}

function hideProjectLibrary() {
  projectLibrary.hidden = true;
}

function resetToBlankProject() {
  projectSettingsState = normalizeProjectSettings();
  updateBackgroundMusicView();
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
  projectSettingsState = normalizeProjectSettings(project.settings);
  updateBackgroundMusicView();
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
  if (!options.skipCurrentSave && shouldPersistActiveNativeProject()) {
    await saveActiveNativeProject();
  }
  isLoadingNativeProject = true;
  activeProjectId = null;
  activeProjectName = "Untitled";
  projectNameInput.value = activeProjectName;
  resetToBlankProject();
  nativeDraftDirty = false;
  isLoadingNativeProject = false;
  if (options.deferSave) {
    setSaveState("Ready");
  } else {
    await saveActiveNativeProject({ showStatus: !options.silent, forceCreate: true });
  }
  if (!options.silent) {
    hideProjectLibrary();
  }
}

async function openNativeProject(projectId, options = {}) {
  if (!options.skipSave) {
    await saveActiveNativeProject();
  }
  isLoadingNativeProject = true;
  try {
    const record = await nativeApi.loadProject(projectId);
    const project = normalizeProjectData(record.data);
    setActiveProjectMeta(record.meta);
    applyProjectState(project);
    nativeDraftDirty = false;
    hideProjectLibrary();
    setStatus(`Opened project: ${activeProjectName}.`);
  } catch (error) {
    setStatus(error?.message || "Failed to open the project.");
  } finally {
    isLoadingNativeProject = false;
  }
}

async function renameNativeProject(projectId, name) {
  try {
    const meta = await nativeApi.renameProject({ id: projectId, name });
    if (projectId === activeProjectId) {
      setActiveProjectMeta(meta);
    }
    await refreshNativeProjectList();
    setStatus("Project renamed.");
  } catch (error) {
    setStatus(error?.message || "Failed to rename the project.");
  }
}

async function duplicateNativeProject(projectId) {
  try {
    await saveActiveNativeProject();
    await nativeApi.duplicateProject(projectId);
    await refreshNativeProjectList();
    setStatus("Project duplicated.");
  } catch (error) {
    setStatus(error?.message || "Failed to duplicate the project.");
  }
}

async function deleteNativeProject(projectId) {
  if (!window.confirm("Delete this project?")) {
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
        await createNewNativeProject({ silent: true, skipCurrentSave: true, deferSave: true });
      }
    }
    setStatus("Project deleted.");
  } catch (error) {
    setStatus(error?.message || "Failed to delete the project.");
  }
}

async function initializeNativeMode() {
  setButtonLabel(saveProject, "Export Project");
  setButtonLabel(openProject, "Import Project");
  await refreshNativeProjectList();
  if (nativeProjects.length === 0) {
    await createNewNativeProject({ silent: true, skipCurrentSave: true, deferSave: true });
    return;
  }
  projectLibrary.hidden = false;
}

function compactHistoryString(value) {
  if (!/^data:/i.test(value)) {
    return value;
  }
  return `${value.slice(0, 48)}:${value.length}:${value.slice(-24)}`;
}

function compactHistoryValue(value) {
  if (typeof value === "string") {
    return compactHistoryString(value);
  }
  if (Array.isArray(value)) {
    return value.map(compactHistoryValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, childValue]) => [key, compactHistoryValue(childValue)])
  );
}

function createHistorySnapshotKey(activeIndex, slideData) {
  return JSON.stringify({
    activeSlideIndex: activeIndex,
    slides: compactHistoryValue(slideData),
  });
}

function createHistorySnapshot() {
  serializeCurrentSlide();
  return {
    activeSlideIndex,
    slideSeed,
    slides: cloneProjectValue(slides),
    key: createHistorySnapshotKey(activeSlideIndex, slides),
  };
}

function getHistorySnapshotKey(snapshot) {
  return snapshot.key || createHistorySnapshotKey(snapshot.activeSlideIndex, snapshot.slides);
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
    setStatus("Nothing to undo.");
    return;
  }

  historyIndex -= 1;
  applyHistorySnapshot(historyStack[historyIndex]);
  setStatus("Reverted to the previous state.");
}

function redoChange() {
  if (historyIndex >= historyStack.length - 1) {
    setStatus("Nothing to redo.");
    return;
  }

  historyIndex += 1;
  applyHistorySnapshot(historyStack[historyIndex]);
  setStatus("Redo applied.");
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

async function saveProjectInternally() {
  await saveActiveNativeProject({ showStatus: true, forceCreate: true });
}

async function exportProjectFile() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const project = createProjectData();
  const baseName = getProjectName().replace(/[\\/:*?"<>|]/g, "-") || "slide-cut";
  const savedPath = await nativeApi.exportProjectFile(`${baseName}-${timestamp}.slidecut`, project);
  if (savedPath) {
    setSaveState("Exported");
    setStatus("Project package (with assets) saved to the selected path.");
  }
}

function sanitizeColor(value, fallback = "#ffffff") {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function sanitizeNumber(value, fallback, min = -4096, max = 4096) {
  return clamp(numberOr(value, fallback), min, max);
}

async function importNativeProjectFile() {
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
    await saveActiveNativeProject({ showStatus: true, forceCreate: true });
  } catch (error) {
    setStatus(error?.message || "Failed to import the project file.");
  }
}

async function chooseVideoForCurrentSlide() {
  if (isDynamicSlide(slides[activeSlideIndex])) {
    setStatus("Video source is only available on static slides.");
    return;
  }

  try {
    const path = await nativeApi.selectVideoFile();
    if (!path || !slides[activeSlideIndex]) {
      return;
    }
    if (!activeProjectId) {
      await saveActiveNativeProject({ forceCreate: true });
    }
    const importedAsset = activeProjectId
      ? await nativeApi.importProjectAsset(activeProjectId, path)
      : { path, name: getFileNameFromPath(path) };
    slides[activeSlideIndex].video = {
      path: importedAsset.path,
      name: importedAsset.name || getFileNameFromPath(path),
      fit: DEFAULT_VIDEO_FIT,
      frameRatio: DEFAULT_VIDEO_FRAME_RATIO,
    };
    updateSlideVideoView();
    renderSlideList();
    setStatus("Background video copied into the project and linked.");
    recordHistory();
  } catch (error) {
    setStatus(error?.message || "Failed to copy the video file into the project.");
  }
}

function clearVideoForCurrentSlide() {
  if (!slides[activeSlideIndex]) {
    return;
  }
  slides[activeSlideIndex].video = null;
  updateSlideVideoView();
  renderSlideList();
  setStatus("Background video removed.");
  recordHistory();
}

function setVideoFitForCurrentSlide(fit) {
  const slide = slides[activeSlideIndex];
  const video = normalizeSlideVideo(slide?.video);
  if (!slide || !video) {
    return;
  }
  slide.video = {
    ...video,
    fit: sanitizeVideoFit(fit),
  };
  updateSlideVideoView();
  renderSlideList();
  setStatus(`Background video fit changed to ${VIDEO_FIT_MODES[slide.video.fit].label}.`);
  recordHistory();
}

function setVideoFrameRatioForCurrentSlide(frameRatio) {
  const slide = slides[activeSlideIndex];
  const video = normalizeSlideVideo(slide?.video);
  if (!slide || !video) {
    return;
  }
  slide.video = {
    ...video,
    frameRatio: sanitizeVideoFrameRatio(frameRatio),
  };
  updateSlideVideoView();
  renderSlideList();
  setStatus(`Background video frame changed to ${VIDEO_FRAME_RATIO_MODES[slide.video.frameRatio].label}.`);
  recordHistory();
}

async function chooseSoundForCurrentSlide() {
  try {
    const path = await nativeApi.selectAudioFile();
    if (!path || !slides[activeSlideIndex]) {
      return;
    }
    if (!activeProjectId) {
      await saveActiveNativeProject({ forceCreate: true });
    }
    const importedAsset = activeProjectId
      ? await nativeApi.importProjectAsset(activeProjectId, path)
      : { path, name: getFileNameFromPath(path) };
    slides[activeSlideIndex].startSound = {
      path: importedAsset.path,
      name: importedAsset.name || getFileNameFromPath(path),
    };
    updateSlideSoundView();
    renderSlideList();
    setStatus("Slide start sound copied into the project and linked.");
    recordHistory();
  } catch (error) {
    setStatus(error?.message || "Failed to copy the sound file into the project.");
  }
}

function clearSoundForCurrentSlide() {
  if (!slides[activeSlideIndex]) {
    return;
  }
  slides[activeSlideIndex].startSound = null;
  updateSlideSoundView();
  renderSlideList();
  setStatus("Slide start sound removed.");
  recordHistory();
}

async function chooseBackgroundMusicForProject() {
  try {
    const path = await nativeApi.selectAudioFile();
    if (!path) {
      return;
    }
    if (!activeProjectId) {
      await saveActiveNativeProject({ forceCreate: true });
    }
    const importedAsset = activeProjectId
      ? await nativeApi.importProjectAsset(activeProjectId, path)
      : { path, name: getFileNameFromPath(path) };
    projectSettingsState = normalizeProjectSettings({
      ...projectSettingsState,
      backgroundMusic: {
        path: importedAsset.path,
        name: importedAsset.name || getFileNameFromPath(path),
      },
    });
    updateBackgroundMusicView();
    setStatus("Background music copied into the project and linked.");
    scheduleNativeProjectSave();
  } catch (error) {
    setStatus(error?.message || "Failed to copy the BGM file into the project.");
  }
}

function clearBackgroundMusicForProject() {
  projectSettingsState = normalizeProjectSettings({
    ...projectSettingsState,
    backgroundMusic: null,
  });
  updateBackgroundMusicView();
  setStatus("Background music removed.");
  scheduleNativeProjectSave();
}

async function saveCanvasAsPng() {
  for (const object of canvas.querySelectorAll(".text-object.is-editing")) {
    syncTextEditorValue(object);
  }
  const currentSlide = slides[activeSlideIndex];
  await ensureCanvasFontsReady({
    subtitles: projectSettingsState.subtitleEnabled,
    subtitleText: currentSlide?.notes,
    ...getProjectSubtitleRenderOptions(),
  });
  await Promise.all([...canvas.querySelectorAll("img")].map(waitForImageLoad));

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = roundedCanvasSize(canvas.style.width || canvas.clientWidth);
  exportCanvas.height = roundedCanvasSize(canvas.style.height || canvas.clientHeight);

  const context = exportCanvas.getContext("2d");
  context.fillStyle = getComputedStyle(canvas).backgroundColor || "#ffffff";
  context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  if (!slideVideo.hidden && slideVideo.readyState >= 2) {
    const video = getActiveSlideVideo();
    drawBackgroundMedia(context, slideVideo, exportCanvas.width, exportCanvas.height, video?.fit, video?.frameRatio);
  }

  const animationDuration = Math.max(VIDEO_EXPORT_FALLBACK_DURATION, getCanvasObjectAnimationDuration());
  const animationTime = animationDuration / 2;
  for (const object of canvas.querySelectorAll(".object")) {
    const baseState = getElementAnimationData(object);
    const state = getObjectAnimationState(baseState, animationTime, animationDuration);
    const center = getObjectCenter(state);

    context.save();
    context.globalAlpha *= state.opacity;
    context.translate(center.x, center.y);
    context.rotate((state.rotation * Math.PI) / 180);
    context.scale(state.scale, state.scale);
    context.translate(-state.width / 2, -state.height / 2);

    if (object.dataset.type === "image") {
      const imageElement = object.querySelector("img");
      const image = await loadImageForRender(imageElement?.dataset.src || imageElement?.src || "");
      drawFlippedFittedImage(context, image, state.width, state.height, state);
    } else if (object.dataset.type === "text") {
      drawTextObject(context, object, state.width, state.height);
    } else if (object.dataset.type === "shape") {
      drawShapeData(context, serializeObject(object), state.width, state.height);
    }

    context.restore();
  }

  if (projectSettingsState.subtitleEnabled && currentSlide) {
    drawSubtitleBox(context, getSubtitleTextForRender(currentSlide, {}), exportCanvas.width, exportCanvas.height, {
      ...getProjectSubtitleRenderOptions(),
    });
  }

  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  link.download = `slide-cut-${timestamp}.png`;
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
  setStatus("PNG exported.");
}

function syncSlideTranslationControls() {
  if (!slideTranslateSource || !slideTranslateTarget || !translateSlideButton) {
    return;
  }
  const slide = slides[activeSlideIndex];
  const isBlockedSlide = !slide || isDynamicSlide(slide);
  slideTranslateSource.disabled = isTranslatingSlide;
  slideTranslateTarget.disabled = isTranslatingSlide;
  translateSlideButton.disabled = isTranslatingSlide || isBlockedSlide;
  translateSlideButton.title = isBlockedSlide ? "Git / GPT slides cannot be translated." : "";
  setButtonLabel(translateSlideButton, isTranslatingSlide ? "Translating..." : "Translate Slide");
}

function selectedOptionLabel(select) {
  return select?.selectedOptions?.[0]?.textContent?.trim() || select?.value || "";
}

function collectActiveSlideTranslationItems() {
  serializeCurrentSlide();
  const slide = slides[activeSlideIndex];
  if (!slide || isDynamicSlide(slide)) {
    return [];
  }

  const items = [];
  for (const [index, object] of slide.objects.entries()) {
    if (object.type !== "text" || !String(object.text || "").trim()) {
      continue;
    }
    items.push({
      id: `object-${index}`,
      kind: "object",
      objectIndex: index,
      text: object.text,
    });
  }

  if (String(slide.notes || "").trim()) {
    items.push({
      id: "notes",
      kind: "notes",
      objectIndex: -1,
      text: slide.notes,
    });
  }

  return items;
}

function applyActiveSlideTranslation(items, translatedItems) {
  const slide = slides[activeSlideIndex];
  if (!slide || isDynamicSlide(slide)) {
    return false;
  }

  const translatedById = new Map(
    (translatedItems || [])
      .filter((item) => typeof item?.id === "string" && typeof item?.text === "string")
      .map((item) => [item.id, item.text])
  );
  const nextSlide = cloneProjectValue(slide);
  let changed = false;

  for (const item of items) {
    if (!translatedById.has(item.id)) {
      continue;
    }
    const translatedText = translatedById.get(item.id);
    if (item.kind === "notes") {
      if (nextSlide.notes !== translatedText) {
        nextSlide.notes = translatedText;
        changed = true;
      }
      continue;
    }

    const object = nextSlide.objects[item.objectIndex];
    if (object?.type === "text" && object.text !== translatedText) {
      object.text = translatedText;
      changed = true;
    }
  }

  if (!changed) {
    return false;
  }

  slides[activeSlideIndex] = nextSlide;
  loadSlide(activeSlideIndex, false);
  recordHistory();
  return true;
}

async function translateCurrentSlideContent() {
  if (isTranslatingSlide) {
    return;
  }

  const slide = slides[activeSlideIndex];
  if (!slide || isDynamicSlide(slide)) {
    setStatus("Git / GPT slides cannot be translated.");
    return;
  }

  const sourceLanguage = slideTranslateSource.value;
  const targetLanguage = slideTranslateTarget.value;
  if (!sourceLanguage || !targetLanguage) {
    setStatus("Please choose source and target languages.");
    return;
  }
  if (sourceLanguage === targetLanguage) {
    setStatus("Source and target languages are the same.");
    return;
  }

  const items = collectActiveSlideTranslationItems();
  if (items.length === 0) {
    setStatus("Current slide has no text or notes to translate.");
    return;
  }

  isTranslatingSlide = true;
  syncSlideTranslationControls();
  setStatus("Translating the current slide...");
  try {
    const result = await nativeApi.translateSlide({
      apiKey: appSettingsState.openAiApiKey,
      sourceLanguage,
      targetLanguage,
      items: items.map((item) => ({
        id: item.id,
        text: item.text,
      })),
    });
    const changed = applyActiveSlideTranslation(items, result?.items || []);
    setStatus(
      changed
        ? `Current slide translated to ${selectedOptionLabel(slideTranslateTarget)}.`
        : "Translation result is identical to the original."
    );
  } catch (error) {
    console.error("Slide translation failed", error);
    setStatus(formatErrorMessage(error, "Failed to translate the slide."));
  } finally {
    isTranslatingSlide = false;
    syncSlideTranslationControls();
  }
}

function setSimpleSelectOptions(select, values) {
  select.replaceChildren();
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

function syncTtsProviderControls(provider = projectSettingsState.ttsProvider) {
  const normalizedProvider = normalizeTtsProvider(provider);
  const config = getTtsProviderConfig(normalizedProvider);
  settingsTtsProvider.value = normalizedProvider;
  setSimpleSelectOptions(settingsTtsModel, config.models);

  settingsTtsVoiceSuggestions.replaceChildren();
  for (const voice of config.voices) {
    const option = document.createElement("option");
    option.value = voice;
    settingsTtsVoiceSuggestions.append(option);
  }

  settingsTtsVoice.placeholder = config.voicePlaceholder;
  settingsTtsSpeed.min = String(config.speedMin);
  settingsTtsSpeed.max = String(config.speedMax);
  settingsTtsInstructions.placeholder = config.instructionsPlaceholder;
  settingsTtsInstructions.disabled = normalizedProvider === "minimax";
}

function applyTtsProviderDefaults(provider) {
  const normalizedProvider = normalizeTtsProvider(provider);
  const config = getTtsProviderConfig(normalizedProvider);
  syncTtsProviderControls(normalizedProvider);
  settingsTtsModel.value = config.defaultModel;
  settingsTtsVoice.value = config.defaultVoice;
  settingsTtsSpeed.value = String(config.defaultSpeed);
  settingsTtsInstructions.value = config.defaultInstructions;
}

function getTtsSettings() {
  const provider = normalizeTtsProvider(projectSettingsState.ttsProvider);
  return {
    provider,
    apiKey: provider === "minimax" ? appSettingsState.miniMaxApiKey : appSettingsState.openAiApiKey,
    model: projectSettingsState.ttsModel,
    voice: projectSettingsState.ttsVoice,
    speed: projectSettingsState.ttsSpeed,
    instructions: projectSettingsState.ttsInstructions,
  };
}

function normalizeAppSettings(value = {}) {
  return {
    openAiApiKey: typeof value.openAiApiKey === "string" ? value.openAiApiKey.trim() : "",
    miniMaxApiKey: typeof value.miniMaxApiKey === "string" ? value.miniMaxApiKey.trim() : "",
  };
}

function setActiveSafeAreaPresetButton(preset) {
  const safePreset = normalizeSafeAreaPreset(preset);
  for (const button of settingsSafeAreaPresetButtons) {
    button.classList.toggle("is-active", button.dataset.safeAreaPreset === safePreset);
  }
}

function syncSafeAreaPresetControls() {
  const disabled = !settingsSafeAreaSnapEnabled.checked;
  for (const button of settingsSafeAreaPresetButtons) {
    button.disabled = disabled;
  }
}

function getActiveSafeAreaPresetSelection() {
  const activeButton = settingsSafeAreaPresetButtons.find((button) => button.classList.contains("is-active"));
  return normalizeSafeAreaPreset(activeButton?.dataset.safeAreaPreset ?? projectSettingsState.safeAreaPreset);
}

function setActiveSubtitleFontButton(fontFamily, fontWeight) {
  const safeFamily = normalizeSubtitleFontFamily(fontFamily);
  const safeWeight = normalizeSubtitleFontWeight(fontWeight);
  for (const button of settingsSubtitleFontButtons) {
    const buttonFamily = normalizeSubtitleFontFamily(button.dataset.subtitleFont);
    const buttonWeight = normalizeSubtitleFontWeight(button.dataset.subtitleFontWeight);
    button.classList.toggle("is-active", buttonFamily === safeFamily && buttonWeight === safeWeight);
  }
  scheduleSubtitleSettingsRowHeightUpdate();
}

function setActiveSubtitleStyleModeButton(mode) {
  const safeMode = normalizeSubtitleStyleMode(mode);
  for (const button of settingsSubtitleStyleButtons) {
    button.classList.toggle("is-active", button.dataset.subtitleStyleMode === safeMode);
  }
  settingsSubtitleFontLabel.hidden = safeMode !== "standard";
  settingsSubtitleStickerLabel.hidden = safeMode !== "sticker";
  scheduleSubtitleSettingsRowHeightUpdate();
}

function setActiveSubtitleTextEffectButton(effectKey) {
  const safeEffect = normalizeSubtitleTextEffect(effectKey);
  for (const button of settingsSubtitleStickerButtons) {
    button.classList.toggle("is-active", button.dataset.subtitleTextEffect === safeEffect);
  }
  scheduleSubtitleSettingsRowHeightUpdate();
}

function getActiveSubtitleFontSelection() {
  const activeButton = settingsSubtitleFontButtons.find((button) => button.classList.contains("is-active"));
  return {
    subtitleFontFamily: normalizeSubtitleFontFamily(activeButton?.dataset.subtitleFont ?? projectSettingsState.subtitleFontFamily),
    subtitleFontWeight: normalizeSubtitleFontWeight(activeButton?.dataset.subtitleFontWeight ?? projectSettingsState.subtitleFontWeight),
  };
}

function getActiveSubtitleStyleSelection() {
  const activeStyleButton = settingsSubtitleStyleButtons.find((button) => button.classList.contains("is-active"));
  const activeStickerButton = settingsSubtitleStickerButtons.find((button) => button.classList.contains("is-active"));
  return {
    subtitleStyleMode: normalizeSubtitleStyleMode(activeStyleButton?.dataset.subtitleStyleMode ?? projectSettingsState.subtitleStyleMode),
    subtitleTextEffect: normalizeSubtitleTextEffect(activeStickerButton?.dataset.subtitleTextEffect ?? projectSettingsState.subtitleTextEffect),
  };
}

function normalizeProjectSettings(value = {}) {
  const ttsProvider = normalizeTtsProvider(value.ttsProvider);
  return {
    canvasWidth: sanitizeNumber(value.canvasWidth, DEFAULT_CANVAS_WIDTH, 80, 4096),
    canvasHeight: sanitizeNumber(value.canvasHeight, DEFAULT_CANVAS_HEIGHT, 80, 4096),
    canvasColor: sanitizeColor(value.canvasColor, DEFAULT_CANVAS_COLOR),
    ttsProvider,
    ttsModel: normalizeTtsModel(value.ttsModel, ttsProvider),
    ttsVoice: normalizeTtsVoice(value.ttsVoice, ttsProvider),
    ttsSpeed: normalizeTtsSpeed(value.ttsSpeed, ttsProvider),
    ttsInstructions: normalizeTtsInstructions(value.ttsInstructions, ttsProvider),
    subtitleEnabled: normalizeSubtitleEnabled(value.subtitleEnabled),
    subtitleSize: normalizeSubtitleSize(value.subtitleSize),
    subtitleY: normalizeSubtitleY(value.subtitleY),
    subtitleStyleMode: normalizeSubtitleStyleMode(value.subtitleStyleMode),
    subtitleFontFamily: normalizeSubtitleFontFamily(value.subtitleFontFamily),
    subtitleFontWeight: normalizeSubtitleFontWeight(value.subtitleFontWeight),
    subtitleTextEffect: normalizeSubtitleTextEffect(value.subtitleTextEffect),
    safeAreaSnapEnabled: normalizeSafeAreaSnapEnabled(value.safeAreaSnapEnabled),
    safeAreaPreset: normalizeSafeAreaPreset(value.safeAreaPreset),
    exportDir: typeof value.exportDir === "string" && value.exportDir.trim() ? value.exportDir.trim() : defaultProjectExportDir,
    backgroundMusic: normalizeProjectBackgroundMusic(value.backgroundMusic),
  };
}

function syncSettingsControls() {
  settingsOpenAiApiKey.value = appSettingsState.openAiApiKey;
  settingsMiniMaxApiKey.value = appSettingsState.miniMaxApiKey;
  settingsCanvasWidth.value = String(projectSettingsState.canvasWidth);
  settingsCanvasHeight.value = String(projectSettingsState.canvasHeight);
  settingsCanvasColor.value = projectSettingsState.canvasColor;
  syncTtsProviderControls(projectSettingsState.ttsProvider);
  settingsTtsModel.value = projectSettingsState.ttsModel;
  settingsTtsVoice.value = projectSettingsState.ttsVoice;
  settingsTtsSpeed.value = String(projectSettingsState.ttsSpeed);
  settingsTtsInstructions.value = projectSettingsState.ttsInstructions;
  settingsSubtitleEnabled.checked = projectSettingsState.subtitleEnabled;
  settingsSubtitleSize.value = String(projectSettingsState.subtitleSize);
  settingsSubtitleY.value = String(projectSettingsState.subtitleY);
  setActiveSubtitleStyleModeButton(projectSettingsState.subtitleStyleMode);
  setActiveSubtitleFontButton(projectSettingsState.subtitleFontFamily, projectSettingsState.subtitleFontWeight);
  setActiveSubtitleTextEffectButton(projectSettingsState.subtitleTextEffect);
  settingsSafeAreaSnapEnabled.checked = projectSettingsState.safeAreaSnapEnabled;
  setActiveSafeAreaPresetButton(projectSettingsState.safeAreaPreset);
  syncSafeAreaPresetControls();
  settingsExportDir.value = projectSettingsState.exportDir;
  updateBackgroundMusicView();
  updateSafeAreaOverlay();
  syncColorPresetButtons();
  scheduleSubtitleSettingsRowHeightUpdate();
}

function getProjectSettingsFromControls() {
  const subtitleFont = getActiveSubtitleFontSelection();
  const subtitleStyle = getActiveSubtitleStyleSelection();
  return normalizeProjectSettings({
    canvasWidth: settingsCanvasWidth.value,
    canvasHeight: settingsCanvasHeight.value,
    canvasColor: settingsCanvasColor.value,
    ttsProvider: settingsTtsProvider.value,
    ttsModel: settingsTtsModel.value,
    ttsVoice: settingsTtsVoice.value,
    ttsSpeed: settingsTtsSpeed.value,
    ttsInstructions: settingsTtsInstructions.value,
    subtitleEnabled: settingsSubtitleEnabled.checked,
    subtitleSize: settingsSubtitleSize.value,
    subtitleY: settingsSubtitleY.value,
    subtitleStyleMode: subtitleStyle.subtitleStyleMode,
    subtitleFontFamily: subtitleFont.subtitleFontFamily,
    subtitleFontWeight: subtitleFont.subtitleFontWeight,
    subtitleTextEffect: subtitleStyle.subtitleTextEffect,
    safeAreaSnapEnabled: settingsSafeAreaSnapEnabled.checked,
    safeAreaPreset: getActiveSafeAreaPresetSelection(),
    exportDir: settingsExportDir.value,
    backgroundMusic: projectSettingsState.backgroundMusic,
  });
}

function applyProjectCanvasSettingsToSlides(options = {}) {
  if (slides.length === 0) {
    return;
  }

  serializeCurrentSlide();
  for (const slide of slides) {
    slide.width = projectSettingsState.canvasWidth;
    slide.height = projectSettingsState.canvasHeight;
    slide.color = projectSettingsState.canvasColor;
  }
  loadSlide(activeSlideIndex, false);
  fitCanvasToWorkspace();
  if (options.record) {
    recordHistory();
  } else {
    scheduleNativeProjectSave();
  }
}

async function loadAppSettings() {
  const settings = await nativeApi.getAppSettings();
  appSettingsState = normalizeAppSettings(settings);
  defaultProjectExportDir = await nativeApi.getDefaultExportDir();
  projectSettingsState = normalizeProjectSettings(projectSettingsState);
  syncSettingsControls();
}

async function saveSettings() {
  const nextAppSettings = normalizeAppSettings({
    openAiApiKey: settingsOpenAiApiKey.value,
    miniMaxApiKey: settingsMiniMaxApiKey.value,
  });
  const nextProjectSettings = getProjectSettingsFromControls();

  try {
    appSettingsState = normalizeAppSettings(await nativeApi.saveAppSettings(nextAppSettings));
    projectSettingsState = nextProjectSettings;
    applyProjectCanvasSettingsToSlides({ record: true });
    scheduleNativeProjectSave();
    syncSettingsControls();
    setStatus("Settings saved. API keys are app-wide; other values are saved with this project.");
    hideAppSettings();
  } catch (error) {
    setStatus(error?.message || "Failed to save settings.");
  }
}

function showAppSettings() {
  syncSettingsControls();
  appSettings.hidden = false;
  scheduleSubtitleSettingsRowHeightUpdate();
}

function hideAppSettings() {
  appSettings.hidden = true;
}

async function chooseProjectExportDirectory() {
  try {
    const path = await nativeApi.selectDirectory();
    if (path) {
      settingsExportDir.value = path;
      setStatus("Export folder selected. Save settings to apply.");
    }
  } catch (error) {
    setStatus(error?.message || "Failed to select export folder.");
  }
}

async function resetProjectExportDirectory() {
  try {
    settingsExportDir.value = defaultProjectExportDir;
    setStatus("Export folder reset to Downloads. Save settings to apply.");
  } catch (error) {
    setStatus(error?.message || "Failed to read the default Downloads folder.");
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

function syncDynamicTimingToSlide(options = {}) {
  updateActiveDynamicSlide((slide) => {
    slide.continueAfterTts = normalizeContinueAfterTts(dynamicContinueAfterTts?.checked);
  }, options);
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
      afterContent: gitTypingContent.value,
    };
  }, options);
}

function syncChatTextScaleButtons(value) {
  const normalized = sanitizeChatTextScale(value);
  for (const button of chatTextScaleButtons) {
    const buttonValue = sanitizeChatTextScale(button.dataset.chatTextScale);
    button.classList.toggle("is-active", Math.abs(buttonValue - normalized) < 0.01);
  }
}

function getSelectedChatTextScale() {
  const activeButton = chatTextScaleButtons.find((button) => button.classList.contains("is-active"));
  return sanitizeChatTextScale(activeButton?.dataset.chatTextScale);
}

function syncChatTypingInputsToSlide(options = {}) {
  updateActiveDynamicSlide((slide) => {
    slide.chatTyping = {
      ...getChatTypingData(slide),
      title: chatSlideTitle.value,
      typingSpeed: sanitizeTypingSpeed(chatTypingSpeed.value, DEFAULT_CHAT_TYPING_SPEED),
      textScale: getSelectedChatTextScale(),
      question: chatQuestion.value,
      answer: chatAnswer.value,
    };
  }, options);
}

async function chooseGitRepositoryForSlide() {
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
      content: "",
      beforeContent: "",
      afterContent: "",
      beforePath: "",
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
    setStatus("Please choose a Git repository folder first.");
    return "";
  }
  return repoPath;
}

async function loadGitCommitsForSlide() {
  const slide = getActiveGitTypingSlide();
  if (!slide) {
    return;
  }
  const repoPath = requireGitRepoPath();
  if (!repoPath) {
    return;
  }
  try {
    setStatus("Loading Git commit history...");
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
        content: "",
        beforeContent: "",
        afterContent: "",
        beforePath: "",
      };
    }, { record: !selectedCommit });
    syncDynamicSlidePanel();
    if (selectedCommit) {
      await loadGitFilesForSlide({ record: true, clearContent: true, autoLoadChange: true });
    } else {
      setStatus("No readable commits were found in this repository.");
    }
  } catch (error) {
    setStatus(error?.message || "Failed to read Git commit history.");
  }
}

async function loadGitFilesForSlide(options = {}) {
  const slide = getActiveGitTypingSlide();
  if (!slide) {
    return;
  }
  const repoPath = requireGitRepoPath();
  const commitHash = gitCommitSelect.value;
  if (!repoPath || !commitHash) {
    setStatus("Please select a commit first.");
    return;
  }
  try {
    setStatus("Loading the list of files changed in this commit...");
    const result = await nativeApi.listGitCommitFiles(repoPath, commitHash);
    const files = sanitizeGitFileOptions(result.files);
    const current = getGitTypingData(slide);
    const selectedFilePath = files.includes(current.filePath) ? current.filePath : files[0] || "";
    const selectedCommit = current.commits.find((commit) => commit.hash === commitHash);
    const shouldClearContent = options.clearContent || !current.content;
    updateActiveDynamicSlide((activeSlide) => {
      activeSlide.gitTyping = {
        ...getGitTypingData(activeSlide),
        repoPath: result.repoPath || repoPath,
        commitHash,
        commitLabel: selectedCommit?.label || current.commitLabel || commitHash,
        filePath: selectedFilePath,
        files,
        content: shouldClearContent ? "" : current.content,
        beforeContent: "",
        afterContent: shouldClearContent ? "" : current.afterContent,
        beforePath: "",
      };
    }, { record: Boolean(options.record) });
    syncDynamicSlidePanel();
    if (selectedFilePath && options.autoLoadChange) {
      await loadGitFileChangeForSlide({ record: Boolean(options.record) });
      return;
    }
    setStatus(files.length ? "Loaded the list of changed files." : "No files were changed in this commit.");
  } catch (error) {
    setStatus(error?.message || "Failed to read Git changed files.");
  }
}

async function loadGitFileChangeForSlide(options = {}) {
  const slide = getActiveGitTypingSlide();
  if (!slide) {
    return;
  }
  const repoPath = requireGitRepoPath();
  const commitHash = gitCommitSelect.value;
  const filePath = gitFileSelect.value;
  if (!repoPath || !commitHash || !filePath) {
    setStatus("Please select a repository, commit, and file.");
    return;
  }
  try {
    setStatus("Loading changes for the selected file...");
    const result = await nativeApi.readGitCommitFileChange(repoPath, commitHash, filePath);
    const current = getGitTypingData(slide);
    updateActiveDynamicSlide((activeSlide) => {
      activeSlide.gitTyping = {
        ...getGitTypingData(activeSlide),
        repoPath: result.repoPath || repoPath,
        commitHash: result.commitHash || commitHash,
        commitLabel: current.commitLabel || result.commitHash || commitHash,
        filePath: result.filePath || filePath,
        title: result.title || "Git Diff",
        content: result.afterContent || result.beforeContent || result.content || "",
        beforeContent: result.beforeContent || "",
        afterContent: result.afterContent || result.content || "",
        beforePath: result.beforePath || "",
      };
    }, { record: options.record !== false });
    syncDynamicSlidePanel();
    setStatus("Loaded changes for the selected file into the typing slide.");
  } catch (error) {
    setStatus(error?.message || "Failed to read Git file changes.");
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
    throw new Error("Video export cancelled.");
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
  setExportModalProgress("Preparing", "Preparing export...", 0, 1);

  try {
    activeExportJob.unlisten = await nativeApi.listenVideoExportProgress((progress) => {
      if (!activeExportJob || progress?.exportId !== activeExportJob.id) {
        return;
      }
      setExportModalProgress(
        progress.phase || "Exporting",
        progress.message || "Generating the video file...",
        progress.current,
        progress.total
      );
    });
  } catch {
    activeExportJob.unlisten = null;
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
  setExportModalProgress("Cancelling", "Cancelling video export...", 1, 1);
  try {
    await nativeApi.cancelVideoExport(activeExportJob.id);
  } catch {
    // The frontend render phase can still cancel even if the native command has not started.
  }
}

async function exportProjectAsMp4() {
  serializeCurrentSlide();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const baseName = getProjectName().replace(/[\\/:*?"<>|]/g, "-") || "slide-cut";
  let outputPath;
  try {
    outputPath = await nativeApi.selectMp4Output(`${baseName}-${timestamp}.mp4`, projectSettingsState.exportDir);
  } catch (error) {
    setStatus(error?.message || "Failed to choose the video output path.");
    return;
  }
  if (!outputPath) {
    return;
  }

  const previousDisabled = exportMp4.disabled;
  const exportId = createExportId();
  exportMp4.disabled = true;
  await beginExportJob(exportId);
  setStatus("Rendering slides into video frames...");

  try {
    const backgroundMusic = normalizeProjectBackgroundMusic(projectSettingsState.backgroundMusic);
    const renderedSlides = [];
    for (let index = 0; index < slides.length; index += 1) {
      throwIfExportCancelled();
      let slide = slides[index];
      if (sanitizeSlideKind(slide?.kind) === "gitTyping") {
        slide = await refreshGitTypingSlideForExport(slide);
      }
      const video = normalizeSlideVideo(slide.video);
      const startSound = normalizeSlideStartSound(slide.startSound);
      setExportModalProgress("Rendering", `Rendering slide ${index + 1} / ${slides.length}...`, index, slides.length);
      const notes = getExportNotesText(slide.notes);
      const narrationSegments = getNarrationSegmentsForExport(slide);
      const subtitleSegments = narrationSegments.map((segment) => segment.text);
      const hasNarration = narrationSegments.length > 0;
      const gifOverlays = getAnimatedGifOverlays(slide);
      const subtitleRenderOptions = getProjectSubtitleRenderOptions();
      await ensureSlideFontsReady(slide, {
        reserveSubtitles: projectSettingsState.subtitleEnabled,
        subtitleText: notes,
        ...subtitleRenderOptions,
      });
      const subtitleImages = await renderSubtitleImagesForSegments(slide, subtitleSegments);
      const baseSlidePayload = {
        index,
        width: roundedCanvasSize(slide.width),
        height: roundedCanvasSize(slide.height),
        color: sanitizeColor(slide.color, "#ffffff"),
        videoPath: video?.path || null,
        videoFit: video?.fit || DEFAULT_VIDEO_FIT,
        videoFrameRatio: video?.frameRatio || DEFAULT_VIDEO_FRAME_RATIO,
        notes,
        ttsSegments: subtitleSegments,
        narrationSegments,
        subtitleImages,
        subtitleEnabled: projectSettingsState.subtitleEnabled,
        subtitleSize: subtitleRenderOptions.subtitleSize,
        subtitleY: subtitleRenderOptions.subtitleY,
        subtitleFontFamily: subtitleRenderOptions.subtitleFontFamily,
        subtitleFontWeight: subtitleRenderOptions.subtitleFontWeight,
      };
      if (isDynamicSlide(slide)) {
        setExportModalProgress("Rendering", `Generating typing frames for slide ${index + 1} / ${slides.length}...`, index, slides.length);
        const animation = await renderDynamicSlideFrames(slide, {
          excludeAnimatedGifs: gifOverlays.length > 0,
          subtitles: false,
          reserveSubtitles: projectSettingsState.subtitleEnabled,
          subtitleText: notes,
          ...subtitleRenderOptions,
          durationSeconds: getSlideAnimationFrameDuration(slide, notes),
        });
        renderedSlides.push({
          ...baseSlidePayload,
          startSoundPath: startSound?.path || null,
          fitAnimationToDuration: false,
          framePng: animation.framePng,
          animationFrames: animation.frames,
          frameRate: animation.frameRate,
          animationDurationSeconds: animation.duration,
          animationAffectsDuration: !hasNarration,
          ...(gifOverlays.length ? { gifOverlays } : {}),
        });
      } else {
        const renderOptions = {
          transparentBackground: Boolean(video),
          excludeAnimatedGifs: gifOverlays.length > 0,
          subtitles: false,
          subtitleText: notes,
          ...subtitleRenderOptions,
        };
        if (slideHasObjectAnimations(slide)) {
          const loopAnimationFrames = shouldLoopAnimationFrames(slide);
          const animation = await renderCanvasSlideAnimationFrames(slide, {
            ...renderOptions,
            durationSeconds: getSlideAnimationFrameDuration(slide, notes),
            loopFrames: loopAnimationFrames,
          });
          renderedSlides.push({
            ...baseSlidePayload,
            startSoundPath: startSound?.path || null,
            ...(gifOverlays.length ? { gifOverlays } : {}),
            framePng: animation.framePng,
            animationFrames: animation.frames,
            frameRate: animation.frameRate,
            animationDurationSeconds: animation.duration,
            loopAnimationFrames,
            fitAnimationToDuration: false,
            animationAffectsDuration: !hasNarration,
          });
        } else {
          renderedSlides.push({
            ...baseSlidePayload,
            startSoundPath: startSound?.path || null,
            ...(gifOverlays.length ? { gifOverlays } : {}),
            framePng: await renderSlideToDataUrl(slide, renderOptions),
          });
        }
      }
    }

    throwIfExportCancelled();
    setExportModalProgress("Encoding", "Generating audio and video segments...", 0, 1);
    const result = await nativeApi.exportVideo({
      exportId,
      outputPath,
      fps: VIDEO_EXPORT_FPS,
      fallbackDurationSeconds: VIDEO_EXPORT_FALLBACK_DURATION,
      backgroundMusicPath: backgroundMusic?.path || null,
      tts: getTtsSettings(),
      slides: renderedSlides,
    });
    setExportModalProgress("Complete", "Video export complete.", 1, 1);
    setStatus(`Video exported: ${result?.outputPath || outputPath}`);
  } catch (error) {
    const message = error?.message || String(error) || "Video export failed.";
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
    const file = imageItem.getAsFile();
    loadImageBlob(file, file?.name || "clipboard-image").catch(() => setStatus("Failed to read image."));
    return;
  }

  const text = event.clipboardData?.getData("text/plain");
  if (text) {
    event.preventDefault();
    addTextObject(text);
  }
}

function applySelectedInputChange(changedField) {
  if (!selectedObject) {
    return;
  }
  const previousState = getState(selectedObject);
  let width = numberOr(selectedW.value, 8);
  let height = numberOr(selectedH.value, 8);
  if (aspectRatioLocked && previousState.width > 0 && previousState.height > 0) {
    const ratio = previousState.width / previousState.height;
    if (changedField === "w") {
      height = Math.max(8, Math.round(width / ratio));
      selectedH.value = height;
    } else if (changedField === "h") {
      width = Math.max(8, Math.round(height * ratio));
      selectedW.value = width;
    }
  }
  applyState(selectedObject, {
    x: numberOr(selectedX.value, 0),
    y: numberOr(selectedY.value, 0),
    width,
    height,
    rotation: numberOr(selectedR.value, 0),
  });
  fitTextBoxToContentAfterWidthChange(selectedObject, previousState.width);
}

function setAspectLockIcon() {
  const oldIcon = selectedAspectLock.querySelector(".button-icon");
  if (oldIcon) {
    oldIcon.remove();
  }
  const iconName = aspectRatioLocked ? "lock" : "unlock";
  selectedAspectLock.dataset.icon = iconName;
  const svg = createLucideSvg(iconName);
  if (svg) {
    selectedAspectLock.prepend(svg);
    selectedAspectLock.classList.add("has-icon");
  }
}

function setAspectRatioLocked(locked) {
  aspectRatioLocked = Boolean(locked);
  selectedAspectLock.setAttribute("aria-pressed", aspectRatioLocked ? "true" : "false");
  selectedAspectLock.title = aspectRatioLocked ? "Unlock aspect ratio" : "Lock aspect ratio";
  setAspectLockIcon();
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
  if (!fitTextBoxToContent(selectedObject)) {
    renderTextObject(selectedObject);
  }
  setStatus(`Text size changed to ${preset.fontSize}px.`);
  renderSlideList();
  recordHistory();
}

function applySelectedTextFontChange(fontFamily, fontWeight) {
  if (!selectedObject || selectedObject.dataset.type !== "text") {
    return;
  }

  const safeFamily = sanitizeTextFontFamily(fontFamily);
  const safeWeight = sanitizeTextFontWeight(fontWeight);
  selectedObject.dataset.fontFamily = safeFamily;
  selectedObject.dataset.fontWeight = String(safeWeight);
  setActiveTextFontButton(safeFamily, safeWeight);
  setActiveTextWeightButton(safeWeight);
  const editor = selectedObject.querySelector(".text-editor");
  editor.style.fontFamily = quoteFontFamily(safeFamily);
  editor.style.fontWeight = String(safeWeight);
  if (!fitTextBoxToContent(selectedObject)) {
    renderTextObject(selectedObject);
  }
  setStatus(`Text font changed to ${safeFamily}.`);
  renderSlideList();
  recordHistory();
}

function applySelectedTextWeightChange(fontWeight) {
  if (!selectedObject || selectedObject.dataset.type !== "text") {
    return;
  }

  const safeWeight = sanitizeTextFontWeight(fontWeight);
  selectedObject.dataset.fontWeight = String(safeWeight);
  setActiveTextFontButton(selectedObject.dataset.fontFamily, safeWeight);
  setActiveTextWeightButton(safeWeight);
  const editor = selectedObject.querySelector(".text-editor");
  editor.style.fontWeight = String(safeWeight);
  if (!fitTextBoxToContent(selectedObject)) {
    renderTextObject(selectedObject);
  }
  setStatus(`Text weight changed to ${safeWeight}.`);
  renderSlideList();
  recordHistory();
}

function applySelectedTextStyleChange(effectKey) {
  if (!selectedObject || selectedObject.dataset.type !== "text") {
    return;
  }
  const safeEffect = sanitizeTextEffect(effectKey);
  const preset = TEXT_EFFECT_PRESETS[safeEffect] || TEXT_EFFECT_PRESETS[DEFAULT_TEXT_EFFECT];
  selectedObject.dataset.textEffect = safeEffect;
  selectedObject.dataset.fontFamily = sanitizeTextFontFamily(preset.fontFamily);
  selectedObject.dataset.fontWeight = String(sanitizeTextFontWeight(preset.fontWeight));
  if (preset.fillColor) {
    selectedObject.dataset.textColor = preset.fillColor;
    selectedTextColor.value = preset.fillColor;
  }
  setActiveTextStyleButton(safeEffect);
  setActiveTextFontButton(selectedObject.dataset.fontFamily, selectedObject.dataset.fontWeight);
  setActiveTextWeightButton(selectedObject.dataset.fontWeight);
  const editor = selectedObject.querySelector(".text-editor");
  editor.style.fontFamily = quoteFontFamily(sanitizeTextFontFamily(selectedObject.dataset.fontFamily));
  editor.style.fontWeight = selectedObject.dataset.fontWeight;
  editor.style.color = selectedObject.dataset.textColor || DEFAULT_TEXT_COLOR;
  if (!fitTextBoxToContent(selectedObject)) {
    renderTextObject(selectedObject);
  }
  setStatus(`Text style changed to ${preset.label || safeEffect}.`);
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
  setStatus(`Text color changed to ${selectedTextColor.value}.`);
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
  setStatus(`Text align changed to ${safeAlign}.`);
  renderSlideList();
  recordHistory();
}

function applySelectedAnimationChange(kind, value) {
  const field =
    {
      in: "animationIn",
      loop: "animationLoop",
      speed: "animationSpeed",
      move: "animationMove",
      moveEasing: "animationMoveEasing",
    }[kind] || "";
  if (!field || !canAnimateElement(selectedObject)) {
    return;
  }

  const nextValue =
    field === "animationIn"
      ? sanitizeAnimationIn(value)
      : field === "animationLoop"
        ? sanitizeAnimationLoop(value)
        : field === "animationMove"
          ? sanitizeAnimationMove(value)
          : field === "animationMoveEasing"
            ? sanitizeAnimationMoveEasing(value)
            : sanitizeAnimationSpeed(value);
  const targets = selectedObjects.filter(canAnimateElement);
  for (const object of targets.length ? targets : [selectedObject]) {
    if (field === "animationMove" && nextValue === "move" && sanitizeAnimationMove(object.dataset.animationMove) !== "move") {
      const state = getState(object);
      object.dataset.animationMoveFromX = String(Math.round(state.x));
      object.dataset.animationMoveFromY = String(Math.round(state.y));
      object.dataset.animationMoveToX = String(Math.round(state.x + Math.min(160, Math.max(80, canvas.offsetWidth * 0.12))));
      object.dataset.animationMoveToY = String(Math.round(state.y));
      object.dataset.animationMoveDuration = String(DEFAULT_ANIMATION_MOVE_DURATION);
      object.dataset.animationMoveEasing = DEFAULT_ANIMATION_MOVE_EASING;
    }
    object.dataset[field] = nextValue;
  }

  syncAnimationButtons(getElementAnimationData(selectedObject));
  syncSelectedInputs();
  syncObjectAnimationPreview();
  renderSlideList();
  setStatus(`Animation updated on ${targets.length || 1} object${(targets.length || 1) === 1 ? "" : "s"}.`);
  recordHistory();
}

function applySelectedMoveInputChange(shouldRecord = false) {
  if (!canAnimateElement(selectedObject)) {
    return;
  }
  selectedObject.dataset.animationMove = "move";
  selectedObject.dataset.animationMoveFromX = String(sanitizeAnimationMoveCoordinate(selectedMoveFromX.value));
  selectedObject.dataset.animationMoveFromY = String(sanitizeAnimationMoveCoordinate(selectedMoveFromY.value));
  selectedObject.dataset.animationMoveToX = String(sanitizeAnimationMoveCoordinate(selectedMoveToX.value));
  selectedObject.dataset.animationMoveToY = String(sanitizeAnimationMoveCoordinate(selectedMoveToY.value));
  selectedObject.dataset.animationMoveDuration = String(sanitizeAnimationMoveDuration(selectedMoveDuration.value));
  selectedObject.dataset.animationMoveEasing = sanitizeAnimationMoveEasing(selectedObject.dataset.animationMoveEasing);
  syncAnimationButtons(getElementAnimationData(selectedObject));
  syncObjectAnimationPreview();
  renderSlideList();
  if (shouldRecord) {
    setStatus("Move animation coordinates updated.");
    recordHistory();
  }
}

function applySelectedAnimationInDelayInputChange(shouldRecord = false) {
  if (!canAnimateElement(selectedObject)) {
    return;
  }
  const nextDelay = sanitizeAnimationInDelay(selectedAnimationInDelay.value);
  const targets = selectedObjects.filter(canAnimateElement);
  for (const object of targets.length ? targets : [selectedObject]) {
    object.dataset.animationInDelay = String(nextDelay);
  }
  syncObjectAnimationPreview();
  renderSlideList();
  if (shouldRecord) {
    selectedAnimationInDelay.value = String(nextDelay);
    setStatus(`In animation delay set to ${nextDelay}s.`);
    recordHistory();
  }
}

function setSelectedMovePoint(point) {
  if (!canAnimateElement(selectedObject)) {
    return;
  }
  const state = getState(selectedObject);
  if (point === "from") {
    selectedMoveFromX.value = Math.round(state.x);
    selectedMoveFromY.value = Math.round(state.y);
  } else if (point === "to") {
    selectedMoveToX.value = Math.round(state.x);
    selectedMoveToY.value = Math.round(state.y);
  }
  applySelectedMoveInputChange(true);
}

function applyColorPreset(presetKey) {
  const preset = COLOR_PRESETS[presetKey];
  if (!preset) {
    return;
  }

  settingsCanvasColor.value = preset.canvasColor;
  syncColorPresetButtons();
  setStatus(`${preset.canvasColor === "#000000" ? "Black background / white text" : "White background / black text"} preset selected. Save settings to apply.`);
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
  setStatus(`Style updated on ${shapeObjects.length} shape object${shapeObjects.length === 1 ? "" : "s"}.`);
  if (shouldRecord) {
    recordHistory();
  }
}

addNoteSegmentButton.addEventListener("click", () => {
  addNoteSegment("", { focus: true });
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
for (const button of imageFlipButtons) {
  button.addEventListener("click", () => flipSelectedImages(button.dataset.imageFlip));
}
projectNameInput.addEventListener("change", () => {
  activeProjectName = getProjectName();
  projectNameInput.value = activeProjectName;
  if (activeProjectId) {
    renameNativeProject(activeProjectId, activeProjectName);
  } else {
    scheduleNativeProjectSave();
  }
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
saveAppSettingsButton.addEventListener("click", saveSettings);
chooseBackgroundMusic.addEventListener("click", chooseBackgroundMusicForProject);
clearBackgroundMusic.addEventListener("click", clearBackgroundMusicForProject);
chooseExportDir.addEventListener("click", chooseProjectExportDirectory);
resetExportDir.addEventListener("click", resetProjectExportDirectory);
appSettings.addEventListener("click", (event) => {
  if (event.target === appSettings) {
    hideAppSettings();
  }
});
window.addEventListener("resize", scheduleSubtitleSettingsRowHeightUpdate);
document.fonts?.ready?.then(scheduleSubtitleSettingsRowHeightUpdate).catch(() => {});
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
for (const button of videoFitButtons) {
  button.addEventListener("click", () => setVideoFitForCurrentSlide(button.dataset.videoFit));
}
for (const button of videoFrameRatioButtons) {
  button.addEventListener("click", () => setVideoFrameRatioForCurrentSlide(button.dataset.videoFrameRatio));
}
chooseSlideSound.addEventListener("click", chooseSoundForCurrentSlide);
clearSlideSound.addEventListener("click", clearSoundForCurrentSlide);
settingsCanvasWidth.addEventListener("blur", () => {
  settingsCanvasWidth.value = String(sanitizeNumber(settingsCanvasWidth.value, DEFAULT_CANVAS_WIDTH, 80, 4096));
});
settingsCanvasHeight.addEventListener("blur", () => {
  settingsCanvasHeight.value = String(sanitizeNumber(settingsCanvasHeight.value, DEFAULT_CANVAS_HEIGHT, 80, 4096));
});
settingsCanvasColor.addEventListener("input", syncColorPresetButtons);
settingsCanvasColor.addEventListener("change", syncColorPresetButtons);
settingsTtsProvider.addEventListener("change", () => {
  applyTtsProviderDefaults(settingsTtsProvider.value);
});
settingsTtsModel.addEventListener("change", () => {
  settingsTtsModel.value = normalizeTtsModel(settingsTtsModel.value, settingsTtsProvider.value);
});
settingsTtsVoice.addEventListener("blur", () => {
  settingsTtsVoice.value = normalizeTtsVoice(settingsTtsVoice.value, settingsTtsProvider.value);
});
settingsTtsSpeed.addEventListener("blur", () => {
  settingsTtsSpeed.value = String(normalizeTtsSpeed(settingsTtsSpeed.value, settingsTtsProvider.value));
});
settingsSubtitleSize.addEventListener("blur", () => {
  settingsSubtitleSize.value = String(normalizeSubtitleSize(settingsSubtitleSize.value));
});
settingsSubtitleY.addEventListener("blur", () => {
  settingsSubtitleY.value = String(normalizeSubtitleY(settingsSubtitleY.value));
});
settingsSafeAreaSnapEnabled.addEventListener("change", syncSafeAreaPresetControls);
for (const button of settingsSafeAreaPresetButtons) {
  button.addEventListener("click", () => {
    setActiveSafeAreaPresetButton(button.dataset.safeAreaPreset);
  });
}
for (const button of settingsSubtitleStyleButtons) {
  button.addEventListener("click", () => {
    setActiveSubtitleStyleModeButton(button.dataset.subtitleStyleMode);
  });
}
for (const button of settingsSubtitleFontButtons) {
  button.addEventListener("click", () => {
    setActiveSubtitleFontButton(button.dataset.subtitleFont, button.dataset.subtitleFontWeight);
  });
}
for (const button of settingsSubtitleStickerButtons) {
  button.addEventListener("click", () => {
    setActiveSubtitleTextEffectButton(button.dataset.subtitleTextEffect);
  });
}

pasteImage.addEventListener("click", pasteImageFromClipboard);
chooseImage.addEventListener("click", chooseImageFileForCurrentSlide);
addTextBox.addEventListener("click", () => {
  addTextObject("Text", "Text box created. Type to change its contents.");
  startTextEdit(selectedObject);
});
addGitTypingSlide.addEventListener("click", () => addDynamicSlide("gitTyping"));
addChatTypingSlide.addEventListener("click", () => addDynamicSlide("chatTyping"));
translateSlideButton.addEventListener("click", translateCurrentSlideContent);
chooseGitRepo.addEventListener("click", () => {
  chooseGitRepositoryForSlide();
});
gitCommitSelect.addEventListener("change", () => {
  gitTypingContent.value = "";
  syncGitTypingInputsToSlide({ record: true });
  loadGitFilesForSlide({ record: true, clearContent: true, autoLoadChange: true });
});
gitFileSelect.addEventListener("change", () => {
  gitTypingContent.value = "";
  syncGitTypingInputsToSlide({ record: true });
  loadGitFileChangeForSlide({ record: true });
});
for (const input of [gitSlideTitle, gitRepoPath, gitTypingSpeed, gitTypingContent]) {
  input.addEventListener("input", () => syncGitTypingInputsToSlide());
  input.addEventListener("change", () => syncGitTypingInputsToSlide({ record: true }));
}
dynamicContinueAfterTts.addEventListener("change", () => {
  syncDynamicTimingToSlide({ record: true });
  setStatus(dynamicContinueAfterTts.checked ? "Slide continues after TTS finishes." : "Slide advances when TTS finishes.");
});
for (const input of [chatSlideTitle, chatTypingSpeed, chatQuestion, chatAnswer]) {
  input.addEventListener("input", () => syncChatTypingInputsToSlide());
  input.addEventListener("change", () => syncChatTypingInputsToSlide({ record: true }));
}
for (const button of chatTextScaleButtons) {
  button.addEventListener("click", () => {
    syncChatTextScaleButtons(button.dataset.chatTextScale);
    syncChatTypingInputsToSlide({ record: true });
  });
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
saveProject.addEventListener("click", exportProjectFile);
openProject.addEventListener("click", importNativeProjectFile);
addSlide.addEventListener("click", addNewSlide);
duplicateSlide.addEventListener("click", duplicateCurrentSlide);
deleteSlide.addEventListener("click", deleteCurrentSlide);

const selectedInputFieldMap = new Map([
  [selectedX, "x"],
  [selectedY, "y"],
  [selectedW, "w"],
  [selectedH, "h"],
  [selectedR, "r"],
]);
for (const [input, field] of selectedInputFieldMap) {
  input.addEventListener("input", () => applySelectedInputChange(field));
  input.addEventListener("change", () => {
    applySelectedInputChange(field);
    renderSlideList();
    recordHistory();
  });
  input.addEventListener("blur", recordHistory);
}
selectedAspectLock.addEventListener("click", () => {
  setAspectRatioLocked(!aspectRatioLocked);
});
setAspectRatioLocked(false);
for (const button of textSizeButtons) {
  button.addEventListener("click", () => applySelectedTextSizeChange(button.dataset.textSize));
}
for (const button of textFontButtons) {
  button.addEventListener("click", () => applySelectedTextFontChange(button.dataset.textFont, button.dataset.textFontWeight));
}
for (const button of textWeightButtons) {
  button.addEventListener("click", () => applySelectedTextWeightChange(button.dataset.textWeight));
}
for (const button of textStyleButtons) {
  button.addEventListener("click", () => applySelectedTextStyleChange(button.dataset.textStyle));
}
for (const button of textAlignButtons) {
  button.addEventListener("click", () => applySelectedTextAlignChange(button.dataset.textAlign));
}
for (const button of animationInButtons) {
  button.addEventListener("click", () => applySelectedAnimationChange("in", button.dataset.animationIn));
}
for (const button of animationLoopButtons) {
  button.addEventListener("click", () => applySelectedAnimationChange("loop", button.dataset.animationLoop));
}
for (const button of animationSpeedButtons) {
  button.addEventListener("click", () => applySelectedAnimationChange("speed", button.dataset.animationSpeed));
}
for (const button of animationMoveButtons) {
  button.addEventListener("click", () => applySelectedAnimationChange("move", button.dataset.animationMove));
}
for (const button of animationMoveEasingButtons) {
  button.addEventListener("click", () => applySelectedAnimationChange("moveEasing", button.dataset.animationMoveEasing));
}
for (const button of animationMovePointButtons) {
  button.addEventListener("click", () => setSelectedMovePoint(button.dataset.animationMovePoint));
}
selectedAnimationInDelay.addEventListener("input", () => applySelectedAnimationInDelayInputChange());
selectedAnimationInDelay.addEventListener("change", () => applySelectedAnimationInDelayInputChange(true));
for (const input of [selectedMoveFromX, selectedMoveFromY, selectedMoveToX, selectedMoveToY, selectedMoveDuration]) {
  input.addEventListener("input", () => applySelectedMoveInputChange());
  input.addEventListener("change", () => applySelectedMoveInputChange(true));
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
    saveProjectInternally();
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

function initCollapsiblePanels() {
  const panels = document.querySelectorAll('.toolbar .panel[data-collapsible="true"]');
  panels.forEach((panel) => {
    const key = `panel-collapsed:${panel.id || panel.getAttribute("aria-labelledby") || ""}`;
    const header = panel.querySelector(".panel-title-row.panel-toggle") || panel.querySelector("h2.panel-toggle");
    if (!header) return;

    if (key && localStorage.getItem(key) === "1") {
      panel.classList.add("is-collapsed");
      header.setAttribute("aria-expanded", "false");
    }

    const toggle = (event) => {
      if (event?.target?.closest("button, input, select, textarea")) return;
      const collapsed = panel.classList.toggle("is-collapsed");
      header.setAttribute("aria-expanded", collapsed ? "false" : "true");
      if (key) localStorage.setItem(key, collapsed ? "1" : "0");
    };

    header.addEventListener("click", toggle);
    header.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle(event);
      }
    });
  });
}

async function initializeApp() {
  try {
    await loadAppSettings();
  } catch (error) {
    setStatus(error?.message || "Failed to load app settings.");
    appSettingsState = normalizeAppSettings();
    projectSettingsState = normalizeProjectSettings(projectSettingsState);
    syncSettingsControls();
  }

  setDrawTool("select", { silent: true });
  slides = [createDefaultSlide()];
  loadSlide(0, false);
  resetHistory();

  try {
    await initializeNativeMode();
  } catch (error) {
    setStatus(error?.message || "Failed to initialize project list.");
  }

  hydrateButtonIcons();
  initCollapsiblePanels();
}

initializeApp();
