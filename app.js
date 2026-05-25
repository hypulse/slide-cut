import { createRenderer } from "./rendering.js";
import { createProjectModel } from "./project-model.js";

const canvas = document.querySelector("#canvas");
const slideNotes = document.querySelector("#slideNotes");
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
const settingsTtsProvider = document.querySelector("#settingsTtsProvider");
const settingsTtsModel = document.querySelector("#settingsTtsModel");
const settingsTtsVoice = document.querySelector("#settingsTtsVoice");
const settingsTtsVoiceSuggestions = document.querySelector("#ttsVoiceSuggestions");
const settingsTtsSpeed = document.querySelector("#settingsTtsSpeed");
const settingsTtsInstructions = document.querySelector("#settingsTtsInstructions");
const settingsSubtitleEnabled = document.querySelector("#settingsSubtitleEnabled");
const settingsSubtitleSize = document.querySelector("#settingsSubtitleSize");
const settingsSubtitleY = document.querySelector("#settingsSubtitleY");
const settingsExportDir = document.querySelector("#settingsExportDir");
const chooseExportDir = document.querySelector("#chooseExportDir");
const resetExportDir = document.querySelector("#resetExportDir");

const selectedPanel = document.querySelector(".selected-panel");
const selectedX = document.querySelector("#selectedX");
const selectedY = document.querySelector("#selectedY");
const selectedW = document.querySelector("#selectedW");
const selectedH = document.querySelector("#selectedH");
const selectedR = document.querySelector("#selectedR");
const selectedMoveFromX = document.querySelector("#selectedMoveFromX");
const selectedMoveFromY = document.querySelector("#selectedMoveFromY");
const selectedMoveToX = document.querySelector("#selectedMoveToX");
const selectedMoveToY = document.querySelector("#selectedMoveToY");
const selectedMoveDuration = document.querySelector("#selectedMoveDuration");
const selectedTextSize = document.querySelector("#selectedTextSize");
const imageFlipButtons = [...document.querySelectorAll("[data-image-flip]")];
const canvasAlignButtons = [...document.querySelectorAll("[data-canvas-align]")];
const textSizeButtons = [...document.querySelectorAll("[data-text-size]")];
const textStyleButtons = [...document.querySelectorAll("[data-text-style]")];
const textAlignButtons = [...document.querySelectorAll("[data-text-align]")];
const animationInButtons = [...document.querySelectorAll("[data-animation-in]")];
const animationLoopButtons = [...document.querySelectorAll("[data-animation-loop]")];
const animationOutButtons = [...document.querySelectorAll("[data-animation-out]")];
const animationSpeedButtons = [...document.querySelectorAll("[data-animation-speed]")];
const animationMoveButtons = [...document.querySelectorAll("[data-animation-move]")];
const animationMoveEasingButtons = [...document.querySelectorAll("[data-animation-move-easing]")];
const animationMovePointButtons = [...document.querySelectorAll("[data-animation-move-point]")];
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
const DEFAULT_TEXT_EFFECT = "clean";
const TEXT_FONT_FAMILIES = new Set(["Pretendard", "Gmarket Sans", "Jua", "Black Han Sans", "Do Hyeon", "Noto Sans KR"]);
const TEXT_EFFECT_PRESETS = {
  clean: {
    label: "Clean",
    fontFamily: "Pretendard",
    fontWeight: 600,
  },
  cleanReel: {
    label: "Clean Reel",
    fontFamily: "Noto Sans KR",
    fontWeight: 700,
    fillColor: "#ffffff",
    strokeColor: "#050505",
    strokeWidth: 7,
    shadowColor: "rgba(0, 0, 0, 0.32)",
    shadowBlur: 3,
    shadowOffsetX: 2,
    shadowOffsetY: 3,
  },
  popSticker: {
    label: "Pop Sticker",
    fontFamily: "Gmarket Sans",
    fontWeight: 700,
    fillColor: "#ffffff",
    strokeColor: "#111111",
    strokeWidth: 7,
    shadowColor: "#ffd83d",
    shadowBlur: 0,
    shadowOffsetX: 5,
    shadowOffsetY: 5,
  },
  candyLabel: {
    label: "Candy Label",
    fontFamily: "Jua",
    fontWeight: 400,
    fillColor: "#ff5cab",
    strokeColor: "#ffffff",
    strokeWidth: 8,
    shadowColor: "rgba(126, 51, 167, 0.55)",
    shadowBlur: 0,
    shadowOffsetX: 4,
    shadowOffsetY: 5,
  },
  comicBubble: {
    label: "Comic Bubble",
    fontFamily: "Do Hyeon",
    fontWeight: 400,
    fillColor: "#111111",
    backgroundColor: "#fff176",
    backgroundStrokeColor: "#111111",
    backgroundStrokeWidth: 4,
    backgroundPaddingX: 16,
    backgroundPaddingY: 8,
    backgroundRadius: 12,
    shadowColor: "rgba(0, 0, 0, 0.24)",
    shadowBlur: 0,
    shadowOffsetX: 5,
    shadowOffsetY: 5,
  },
  neonPop: {
    label: "Neon Pop",
    fontFamily: "Black Han Sans",
    fontWeight: 400,
    fillColor: "#b8ff2e",
    strokeColor: "#181728",
    strokeWidth: 5,
    shadowColor: "#00d8ff",
    shadowBlur: 10,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  },
};
const DEFAULT_CANVAS_WIDTH = 1280;
const DEFAULT_CANVAS_HEIGHT = 720;
const DEFAULT_CANVAS_COLOR = "#ffffff";
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
const CANVAS_ALIGNMENTS = new Set([
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
]);
const CANVAS_ALIGNMENT_LABELS = {
  "top-left": "좌측 상단",
  top: "상단 중앙",
  "top-right": "우측 상단",
  left: "좌측 중앙",
  center: "캔버스 중앙",
  right: "우측 중앙",
  "bottom-left": "좌측 하단",
  bottom: "하단 중앙",
  "bottom-right": "우측 하단",
};
const DEFAULT_ANIMATION_IN = "none";
const DEFAULT_ANIMATION_LOOP = "none";
const DEFAULT_ANIMATION_OUT = "none";
const DEFAULT_ANIMATION_SPEED = "normal";
const DEFAULT_ANIMATION_MOVE = "none";
const DEFAULT_ANIMATION_MOVE_EASING = "linear";
const DEFAULT_ANIMATION_MOVE_DURATION = 2;
const ANIMATION_IN_PRESETS = {
  none: { label: "None" },
  fade: { label: "Fade" },
  pop: { label: "Pop" },
  slideUp: { label: "Slide Up" },
};
const ANIMATION_LOOP_PRESETS = {
  none: { label: "None" },
  spin: { label: "Spin" },
  shake: { label: "Shake" },
  pulse: { label: "Pulse" },
  blink: { label: "Blink" },
  float: { label: "Float" },
};
const ANIMATION_OUT_PRESETS = {
  none: { label: "None" },
  fade: { label: "Fade" },
  shrink: { label: "Shrink" },
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
  "저장소를 선택한 뒤 커밋과 파일을 불러오세요.",
  "저장소의 커밋 기록을 불러오세요.",
  "커밋의 변경 파일 목록을 불러오는 중입니다.",
  "이 저장소에서 읽을 커밋을 찾지 못했습니다.",
  "Load Diff를 눌러 선택한 파일의 변경 내용을 불러오세요.",
  "이 커밋에서 변경된 파일을 찾지 못했습니다.",
]);
const SLIDE_KINDS = new Set(["canvas", "gitTyping", "chatTyping"]);

