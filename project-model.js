export function createProjectModel(deps) {
  const {
    canvas,
    slideNotes,
    getSlides,
    getActiveSlideIndex,
    setSlideAtIndex,
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
    sanitizeColor,
    sanitizeNumber,
    normalizeFlipFlag,
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
  } = deps;

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
        flipX: state.flipX,
        flipY: state.flipY,
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
      fontFamily: sanitizeTextFontFamily(object.dataset.fontFamily),
      fontWeight: sanitizeTextFontWeight(object.dataset.fontWeight),
      textEffect: sanitizeTextEffect(object.dataset.textEffect),
    };
  }

  function serializeCurrentSlide() {
    const slides = getSlides();
    const activeSlideIndex = getActiveSlideIndex();
    if (!slides[activeSlideIndex]) {
      return;
    }

    for (const object of canvas.querySelectorAll(".text-object.is-editing")) {
      syncTextEditorValue(object, { render: false });
    }

    setSlideAtIndex(activeSlideIndex, {
      ...slides[activeSlideIndex],
      ...getCanvasState(),
      notes: slideNotes.value,
      video: normalizeSlideVideo(slides[activeSlideIndex]?.video),
      startSound: normalizeSlideStartSound(slides[activeSlideIndex]?.startSound),
      objects: [...canvas.querySelectorAll(".object")].map(serializeObject),
    });
  }

  function cloneProjectValue(value) {
    return JSON.parse(JSON.stringify(value));
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
        flipX: normalizeFlipFlag(object.flipX),
        flipY: normalizeFlipFlag(object.flipY),
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
      fontFamily: sanitizeTextFontFamily(object.fontFamily),
      fontWeight: sanitizeTextFontWeight(object.fontWeight),
      textEffect: sanitizeTextEffect(object.textEffect),
    };
  }

  function normalizeProjectData(data) {
    if (!data || data.format !== PROJECT_FORMAT || !Array.isArray(data.slides)) {
      throw new Error("Slide Cut 프로젝트 파일이 아닙니다.");
    }

    const normalizedSlides = data.slides.map((slide, index) => ({
      id: typeof slide.id === "string" ? slide.id : `slide-${index + 1}`,
      kind: sanitizeSlideKind(slide.kind),
      width: sanitizeNumber(slide.width, 1280, 80, 4096),
      height: sanitizeNumber(slide.height, 720, 80, 4096),
      color: sanitizeColor(slide.color),
      notes: typeof slide.notes === "string" ? slide.notes : "",
      video: normalizeSlideVideo(slide.video),
      startSound: normalizeSlideStartSound(slide.startSound),
      continueAfterTts: isDynamicSlide(slide) ? normalizeContinueAfterTts(slide.continueAfterTts) : false,
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
              content: stripGitSlideHelperText(
                typeof slide.gitTyping?.content === "string" ? slide.gitTyping.content : createDefaultGitTypingData().content
              ),
              beforeContent: typeof slide.gitTyping?.beforeContent === "string" ? slide.gitTyping.beforeContent : "",
              afterContent: stripGitSlideHelperText(
                typeof slide.gitTyping?.afterContent === "string"
                  ? slide.gitTyping.afterContent
                  : typeof slide.gitTyping?.content === "string"
                    ? slide.gitTyping.content
                    : createDefaultGitTypingData().afterContent
              ),
              beforePath: typeof slide.gitTyping?.beforePath === "string" ? slide.gitTyping.beforePath : "",
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
              textScale: sanitizeChatTextScale(slide.chatTyping?.textScale),
            }
          : undefined,
      objects: Array.isArray(slide.objects) ? slide.objects.map(normalizeProjectObject).filter(Boolean) : [],
    }));

    if (normalizedSlides.length === 0) {
      normalizedSlides.push(createDefaultSlide());
    }

    return {
      settings: normalizeProjectSettings(data.settings),
      activeSlideIndex: clamp(numberOr(data.activeSlideIndex, 0), 0, normalizedSlides.length - 1),
      slides: normalizedSlides,
    };
  }

  return {
    serializeObject,
    serializeCurrentSlide,
    cloneProjectValue,
    normalizeProjectObject,
    normalizeProjectData,
  };
}
