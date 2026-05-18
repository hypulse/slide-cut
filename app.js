const canvas = document.querySelector("#canvas");
const slideNotes = document.querySelector("#slideNotes");
const imageTemplate = document.querySelector("#imageTemplate");
const textTemplate = document.querySelector("#textTemplate");
const shapeTemplate = document.querySelector("#shapeTemplate");
const statusText = document.querySelector("#statusText");
const tauriInvoke = window.__TAURI__?.core?.invoke || null;
const tauriDialog = window.__TAURI__?.dialog || null;
const PROJECT_FILE_FILTER = [{ name: "Simple Slide Project", extensions: ["json"] }];
const nativeApi = window.simpleSlideNative || (tauriInvoke ? {
  isNative: true,
  platform: window.__TAURI__?.os?.platform?.() || navigator.platform || "",
  listProjects: () => tauriInvoke("list_projects"),
  saveProject: (payload) => tauriInvoke("save_project", { payload }),
  loadProject: (id) => tauriInvoke("load_project", { id }),
  renameProject: (payload) => tauriInvoke("rename_project", { payload }),
  duplicateProject: (id) => tauriInvoke("duplicate_project", { id }),
  deleteProject: (id) => tauriInvoke("delete_project", { id }),
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
} : null);

const projectNameInput = document.querySelector("#projectNameInput");
const newProject = document.querySelector("#newProject");
const projectLibraryButton = document.querySelector("#projectLibraryButton");
const nativeDivider = document.querySelector(".native-divider");
const canvasWidth = document.querySelector("#canvasWidth");
const canvasHeight = document.querySelector("#canvasHeight");
const canvasColor = document.querySelector("#canvasColor");
const applyCanvas = document.querySelector("#applyCanvas");
const colorPresetButtons = [...document.querySelectorAll("[data-color-preset]")];
const pasteImage = document.querySelector("#pasteImage");
const addTextBox = document.querySelector("#addTextBox");
const savePng = document.querySelector("#savePng");
const saveProject = document.querySelector("#saveProject");
const openProject = document.querySelector("#openProject");
const projectFileInput = document.querySelector("#projectFileInput");
const addSlide = document.querySelector("#addSlide");
const duplicateSlide = document.querySelector("#duplicateSlide");
const slideList = document.querySelector("#slideList");
const drawToolButtons = [...document.querySelectorAll("[data-draw-tool]")];
const strokeColor = document.querySelector("#strokeColor");
const strokeWidth = document.querySelector("#strokeWidth");

const selectedPanel = document.querySelector(".selected-panel");
const selectedX = document.querySelector("#selectedX");
const selectedY = document.querySelector("#selectedY");
const selectedW = document.querySelector("#selectedW");
const selectedH = document.querySelector("#selectedH");
const selectedR = document.querySelector("#selectedR");
const selectedTextSize = document.querySelector("#selectedTextSize");
const textSizeButtons = [...document.querySelectorAll("[data-text-size]")];
const selectedTextColor = document.querySelector("#selectedTextColor");
const duplicateSelected = document.querySelector("#duplicateSelected");
const editSelectedText = document.querySelector("#editSelectedText");
const deleteSelected = document.querySelector("#deleteSelected");
const alignButtons = [...document.querySelectorAll("[data-align]")];
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
const textMeasureCanvas = document.createElement("canvas");
const textMeasureContext = textMeasureCanvas.getContext("2d");
let canvasViewScale = 1;