const { drawTextLines, drawGitTypingSlide, renderSlideToDataUrl } = createRenderer({
  TEXT_PADDING_X,
  TEXT_PADDING_Y,
  DEFAULT_TEXT_COLOR,
  getTextPreset,
  getTextRenderStyle,
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
  drawSlideObjectsForExport,
  drawSubtitleBox,
  getSubtitleTextForRender,
});

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
  return TEXT_EFFECT_PRESETS[value] ? value : DEFAULT_TEXT_EFFECT;
}

function sanitizeTextFontWeight(value, fallback = DEFAULT_TEXT_FONT_WEIGHT) {
  return clamp(numberOr(value, fallback), 100, 900);
}

function sanitizeAnimationIn(value) {
  return ANIMATION_IN_PRESETS[value] ? value : DEFAULT_ANIMATION_IN;
}

function sanitizeAnimationLoop(value) {
  return ANIMATION_LOOP_PRESETS[value] ? value : DEFAULT_ANIMATION_LOOP;
}

function sanitizeAnimationOut(value) {
  return ANIMATION_OUT_PRESETS[value] ? value : DEFAULT_ANIMATION_OUT;
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
    config.animationLoop !== DEFAULT_ANIMATION_LOOP ||
    config.animationOut !== DEFAULT_ANIMATION_OUT ||
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
  element.dataset.animationLoop = sanitizeAnimationLoop(data.animationLoop);
  element.dataset.animationOut = sanitizeAnimationOut(data.animationOut);
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
  const preset = TEXT_EFFECT_PRESETS[effectKey] || TEXT_EFFECT_PRESETS.clean;
  return {
    ...preset,
    effectKey,
    fontFamily: sanitizeTextFontFamily(data.fontFamily || preset.fontFamily),
    fontWeight: sanitizeTextFontWeight(data.fontWeight, preset.fontWeight || DEFAULT_TEXT_FONT_WEIGHT),
    fillColor: data.textColor || preset.fillColor || DEFAULT_TEXT_COLOR,
  };
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
    animationIn: element.dataset.animationIn,
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

function getSlideObjectAnimationDuration(slide) {
  return Math.max(0, ...(slide?.objects || []).map(getMoveAnimationDuration));
}

function getCanvasObjectAnimationDuration() {
  return Math.max(0, ...[...canvas.querySelectorAll(".object")].map((element) => getMoveAnimationDuration(getElementAnimationData(element))));
}

function getObjectAnimationState(object, timeSeconds = 0, durationSeconds = VIDEO_EXPORT_FALLBACK_DURATION) {
  const base = {
    x: numberOr(object.x, 0),
    y: numberOr(object.y, 0),
    width: Math.max(1, numberOr(object.width, 1)),
    height: Math.max(1, numberOr(object.height, 1)),
    rotation: numberOr(object.rotation, 0),
    opacity: 1,
    scale: 1,
  };
  if (!canAnimateObjectData(object) || !hasObjectAnimation(object)) {
    return base;
  }

  const config = getObjectAnimationConfig(object);
  const duration = Math.max(0.5, numberOr(durationSeconds, VIDEO_EXPORT_FALLBACK_DURATION));
  const time = clamp(numberOr(timeSeconds, 0), 0, duration);
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

  if (config.animationIn === "fade" && time < 0.45) {
    state.opacity *= clamp(time / 0.45, 0, 1);
  } else if (config.animationIn === "pop" && time < 0.45) {
    const progress = clamp(time / 0.45, 0, 1);
    if (progress < 0.72) {
      state.scale *= 0.82 + easeOutCubic(progress / 0.72) * 0.24;
    } else {
      state.scale *= 1.06 - easeOutCubic((progress - 0.72) / 0.28) * 0.06;
    }
  } else if (config.animationIn === "slideUp" && time < 0.5) {
    state.y += (1 - easeOutCubic(time / 0.5)) * 28;
  }

  const periodFactor = ANIMATION_SPEED_PERIOD_FACTORS[config.animationSpeed] || 1;
  if (config.animationLoop !== "none") {
    const period =
      {
        spin: 4,
        shake: 0.36,
        pulse: 1.2,
        blink: 1,
        float: 2.4,
      }[config.animationLoop] * periodFactor;
    const phase = (time % period) / period;
    const wave = Math.sin(phase * Math.PI * 2);
    if (config.animationLoop === "spin") {
      state.rotation += phase * 360;
    } else if (config.animationLoop === "shake") {
      state.x += wave * 5;
      state.rotation += wave * 1.5;
    } else if (config.animationLoop === "pulse") {
      state.scale *= 1 + ((1 - Math.cos(phase * Math.PI * 2)) / 2) * 0.08;
    } else if (config.animationLoop === "blink") {
      state.opacity *= 0.625 + Math.cos(phase * Math.PI * 2) * 0.375;
    } else if (config.animationLoop === "float") {
      state.y += wave * 8;
    }
  }

  const outDuration = 0.45;
  if (time > duration - outDuration) {
    const progress = clamp((time - (duration - outDuration)) / outDuration, 0, 1);
    if (config.animationOut === "fade") {
      state.opacity *= 1 - progress;
    } else if (config.animationOut === "shrink") {
      state.opacity *= 1 - progress;
      state.scale *= 1 - progress * 0.15;
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
  const xSnap = findSnapDelta(xMarkers, [0, canvasWidth / 2, canvasWidth], threshold);
  const ySnap = findSnapDelta(yMarkers, [0, canvasHeight / 2, canvasHeight], threshold);

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
  const duration = Math.max(VIDEO_EXPORT_FALLBACK_DURATION, getCanvasObjectAnimationDuration());
  const time = ((timestamp - objectAnimationPreviewStart) / 1000) % duration;
  updateObjectAnimationPreview(time, duration);
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
  selectedPanel.classList.toggle("is-empty", !hasSelection);
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
  for (const button of canvasAlignButtons) {
    button.disabled = !hasSelection;
  }
  for (const button of textSizeButtons) {
    button.disabled = !hasTextSelection;
  }
  for (const button of textStyleButtons) {
    button.disabled = !hasTextSelection;
  }
  for (const button of textAlignButtons) {
    button.disabled = !hasTextSelection;
  }
  for (const button of [...animationInButtons, ...animationLoopButtons, ...animationOutButtons, ...animationSpeedButtons]) {
    button.disabled = !hasAnimationSelection;
  }
  for (const button of [...animationMoveButtons, ...animationMoveEasingButtons, ...animationMovePointButtons]) {
    button.disabled = !hasAnimationSelection;
  }
  for (const input of [selectedMoveFromX, selectedMoveFromY, selectedMoveToX, selectedMoveToY, selectedMoveDuration]) {
    input.disabled = !hasAnimationSelection;
  }
  duplicateSelected.disabled = !hasSelection;
  selectedTextColor.disabled = !hasTextSelection;
  editSelectedText.disabled = !hasTextSelection;
  setButtonLabel(editSelectedText, activeTextEditObject === selectedObject ? "Done" : "Edit Text");
  deleteSelected.disabled = !hasSelection;

  if (!selectedObject) {
    selectedX.value = "";
    selectedY.value = "";
    selectedW.value = "";
    selectedH.value = "";
    selectedR.value = "";
    setActiveTextSizeButton("h3");
    setActiveTextStyleButton(DEFAULT_TEXT_EFFECT);
    setActiveTextAlignButton("left");
    syncAnimationButtons({
      animationIn: DEFAULT_ANIMATION_IN,
      animationLoop: DEFAULT_ANIMATION_LOOP,
      animationOut: DEFAULT_ANIMATION_OUT,
      animationSpeed: DEFAULT_ANIMATION_SPEED,
      animationMove: DEFAULT_ANIMATION_MOVE,
      animationMoveEasing: DEFAULT_ANIMATION_MOVE_EASING,
    });
    selectedMoveFromX.value = "";
    selectedMoveFromY.value = "";
    selectedMoveToX.value = "";
    selectedMoveToY.value = "";
    selectedMoveDuration.value = "";
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
  setActiveTextStyleButton(selectedObject.dataset.textEffect || DEFAULT_TEXT_EFFECT);
  setActiveTextAlignButton(selectedObject.dataset.textAlign || "left");
  const animationData = getElementAnimationData(selectedObject);
  const hasMoveAnimation = sanitizeAnimationMove(animationData.animationMove) === "move";
  syncAnimationButtons(animationData);
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
  setActiveAnimationButtons(animationOutButtons, "animationOut", sanitizeAnimationOut(config?.animationOut));
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
  setStatus("이미지를 붙여넣었습니다. 모서리 핸들로 크기 조절, 위쪽 핸들로 회전할 수 있습니다.");
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
      reject(new Error("이미지를 읽지 못했습니다."));
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
  const record = await saveActiveNativeProject();
  if (!record?.meta?.id) {
    throw new Error("이미지를 저장할 프로젝트를 만들지 못했습니다.");
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
  drawTextLines(context, text, width, height, true, element.dataset.textSize || "h3", element.dataset.textAlign || "left", {
    fontFamily: element.dataset.fontFamily,
    fontWeight: element.dataset.fontWeight,
    textEffect: element.dataset.textEffect,
    textColor: element.dataset.textColor,
  });
  delete context.__textColor;
}

function getTextContentHeight(element) {
  const state = getState(element);
  const preset = getTextPreset(element);
  const renderStyle = getTextRenderStyle({
    fontFamily: element.dataset.fontFamily,
    fontWeight: element.dataset.fontWeight,
    textEffect: element.dataset.textEffect,
    textColor: element.dataset.textColor,
  });
  textMeasureContext.font = `${renderStyle.fontWeight} ${preset.fontSize}px ${quoteFontFamily(renderStyle.fontFamily)}`;
  const lines = wrapTextLines(textMeasureContext, element.dataset.text || "", state.width);
  const backgroundPadding = renderStyle.backgroundColor ? (renderStyle.backgroundPaddingY || 6) * 2 : 0;
  return Math.max(16, Math.ceil(lines.length * preset.lineHeight + TEXT_PADDING_Y * 2 + backgroundPadding));
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
    setStatus("현재 데스크톱 환경에서 이미지 클립보드 읽기를 사용할 수 없습니다. Cmd+V로 붙여넣어 주세요.");
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

async function loadImageBlob(blob, name = "clipboard-image") {
  if (!blob) {
    setStatus("이미지를 읽지 못했습니다.");
    return;
  }

  setStatus("이미지를 최적화해 프로젝트 asset으로 저장하고 있습니다.");
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
    setStatus(`${isAnimatedGifSource(path) ? "GIF" : "이미지"}를 프로젝트 asset으로 저장하고 있습니다.`);
    await importImageFileAsset(path);
  } catch (error) {
    setStatus(error?.message || "이미지 파일을 추가하지 못했습니다.");
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

function getSubtitleLayout(context, text, width, height, options = {}) {
  const cleanText = String(text || "").trim();
  if (!cleanText) {
    return null;
  }

  const subtitleSize = normalizeSubtitleSize(options.subtitleSize);
  const subtitleY = normalizeSubtitleY(options.subtitleY);
  const baseFontSize = clamp(Math.round(width * 0.032), 22, 34);
  const fontSize = clamp(Math.round(baseFontSize * (subtitleSize / 100)), 14, 72);
  const lineHeight = Math.round(fontSize * 1.24);
  const paddingX = Math.round(fontSize * 0.45);
  const paddingY = Math.round(fontSize * 0.22);
  const maxTextWidth = Math.round(width * 0.78);

  context.save();
  context.font = `700 ${fontSize}px "Pretendard"`;
  const lines = trimSubtitleLines(wrapTextLines(context, cleanText, maxTextWidth + TEXT_PADDING_X * 2), SUBTITLE_MAX_LINES);
  const measuredWidth = Math.min(maxTextWidth, Math.max(...lines.map((line) => context.measureText(line).width)));
  context.restore();
  const boxWidth = Math.min(width - 48, Math.ceil(measuredWidth + paddingX * 2));
  const boxHeight = Math.ceil(lines.length * lineHeight + paddingY * 2);
  const boxX = (width - boxWidth) / 2;
  const verticalMargin = Math.round(height * 0.02);
  const targetCenterY = (height * subtitleY) / 100;
  const maxBoxY = Math.max(verticalMargin, height - boxHeight - verticalMargin);
  const boxY = clamp(targetCenterY - boxHeight / 2, verticalMargin, maxBoxY);
  const bottomOffset = Math.max(0, height - boxY - boxHeight);
  return { fontSize, lineHeight, paddingY, lines, boxWidth, boxHeight, boxX, boxY, bottomOffset, subtitleY };
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

  const { fontSize, lineHeight, paddingY, lines, boxWidth, boxHeight, boxX, boxY } = layout;
  context.save();
  context.fillStyle = "rgba(0, 0, 0, 0.8)";
  fillRoundedRect(context, boxX, boxY, boxWidth, boxHeight, 6);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.font = `700 ${fontSize}px "Pretendard"`;
  for (const [index, line] of lines.entries()) {
    context.fillText(line, width / 2, boxY + paddingY + index * lineHeight);
  }
  context.restore();
}

function splitNotesForExport(notes) {
  const cleanText = String(notes || "").replace(/\r\n/g, "\n").trim();
  if (!cleanText) {
    return [];
  }
  return cleanText
    .split(/\n\s*\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function estimateNoteSegmentDuration(notes) {
  const text = String(notes || "").trim();
  if (!text) {
    return VIDEO_EXPORT_FALLBACK_DURATION;
  }
  const characterCount = text.replace(/\s+/g, "").length;
  return clamp(characterCount / 7 + 1.2, VIDEO_EXPORT_FALLBACK_DURATION, DYNAMIC_MAX_DURATION);
}

function getSlideVisualTimelineDuration(slide) {
  return Math.max(isDynamicSlide(slide) ? getDynamicSlideDuration(slide) : 0, getSlideObjectAnimationDuration(slide));
}

function getSlideExportTimelinePlan(slide, noteSegments) {
  const segmentDurations = noteSegments.map(estimateNoteSegmentDuration);
  const hasTtsNotes = noteSegments.some((segment) => Boolean(String(segment || "").trim()));
  const visualDuration = getSlideVisualTimelineDuration(slide);
  const shouldExtendToVisual = !hasTtsNotes || (isDynamicSlide(slide) && normalizeContinueAfterTts(slide.continueAfterTts));
  const estimatedAudioDuration = segmentDurations.reduce((total, duration) => total + duration, 0);
  if (segmentDurations.length > 0 && shouldExtendToVisual && estimatedAudioDuration < visualDuration) {
    segmentDurations[segmentDurations.length - 1] += visualDuration - estimatedAudioDuration;
  }

  let offset = 0;
  const segmentOffsets = segmentDurations.map((duration) => {
    const currentOffset = offset;
    offset += duration;
    return currentOffset;
  });
  return {
    segmentDurations,
    segmentOffsets,
    duration: Math.max(VIDEO_EXPORT_FALLBACK_DURATION, offset, visualDuration),
  };
}

function getSubtitleTextForRender(slide, options = {}) {
  return typeof options.subtitleText === "string" ? options.subtitleText : slide.notes;
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
      context.globalAlpha *= renderState.opacity;
      context.translate(center.x, center.y);
      context.rotate((renderState.rotation * Math.PI) / 180);
      context.scale(renderState.scale, renderState.scale);
      context.translate(-renderState.width / 2, -renderState.height / 2);

      if (object.type === "image") {
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
          object
        );
        delete context.__textColor;
      } else if (object.type === "shape") {
        drawShapeData(context, object, renderState.width, renderState.height);
      }
    } finally {
      delete context.__textColor;
      context.restore();
    }
  }
}

async function renderDynamicSlideToDataUrl(slide, timeSeconds, options = {}) {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = Math.max(1, roundedCanvasSize(slide.width));
  exportCanvas.height = Math.max(1, roundedCanvasSize(slide.height));
  const context = exportCanvas.getContext("2d");
  drawDynamicSlide(context, slide, exportCanvas.width, exportCanvas.height, timeSeconds, {
    ...options,
    subtitles: false,
    reserveSubtitles: options.subtitles,
  });
  const defaultObjectTimelineDuration = Math.max(getDynamicSlideDuration(slide), getSlideObjectAnimationDuration(slide));
  await drawSlideObjectsForExport(context, slide.objects || [], {
    ...options,
    timeSeconds,
    durationSeconds: Math.max(
      defaultObjectTimelineDuration,
      numberOr(options.objectTimelineDurationSeconds, defaultObjectTimelineDuration)
    ),
  });
  if (options.subtitles) {
    drawSubtitleBox(context, getSubtitleTextForRender(slide, options), exportCanvas.width, exportCanvas.height, options);
  }
  return exportCanvas.toDataURL("image/png");
}

async function renderDynamicSlideFrames(slide, options = {}) {
  const defaultDuration = Math.max(getDynamicSlideDuration(slide), getSlideObjectAnimationDuration(slide));
  const duration = Math.max(0.5, numberOr(options.segmentDurationSeconds, defaultDuration));
  const timelineOffset = Math.max(0, numberOr(options.timelineOffsetSeconds, 0));
  const objectTimelineDuration = Math.max(defaultDuration, timelineOffset + duration, numberOr(options.objectTimelineDurationSeconds, defaultDuration));
  const frameRate = DYNAMIC_FRAME_RATE;
  const frameCount = Math.max(2, Math.ceil(duration * frameRate));
  const frames = [];
  const imageCache = new Map();
  for (let index = 0; index < frameCount; index += 1) {
    throwIfExportCancelled();
    if (index % frameRate === 0) {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    }
    const timeSeconds = timelineOffset + Math.min(duration, index / frameRate);
    frames.push(
      await renderDynamicSlideToDataUrl(slide, timeSeconds, {
        ...options,
        imageCache,
        objectTimelineDurationSeconds: objectTimelineDuration,
      })
    );
  }
  frames.push(
    await renderDynamicSlideToDataUrl(slide, timelineOffset + duration, {
      ...options,
      imageCache,
      objectTimelineDurationSeconds: objectTimelineDuration,
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
  const duration = Math.max(0.5, numberOr(options.segmentDurationSeconds, numberOr(options.durationSeconds, VIDEO_EXPORT_FALLBACK_DURATION)));
  const timelineOffset = Math.max(0, numberOr(options.timelineOffsetSeconds, 0));
  const timelineDuration = Math.max(duration + timelineOffset, numberOr(options.durationSeconds, duration));
  const frameRate = VIDEO_EXPORT_FPS;
  const frameCount = Math.max(2, Math.ceil(duration * frameRate));
  const frames = [];
  const imageCache = new Map();
  for (let index = 0; index < frameCount; index += 1) {
    throwIfExportCancelled();
    if (index % frameRate === 0) {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    }
    const timeSeconds = timelineOffset + Math.min(duration, index / frameRate);
    frames.push(
      await renderSlideToDataUrl(slide, {
        ...options,
        imageCache,
        timeSeconds,
        durationSeconds: timelineDuration,
      })
    );
  }
  frames.push(
    await renderSlideToDataUrl(slide, {
      ...options,
      imageCache,
      timeSeconds: timelineOffset + duration,
      durationSeconds: timelineDuration,
    })
  );
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
    image.onerror = () => reject(new Error("이미지를 렌더링하지 못했습니다."));
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
      ? "Git 변경 내용을 코드 에디터에서 수정하는 장면처럼 보여줍니다."
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
    slideVideoInfo.textContent = "No video selected";
    slideVideoInfo.title = "";
    clearSlideVideo.disabled = true;
    return;
  }

  const assetUrl = nativeApi.toAssetUrl(video.path);
  if (slideVideo.dataset.path !== video.path) {
    slideVideo.src = assetUrl;
    slideVideo.dataset.path = video.path;
    slideVideo.load();
  }
  slideVideo.hidden = false;
  slideVideo.muted = true;
  slideVideo.loop = true;
  slideVideo.play().catch(() => {});
  slideVideoInfo.textContent = video.name;
  slideVideoInfo.title = video.name;
  clearSlideVideo.disabled = false;
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
  selectedPanel.hidden = false;
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
  if (normalizeSlideVideo(slide.video)) {
    context.fillStyle = "#000000";
    context.fillRect(0, 0, slide.width, slide.height);
    context.fillStyle = "rgba(255, 255, 255, 0.82)";
    context.font = '700 42px "Pretendard"';
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
  syncObjectAnimationPreview();
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

function getCanvasAlignmentTarget(bounds, alignment) {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const canvasWidth = canvas.offsetWidth;
  const canvasHeight = canvas.offsetHeight;
  let left = bounds.left;
  let top = bounds.top;

  if (alignment.endsWith("left") || alignment === "left") {
    left = 0;
  } else if (alignment.endsWith("right") || alignment === "right") {
    left = canvasWidth - width;
  } else {
    left = (canvasWidth - width) / 2;
  }

  if (alignment.startsWith("top") || alignment === "top") {
    top = 0;
  } else if (alignment.startsWith("bottom") || alignment === "bottom") {
    top = canvasHeight - height;
  } else {
    top = (canvasHeight - height) / 2;
  }

  return { left, top };
}

function alignSelectedToCanvas(alignment) {
  if (!CANVAS_ALIGNMENTS.has(alignment) || selectedObjects.length === 0) {
    return false;
  }

  for (const object of selectedObjects) {
    syncTextEditorValue(object);
  }

  const bounds = getSelectedBounds();
  if (!bounds) {
    return false;
  }

  const target = getCanvasAlignmentTarget(bounds, alignment);
  const deltaX = target.left - bounds.left;
  const deltaY = target.top - bounds.top;
  if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) {
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
  setStatus(`${selectedObjects.length}개 오브젝트를 ${CANVAS_ALIGNMENT_LABELS[alignment]}에 맞췄습니다.`);
  recordHistory();
  return true;
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
  setStatus(`${imageObjects.length}개 이미지가 ${axis === "x" ? "좌우" : "상하"} 반전되었습니다.`);
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

async function saveActiveNativeProject(options = {}) {
  if (isLoadingNativeProject) {
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

function isInteractiveChangeInProgress() {
  return Boolean(activePointer || activeShapeDraft || slideDragState);
}

function scheduleNativeProjectSave() {
  if (isLoadingNativeProject) {
    return;
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
  if (activeProjectId) {
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
  if (!window.confirm("이 프로젝트를 삭제할까요?")) {
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
  setButtonLabel(saveProject, "Export Project");
  setButtonLabel(openProject, "Import Project");
  await refreshNativeProjectList();
  if (nativeProjects.length === 0) {
    await createNewNativeProject({ silent: true });
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

async function saveProjectInternally() {
  await saveActiveNativeProject({ showStatus: true });
}

async function exportProjectFile() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const project = createProjectData();
  const baseName = getProjectName().replace(/[\\/:*?"<>|]/g, "-") || "slide-cut";
  const savedPath = await nativeApi.exportProjectFile(`${baseName}-${timestamp}.slidecut`, project);
  if (savedPath) {
    setSaveState("Exported");
    setStatus("선택한 경로에 asset 포함 프로젝트 패키지를 저장했습니다.");
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
    await saveActiveNativeProject({ showStatus: true });
  } catch (error) {
    setStatus(error?.message || "프로젝트 파일을 가져오지 못했습니다.");
  }
}

async function chooseVideoForCurrentSlide() {
  if (isDynamicSlide(slides[activeSlideIndex])) {
    setStatus("영상 소스는 일반 슬라이드에서만 사용할 수 있습니다.");
    return;
  }

  try {
    const path = await nativeApi.selectVideoFile();
    if (!path || !slides[activeSlideIndex]) {
      return;
    }
    if (!activeProjectId) {
      await saveActiveNativeProject();
    }
    const importedAsset = activeProjectId
      ? await nativeApi.importProjectAsset(activeProjectId, path)
      : { path, name: getFileNameFromPath(path) };
    slides[activeSlideIndex].video = {
      path: importedAsset.path,
      name: importedAsset.name || getFileNameFromPath(path),
      fit: "fill",
    };
    updateSlideVideoView();
    renderSlideList();
    setStatus("배경 영상을 프로젝트에 복사해 연결했습니다.");
    recordHistory();
  } catch (error) {
    setStatus(error?.message || "영상 파일을 프로젝트에 복사하지 못했습니다.");
  }
}

function clearVideoForCurrentSlide() {
  if (!slides[activeSlideIndex]) {
    return;
  }
  slides[activeSlideIndex].video = null;
  updateSlideVideoView();
  renderSlideList();
  setStatus("배경 영상을 제거했습니다.");
  recordHistory();
}

async function chooseSoundForCurrentSlide() {
  try {
    const path = await nativeApi.selectAudioFile();
    if (!path || !slides[activeSlideIndex]) {
      return;
    }
    if (!activeProjectId) {
      await saveActiveNativeProject();
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
    setStatus("슬라이드 시작 효과음을 프로젝트에 복사해 연결했습니다.");
    recordHistory();
  } catch (error) {
    setStatus(error?.message || "효과음 파일을 프로젝트에 복사하지 못했습니다.");
  }
}

function clearSoundForCurrentSlide() {
  if (!slides[activeSlideIndex]) {
    return;
  }
  slides[activeSlideIndex].startSound = null;
  updateSlideSoundView();
  renderSlideList();
  setStatus("슬라이드 시작 효과음을 제거했습니다.");
  recordHistory();
}

async function chooseBackgroundMusicForProject() {
  try {
    const path = await nativeApi.selectAudioFile();
    if (!path) {
      return;
    }
    if (!activeProjectId) {
      await saveActiveNativeProject();
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
    setStatus("프로젝트 배경음을 프로젝트에 복사해 연결했습니다.");
    scheduleNativeProjectSave();
  } catch (error) {
    setStatus(error?.message || "배경음 파일을 프로젝트에 복사하지 못했습니다.");
  }
}

function clearBackgroundMusicForProject() {
  projectSettingsState = normalizeProjectSettings({
    ...projectSettingsState,
    backgroundMusic: null,
  });
  updateBackgroundMusicView();
  setStatus("프로젝트 배경음을 제거했습니다.");
  scheduleNativeProjectSave();
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

  const currentSlide = slides[activeSlideIndex];
  if (projectSettingsState.subtitleEnabled && currentSlide) {
    drawSubtitleBox(context, getSubtitleTextForRender(currentSlide, {}), exportCanvas.width, exportCanvas.height, {
      subtitleSize: projectSettingsState.subtitleSize,
      subtitleY: projectSettingsState.subtitleY,
    });
  }

  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  link.download = `slide-cut-${timestamp}.png`;
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
  setStatus("PNG를 내보냈습니다.");
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
  translateSlideButton.title = isBlockedSlide ? "Git/GPT 슬라이드는 번역 대상이 아닙니다." : "";
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
    setStatus("Git/GPT 슬라이드는 번역 대상이 아닙니다.");
    return;
  }

  const sourceLanguage = slideTranslateSource.value;
  const targetLanguage = slideTranslateTarget.value;
  if (!sourceLanguage || !targetLanguage) {
    setStatus("현재 언어와 타겟 언어를 선택해 주세요.");
    return;
  }
  if (sourceLanguage === targetLanguage) {
    setStatus("현재 언어와 타겟 언어가 같습니다.");
    return;
  }

  const items = collectActiveSlideTranslationItems();
  if (items.length === 0) {
    setStatus("현재 슬라이드에 번역할 텍스트나 노트가 없습니다.");
    return;
  }

  isTranslatingSlide = true;
  syncSlideTranslationControls();
  setStatus("현재 슬라이드를 번역하는 중입니다.");
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
        ? `현재 슬라이드를 ${selectedOptionLabel(slideTranslateTarget)}로 번역했습니다.`
        : "번역 결과가 기존 내용과 같습니다."
    );
  } catch (error) {
    console.error("Slide translation failed", error);
    setStatus(formatErrorMessage(error, "슬라이드 번역에 실패했습니다."));
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
  settingsExportDir.value = projectSettingsState.exportDir;
  updateBackgroundMusicView();
  syncColorPresetButtons();
}

function getProjectSettingsFromControls() {
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
    setStatus("설정을 저장했습니다. API Key는 앱 전역, 나머지는 현재 프로젝트에 저장됩니다.");
    hideAppSettings();
  } catch (error) {
    setStatus(error?.message || "설정 저장에 실패했습니다.");
  }
}

function showAppSettings() {
  syncSettingsControls();
  appSettings.hidden = false;
}

function hideAppSettings() {
  appSettings.hidden = true;
}

async function chooseProjectExportDirectory() {
  try {
    const path = await nativeApi.selectDirectory();
    if (path) {
      settingsExportDir.value = path;
      setStatus("영상 내보내기 폴더를 선택했습니다. 설정을 저장하면 적용됩니다.");
    }
  } catch (error) {
    setStatus(error?.message || "영상 내보내기 폴더를 선택하지 못했습니다.");
  }
}

async function resetProjectExportDirectory() {
  try {
    settingsExportDir.value = defaultProjectExportDir;
    setStatus("영상 내보내기 폴더를 Downloads로 되돌렸습니다. 설정을 저장하면 적용됩니다.");
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
    setStatus(files.length ? "변경 파일 목록을 불러왔습니다." : "이 커밋에서 변경된 파일을 찾지 못했습니다.");
  } catch (error) {
    setStatus(error?.message || "Git 변경 파일 목록을 읽지 못했습니다.");
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
        title: result.title || "Git Diff",
        content: result.afterContent || result.beforeContent || result.content || "",
        beforeContent: result.beforeContent || "",
        afterContent: result.afterContent || result.content || "",
        beforePath: result.beforePath || "",
      };
    }, { record: options.record !== false });
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
    throw new Error("영상 내보내기를 취소했습니다.");
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
        progress.message || "영상 파일을 생성하고 있습니다.",
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
  setExportModalProgress("Cancelling", "영상 내보내기를 취소하는 중입니다.", 1, 1);
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
    setStatus(error?.message || "영상 저장 경로를 선택하지 못했습니다.");
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
      setExportModalProgress("Rendering", `슬라이드 ${index + 1} / ${slides.length} 렌더링 중입니다.`, index, slides.length);
      const noteSegments = splitNotesForExport(slide.notes);
      const exportNoteSegments = noteSegments.length ? noteSegments : [""];
      const timelinePlan = getSlideExportTimelinePlan(slide, exportNoteSegments);
      const gifOverlays = getAnimatedGifOverlays(slide);
      const baseSlidePayload = {
        index,
        width: roundedCanvasSize(slide.width),
        height: roundedCanvasSize(slide.height),
        color: sanitizeColor(slide.color, "#ffffff"),
        videoPath: video?.path || null,
      };
      if (isDynamicSlide(slide)) {
        setExportModalProgress("Rendering", `슬라이드 ${index + 1} / ${slides.length} 타이핑 프레임을 만들고 있습니다.`, index, slides.length);
        const continueAfterTts = normalizeContinueAfterTts(slide.continueAfterTts);
        for (const [segmentIndex, segmentNotes] of exportNoteSegments.entries()) {
          const hasTtsNotes = Boolean(segmentNotes?.trim());
          const animation = await renderDynamicSlideFrames(slide, {
            excludeAnimatedGifs: gifOverlays.length > 0,
            subtitles: projectSettingsState.subtitleEnabled,
            subtitleText: segmentNotes,
            subtitleSize: projectSettingsState.subtitleSize,
            subtitleY: projectSettingsState.subtitleY,
            segmentDurationSeconds: timelinePlan.segmentDurations[segmentIndex],
            timelineOffsetSeconds: timelinePlan.segmentOffsets[segmentIndex],
            objectTimelineDurationSeconds: timelinePlan.duration,
          });
          renderedSlides.push({
            ...baseSlidePayload,
            notes: segmentNotes,
            startSoundPath: segmentIndex === 0 ? startSound?.path || null : null,
            endOnTtsEnd: hasTtsNotes ? !continueAfterTts : false,
            fitAnimationToDuration: false,
            framePng: animation.framePng,
            animationFrames: animation.frames,
            frameRate: animation.frameRate,
            animationDurationSeconds: animation.duration,
            ...(gifOverlays.length ? { gifOverlays } : {}),
          });
        }
      } else {
        for (const [segmentIndex, segmentNotes] of exportNoteSegments.entries()) {
          const hasTtsNotes = Boolean(segmentNotes?.trim());
          const renderOptions = {
            transparentBackground: Boolean(video),
            excludeAnimatedGifs: gifOverlays.length > 0,
            subtitles: projectSettingsState.subtitleEnabled,
            subtitleText: segmentNotes,
            subtitleSize: projectSettingsState.subtitleSize,
            subtitleY: projectSettingsState.subtitleY,
          };
          if (slideHasObjectAnimations(slide)) {
            const animation = await renderCanvasSlideAnimationFrames(slide, {
              ...renderOptions,
              segmentDurationSeconds: timelinePlan.segmentDurations[segmentIndex],
              timelineOffsetSeconds: timelinePlan.segmentOffsets[segmentIndex],
              durationSeconds: timelinePlan.duration,
            });
            renderedSlides.push({
              ...baseSlidePayload,
              notes: segmentNotes,
              startSoundPath: segmentIndex === 0 ? startSound?.path || null : null,
              ...(gifOverlays.length ? { gifOverlays } : {}),
              framePng: animation.framePng,
              animationFrames: animation.frames,
              frameRate: animation.frameRate,
              animationDurationSeconds: animation.duration,
              fitAnimationToDuration: false,
              animationAffectsDuration: !hasTtsNotes,
            });
          } else {
            renderedSlides.push({
              ...baseSlidePayload,
              notes: segmentNotes,
              startSoundPath: segmentIndex === 0 ? startSound?.path || null : null,
              ...(gifOverlays.length
                ? {
                    gifOverlays,
                    animationAffectsDuration: false,
                  }
                : {}),
              framePng: await renderSlideToDataUrl(slide, renderOptions),
            });
          }
        }
      }
    }

    throwIfExportCancelled();
    setExportModalProgress("Encoding", "음성과 영상 세그먼트를 생성하고 있습니다.", 0, 1);
    const result = await nativeApi.exportVideo({
      exportId,
      outputPath,
      fps: VIDEO_EXPORT_FPS,
      fallbackDurationSeconds: VIDEO_EXPORT_FALLBACK_DURATION,
      backgroundMusicPath: backgroundMusic?.path || null,
      tts: getTtsSettings(),
      slides: renderedSlides,
    });
    setExportModalProgress("Complete", "영상 내보내기가 완료되었습니다.", 1, 1);
    setStatus(`영상을 내보냈습니다: ${result?.outputPath || outputPath}`);
  } catch (error) {
    const message = error?.message || String(error) || "영상 내보내기에 실패했습니다.";
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
    loadImageBlob(file, file?.name || "clipboard-image").catch(() => setStatus("이미지를 읽지 못했습니다."));
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
  const previousState = getState(selectedObject);
  applyState(selectedObject, {
    x: numberOr(selectedX.value, 0),
    y: numberOr(selectedY.value, 0),
    width: numberOr(selectedW.value, 8),
    height: numberOr(selectedH.value, 8),
    rotation: numberOr(selectedR.value, 0),
  });
  fitTextBoxToContentAfterWidthChange(selectedObject, previousState.width);
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
  setStatus(`텍스트 크기를 ${sizeKey.toUpperCase()}로 변경했습니다.`);
  renderSlideList();
  recordHistory();
}

function applySelectedTextStyleChange(effectKey) {
  if (!selectedObject || selectedObject.dataset.type !== "text") {
    return;
  }
  const safeEffect = sanitizeTextEffect(effectKey);
  const preset = TEXT_EFFECT_PRESETS[safeEffect] || TEXT_EFFECT_PRESETS.clean;
  selectedObject.dataset.textEffect = safeEffect;
  selectedObject.dataset.fontFamily = sanitizeTextFontFamily(preset.fontFamily);
  selectedObject.dataset.fontWeight = String(sanitizeTextFontWeight(preset.fontWeight));
  if (preset.fillColor) {
    selectedObject.dataset.textColor = preset.fillColor;
    selectedTextColor.value = preset.fillColor;
  }
  setActiveTextStyleButton(safeEffect);
  const editor = selectedObject.querySelector(".text-editor");
  editor.style.fontFamily = quoteFontFamily(sanitizeTextFontFamily(selectedObject.dataset.fontFamily));
  editor.style.fontWeight = selectedObject.dataset.fontWeight;
  editor.style.color = selectedObject.dataset.textColor || DEFAULT_TEXT_COLOR;
  if (!fitTextBoxToContent(selectedObject)) {
    renderTextObject(selectedObject);
  }
  setStatus(`텍스트 스타일을 ${preset.label || safeEffect}로 변경했습니다.`);
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

function applySelectedAnimationChange(kind, value) {
  const field =
    {
      in: "animationIn",
      loop: "animationLoop",
      out: "animationOut",
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
        : field === "animationOut"
          ? sanitizeAnimationOut(value)
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
  setStatus(`${targets.length || 1}개 오브젝트의 애니메이션을 변경했습니다.`);
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
    setStatus("Move 애니메이션 좌표를 변경했습니다.");
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
  setStatus(`${preset.canvasColor === "#000000" ? "검정 배경 / 흰색 글씨" : "흰색 배경 / 검정 글씨"} 기본값을 선택했습니다. 설정을 저장하면 적용됩니다.`);
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
for (const button of canvasAlignButtons) {
  button.addEventListener("click", () => alignSelectedToCanvas(button.dataset.canvasAlign));
}
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

pasteImage.addEventListener("click", pasteImageFromClipboard);
chooseImage.addEventListener("click", chooseImageFileForCurrentSlide);
addTextBox.addEventListener("click", () => {
  addTextObject("텍스트", "텍스트 상자를 만들었습니다. 바로 입력해서 내용을 바꿀 수 있습니다.");
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
  setStatus(dynamicContinueAfterTts.checked ? "TTS 이후에도 슬라이드가 이어집니다." : "TTS 종료 시 다음 슬라이드로 넘어갑니다.");
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
for (const button of animationOutButtons) {
  button.addEventListener("click", () => applySelectedAnimationChange("out", button.dataset.animationOut));
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

async function initializeApp() {
  try {
    await loadAppSettings();
  } catch (error) {
    setStatus(error?.message || "앱 설정을 불러오지 못했습니다.");
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
    setStatus(error?.message || "프로젝트 목록을 초기화하지 못했습니다.");
  }

  hydrateButtonIcons();
}

initializeApp();