const TEXT_PADDING_X = 10;
const TEXT_PADDING_Y = 8;
const TEXT_SIZE_PRESETS = {
  h4: { fontSize: 20, lineHeight: 25 },
  h3: { fontSize: 28, lineHeight: 35 },
  h2: { fontSize: 40, lineHeight: 50 },
  h1: { fontSize: 56, lineHeight: 70 },
};
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
const PROJECT_VERSION = 1;
const HISTORY_LIMIT = 80;
const IS_MAC_PLATFORM = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "");

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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  for (const button of alignButtons) {
    button.disabled = selectedObjects.length < 2;
  }
  for (const button of Object.values(arrangeButtons)) {
    button.disabled = !hasSelection;
  }
  for (const button of textSizeButtons) {
    button.disabled = !hasTextSelection;
  }
  duplicateSelected.disabled = !hasSelection;
  selectedTextColor.disabled = !hasTextSelection;
  editSelectedText.disabled = !hasTextSelection;
  deleteSelected.disabled = !hasSelection;

  if (!selectedObject) {
    selectedX.value = "";
    selectedY.value = "";
    selectedW.value = "";
    selectedH.value = "";
    selectedR.value = "";
    setActiveTextSizeButton("h3");
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
  drawTextLines(context, text, width, height, true, element.dataset.textSize || "h3");
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
    element.dataset.text = editor.value;
    if (!growTextBoxToContent(element)) {
      renderTextObject(element);
    }
  });
  editor.addEventListener("blur", () => {
    stopTextEdit(element);
  });
  editor.addEventListener("keydown", (event) => {
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
  selectObject(element);
  const editor = element.querySelector(".text-editor");
  const preset = getTextPreset(element);
  const state = getState(element);
  element.classList.add("is-editing");
  element.dataset.editStartText = element.dataset.text || "";
  element.dataset.editStartWidth = String(state.width);
  element.dataset.editStartHeight = String(state.height);
  editor.value = element.dataset.text || "";
  editor.style.fontSize = `${preset.fontSize}px`;
  editor.style.lineHeight = `${preset.lineHeight}px`;
  editor.style.color = element.dataset.textColor || DEFAULT_TEXT_COLOR;
  editor.focus();
  selectEditableContent(editor);
  setStatus("텍스트 편집 중입니다. 입력 후 바깥을 클릭하거나 Esc로 종료할 수 있습니다.");
}

function stopTextEdit(element, shouldSetStatus = true) {
  if (!element || element.dataset.type !== "text" || !element.classList.contains("is-editing")) {
    return;
  }
  const editor = element.querySelector(".text-editor");
  const previousText = element.dataset.editStartText || "";
  const previousWidth = numberOr(element.dataset.editStartWidth, Number.NaN);
  const previousHeight = numberOr(element.dataset.editStartHeight, Number.NaN);
  element.dataset.text = editor.value;
  element.classList.remove("is-editing");
  renderTextObject(element);
  delete element.dataset.editStartText;
  delete element.dataset.editStartWidth;
  delete element.dataset.editStartHeight;
  if (shouldSetStatus) {
    setStatus("텍스트 편집을 종료했습니다.");
  }
  const state = getState(element);
  const changed =
    previousText !== element.dataset.text ||
    previousWidth !== state.width ||
    previousHeight !== state.height;
  if (shouldSetStatus && changed) {
    recordHistory();
  }
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

function drawTextLines(context, text, width, height, shouldClear = false, textSizeKey = "h3") {
  const preset = getTextPreset(textSizeKey);
  if (shouldClear) {
    context.clearRect(0, 0, width, height);
  }
  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.clip();
  context.fillStyle = context.__textColor || DEFAULT_TEXT_COLOR;
  context.textBaseline = "top";
  context.font = `600 ${preset.fontSize}px Pretendard, sans-serif`;

  for (const [index, line] of wrapTextLines(context, text, width).entries()) {
    const y = TEXT_PADDING_Y + index * preset.lineHeight;
    if (y >= height) {
      break;
    }
    context.fillText(line, TEXT_PADDING_X, y);
  }

  context.restore();
}

function drawTextObject(context, object, width, height) {
  context.__textColor = object.dataset.textColor || DEFAULT_TEXT_COLOR;
  drawTextLines(context, object.dataset.text || "", width, height, false, object.dataset.textSize || "h3");
  delete context.__textColor;
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

function createDefaultSlide() {
  return {
    id: `slide-${++slideSeed}`,
    width: 1280,
    height: 720,
    color: "#ffffff",
    notes: "",
    objects: [],
  };
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
    textColor: object.dataset.textColor || DEFAULT_TEXT_COLOR,
  };
}

function serializeCurrentSlide() {
  if (!slides[activeSlideIndex]) {
    return;
  }

  for (const object of canvas.querySelectorAll(".text-object")) {
    stopTextEdit(object, false);
  }

  slides[activeSlideIndex] = {
    ...slides[activeSlideIndex],
    ...getCanvasState(),
    notes: slideNotes.value,
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
  image.src = data.src;
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
  const scale = Math.min(width / slide.width, height / slide.height);
  const offsetX = (width - slide.width * scale) / 2;
  const offsetY = (height - slide.height * scale) / 2;

  previewCanvas.width = width;
  previewCanvas.height = height;
  const context = previewCanvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#eef0f4";
  context.fillRect(0, 0, width, height);
  context.save();
  context.translate(offsetX, offsetY);
  context.scale(scale, scale);
  context.fillStyle = slide.color;
  context.fillRect(0, 0, slide.width, slide.height);

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
      drawTextLines(context, object.text || "", object.width, object.height, false, object.textSize || "h3");
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
    .then(async (meta) => {
      setActiveProjectMeta(meta);
      await refreshNativeProjectList();
      setSaveState("Saved");
      if (options.showStatus) {
        setStatus("프로젝트를 앱 내부에 저장했습니다.");
      }
      return meta;
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
    textColor: sanitizeColor(object.textColor, DEFAULT_TEXT_COLOR),
  };
}

function normalizeProjectData(data) {
  if (!data || data.format !== PROJECT_FORMAT || !Array.isArray(data.slides)) {
    throw new Error("Simple Slide 프로젝트 파일이 아닙니다.");
  }

  const normalizedSlides = data.slides.map((slide, index) => ({
    id: typeof slide.id === "string" ? slide.id : `slide-${index + 1}`,
    width: sanitizeNumber(slide.width, 1280, 80, 4096),
    height: sanitizeNumber(slide.height, 720, 80, 4096),
    color: sanitizeColor(slide.color),
    notes: typeof slide.notes === "string" ? slide.notes : "",
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

async function saveCanvasAsPng() {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  for (const object of canvas.querySelectorAll(".text-object")) {
    stopTextEdit(object);
  }
  await Promise.all([...canvas.querySelectorAll("img")].map(waitForImageLoad));

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = roundedCanvasSize(canvas.style.width || canvas.clientWidth);
  exportCanvas.height = roundedCanvasSize(canvas.style.height || canvas.clientHeight);

  const context = exportCanvas.getContext("2d");
  context.fillStyle = getComputedStyle(canvas).backgroundColor || "#ffffff";
  context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

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

function getSelectionBounds() {
  const states = selectedObjects.map(getState);
  const left = Math.min(...states.map((state) => state.x));
  const top = Math.min(...states.map((state) => state.y));
  const right = Math.max(...states.map((state) => state.x + state.width));
  const bottom = Math.max(...states.map((state) => state.y + state.height));
  return {
    left,
    top,
    right,
    bottom,
    center: (left + right) / 2,
    middle: (top + bottom) / 2,
  };
}

function statesOverlap(states) {
  for (let i = 0; i < states.length; i += 1) {
    const a = states[i];
    for (let j = i + 1; j < states.length; j += 1) {
      const b = states[j];
      const overlapsX = a.x < b.x + b.width && a.x + a.width > b.x;
      const overlapsY = a.y < b.y + b.height && a.y + a.height > b.y;
      if (overlapsX && overlapsY) {
        return true;
      }
    }
  }
  return false;
}

function preventAlignmentOverlap(items, preservedAxis) {
  const gap = 8;
  const primary = preservedAxis;
  const secondary = preservedAxis === "x" ? "y" : "x";
  const sizeKey = preservedAxis === "x" ? "width" : "height";
  const ordered = [...items].sort((a, b) => {
    const primaryDiff = a.original[primary] - b.original[primary];
    return primaryDiff || a.original[secondary] - b.original[secondary];
  });

  let cursor = -Infinity;
  for (const item of ordered) {
    if (item.next[primary] < cursor) {
      item.next[primary] = cursor;
    }
    cursor = item.next[primary] + item.next[sizeKey] + gap;
  }
}

function alignSelectedObjects(mode) {
  if (selectedObjects.length < 2) {
    return;
  }

  const bounds = getSelectionBounds();
  const items = selectedObjects.map((object) => {
    const state = getState(object);
    const nextState = { ...state };

    if (mode === "left") {
      nextState.x = bounds.left;
    } else if (mode === "center") {
      nextState.x = bounds.center - state.width / 2;
    } else if (mode === "right") {
      nextState.x = bounds.right - state.width;
    } else if (mode === "top") {
      nextState.y = bounds.top;
    } else if (mode === "middle") {
      nextState.y = bounds.middle - state.height / 2;
    } else if (mode === "bottom") {
      nextState.y = bounds.bottom - state.height;
    }

    return {
      object,
      original: state,
      next: nextState,
    };
  });

  if (statesOverlap(items.map((item) => item.next))) {
    const preservedAxis = mode === "left" || mode === "center" || mode === "right" ? "y" : "x";
    preventAlignmentOverlap(items, preservedAxis);
  }

  for (const item of items) {
    applyState(item.object, item.next);
  }

  renderSlideList();
  setStatus(`선택한 ${selectedObjects.length}개 오브젝트를 겹치지 않게 정렬했습니다.`);
  recordHistory();
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
libraryNewProject.addEventListener("click", () => createNewNativeProject());
strokeColor.addEventListener("input", () => applySelectedShapeStyleChange());
strokeColor.addEventListener("change", () => applySelectedShapeStyleChange(true));
strokeWidth.addEventListener("input", () => applySelectedShapeStyleChange());
strokeWidth.addEventListener("change", () => {
  normalizeStrokeWidthInput();
  applySelectedShapeStyleChange(true);
});
strokeWidth.addEventListener("blur", normalizeStrokeWidthInput);

pasteImage.addEventListener("click", pasteImageFromClipboard);
addTextBox.addEventListener("click", () => {
  addTextObject("텍스트", "텍스트 상자를 만들었습니다. 바로 입력해서 내용을 바꿀 수 있습니다.");
  startTextEdit(selectedObject);
});
editSelectedText.addEventListener("click", () => {
  startTextEdit(selectedObject);
});
duplicateSelected.addEventListener("click", duplicateSelectedObjects);
savePng.addEventListener("click", saveCanvasAsPng);
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
selectedTextColor.addEventListener("input", () => applySelectedTextColorChange());
selectedTextColor.addEventListener("change", () => applySelectedTextColorChange(true));
for (const button of alignButtons) {
  button.addEventListener("click", () => alignSelectedObjects(button.dataset.align));
}

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
setDrawTool("select", { silent: true });
slides = [createDefaultSlide()];
loadSlide(0, false);
resetHistory();
initializeNativeMode().catch((error) => {
  setStatus(error?.message || "프로젝트 목록을 초기화하지 못했습니다.");
});
