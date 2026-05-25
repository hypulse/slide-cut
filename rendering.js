export function createRenderer(deps) {
  const {
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
  } = deps;

  function drawTextLines(context, text, width, height, shouldClear = false, textSizeKey = "h3", textAlign = "left", textStyle = {}) {
    const preset = getTextPreset(textSizeKey);
    const renderStyle = getTextRenderStyle({
      ...textStyle,
      textColor: textStyle.textColor || context.__textColor || DEFAULT_TEXT_COLOR,
    });
    const safeAlign = sanitizeTextAlign(textAlign);
    if (shouldClear) {
      context.clearRect(0, 0, width, height);
    }
    context.save();
    context.beginPath();
    context.rect(0, 0, width, height);
    context.clip();
    context.textBaseline = "top";
    context.textAlign = safeAlign;
    context.font = `${renderStyle.fontWeight} ${preset.fontSize}px "${renderStyle.fontFamily}"`;

    const outset = getTextEffectOutset(renderStyle);
    const contentX = outset.x;
    const contentY = outset.y;
    const contentWidth = Math.max(1, width - outset.x * 2);
    const contentHeight = Math.max(1, height - outset.y * 2);
    const lines = wrapTextLines(context, text, contentWidth).filter(
      (_, index) => TEXT_PADDING_Y + index * preset.lineHeight < contentHeight
    );
    const lineWidths = lines.map((line) => context.measureText(line).width);
    if (renderStyle.backgroundColor && lines.length) {
      const paddingX = renderStyle.backgroundPaddingX || 12;
      const paddingY = renderStyle.backgroundPaddingY || 6;
      const blockWidth = Math.min(Math.max(1, contentWidth - 2), Math.max(...lineWidths, 1) + paddingX * 2);
      const blockHeight = Math.min(Math.max(1, contentHeight - 2), lines.length * preset.lineHeight + paddingY * 2);
      const rawBlockX =
        safeAlign === "center"
          ? contentX + (contentWidth - blockWidth) / 2
          : safeAlign === "right"
            ? contentX + contentWidth - TEXT_PADDING_X - blockWidth
            : contentX + TEXT_PADDING_X - paddingX;
      const blockX = clamp(rawBlockX, 1, Math.max(1, width - blockWidth - 1));
      const blockY = Math.max(1, contentY + TEXT_PADDING_Y - paddingY * 0.65);
      context.save();
      if (renderStyle.shadowColor) {
        context.shadowColor = renderStyle.shadowColor;
        context.shadowBlur = renderStyle.shadowBlur || 0;
        context.shadowOffsetX = renderStyle.shadowOffsetX || 0;
        context.shadowOffsetY = renderStyle.shadowOffsetY || 0;
      }
      context.fillStyle = renderStyle.backgroundColor;
      fillRoundedRect(context, blockX, blockY, blockWidth, blockHeight, renderStyle.backgroundRadius || 8);
      if (renderStyle.backgroundStrokeColor && renderStyle.backgroundStrokeWidth) {
        context.shadowColor = "transparent";
        context.lineWidth = renderStyle.backgroundStrokeWidth;
        context.strokeStyle = renderStyle.backgroundStrokeColor;
        strokeRoundedRect(
          context,
          blockX + renderStyle.backgroundStrokeWidth / 2,
          blockY + renderStyle.backgroundStrokeWidth / 2,
          blockWidth - renderStyle.backgroundStrokeWidth,
          blockHeight - renderStyle.backgroundStrokeWidth,
          renderStyle.backgroundRadius || 8
        );
      }
      context.restore();
    }

    for (const [index, line] of lines.entries()) {
      const y = contentY + TEXT_PADDING_Y + index * preset.lineHeight;
      const x =
        safeAlign === "center"
          ? contentX + contentWidth / 2
          : safeAlign === "right"
            ? contentX + contentWidth - TEXT_PADDING_X
            : contentX + TEXT_PADDING_X;
      const shadowLayerColor = renderStyle.backgroundColor ? "" : renderStyle.shadowLayerColor;
      if (shadowLayerColor) {
        const shadowX = Number(renderStyle.shadowLayerOffsetX ?? renderStyle.shadowOffsetX ?? 0) || 0;
        const shadowY = Number(renderStyle.shadowLayerOffsetY ?? renderStyle.shadowOffsetY ?? 0) || 0;
        context.save();
        context.shadowColor = "transparent";
        context.lineJoin = "round";
        context.miterLimit = 2;
        context.strokeStyle = shadowLayerColor;
        context.fillStyle = shadowLayerColor;
        context.lineWidth = renderStyle.shadowLayerStrokeWidth || renderStyle.strokeWidth || 0;
        if (context.lineWidth) {
          context.strokeText(line, x + shadowX, y + shadowY);
        }
        context.fillText(line, x + shadowX, y + shadowY);
        context.restore();
      }
      if (renderStyle.shadowColor && !renderStyle.backgroundColor && !shadowLayerColor) {
        context.shadowColor = renderStyle.shadowColor;
        context.shadowBlur = renderStyle.shadowBlur || 0;
        context.shadowOffsetX = renderStyle.shadowOffsetX || 0;
        context.shadowOffsetY = renderStyle.shadowOffsetY || 0;
      } else {
        context.shadowColor = "transparent";
      }
      if (renderStyle.strokeColor && renderStyle.strokeWidth) {
        context.lineJoin = "round";
        context.miterLimit = 2;
        context.lineWidth = renderStyle.strokeWidth;
        context.strokeStyle = renderStyle.strokeColor;
        context.strokeText(line, x, y);
      }
      context.shadowColor = "transparent";
      context.fillStyle = renderStyle.fillColor;
      context.fillText(line, x, y);
    }

    context.restore();
  }

  function drawGitTypingSlide(context, slide, width, height, timeSeconds) {
    const data = getGitTypingData(slide);
    const frame = getGitEditorFrame(data, timeSeconds);
    const windowX = Math.round(width * 0.048);
    const windowY = Math.round(height * 0.075);
    const windowWidth = width - windowX * 2;
    const windowHeight = height - windowY * 2;
    const windowRadius = clamp(Math.round(height * 0.028), 16, 24);
    const titleBarHeight = clamp(Math.round(height * 0.066), 42, 56);
    const codeSize = clamp(Math.round(width * 0.0145), 15, 23);
    const lineHeight = Math.round(codeSize * 1.55);
    const gutterWidth = Math.round(codeSize * 3.8);
    const editorPaddingX = Math.round(codeSize * 1.25);
    const editorPaddingTop = Math.round(codeSize * 1.05);
    const fileName = getFileNameFromPath(data.filePath || data.beforePath || data.title || "changes");
    const editorX = windowX;
    const editorY = windowY + titleBarHeight;
    const editorWidth = windowWidth;
    const editorHeight = windowHeight - titleBarHeight;
    const codeX = editorX + gutterWidth + editorPaddingX;
    const codeY = editorY + editorPaddingTop;
    const viewportHeight = editorHeight - editorPaddingTop * 2;
    const scrollOffset = clamp(
      frame.activeLineIndex * lineHeight - viewportHeight * 0.48,
      0,
      Math.max(0, frame.lines.length * lineHeight - viewportHeight)
    );

    context.fillStyle = "#0b1020";
    context.fillRect(0, 0, width, height);

    context.save();
    context.shadowColor = "rgba(0, 0, 0, 0.5)";
    context.shadowBlur = Math.round(height * 0.035);
    context.shadowOffsetY = Math.round(height * 0.016);
    context.fillStyle = "#202632";
    fillRoundedRect(context, windowX, windowY, windowWidth, windowHeight, windowRadius);
    context.restore();

    context.save();
    traceRoundedRect(context, windowX, windowY, windowWidth, windowHeight, windowRadius);
    context.clip();
    context.fillStyle = "#2a303b";
    context.fillRect(windowX, windowY, windowWidth, titleBarHeight);
    context.fillStyle = "#1e1e1e";
    context.fillRect(editorX, editorY, editorWidth, editorHeight);
    context.fillStyle = "rgba(255, 255, 255, 0.08)";
    context.fillRect(windowX, editorY - 1, windowWidth, 1);
    context.restore();
    context.strokeStyle = "rgba(255, 255, 255, 0.12)";
    context.lineWidth = 1;
    strokeRoundedRect(context, windowX + 0.5, windowY + 0.5, windowWidth - 1, windowHeight - 1, windowRadius);

    const lightY = windowY + Math.round(titleBarHeight / 2);
    const lightRadius = clamp(Math.round(titleBarHeight * 0.16), 7, 10);
    const lightStartX = windowX + Math.round(titleBarHeight * 0.58);
    const lightGap = Math.round(lightRadius * 3.2);
    [
      ["#ff5f57", lightStartX],
      ["#febc2e", lightStartX + lightGap],
      ["#28c840", lightStartX + lightGap * 2],
    ].forEach(([color, x]) => {
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, lightY, lightRadius, 0, Math.PI * 2);
      context.fill();
    });

    context.fillStyle = "#d7dce5";
    context.font = `700 ${clamp(Math.round(codeSize * 0.82), 12, 16)}px "Pretendard"`;
    context.textBaseline = "top";
    context.textAlign = "center";
    context.fillText(fileName, windowX + windowWidth / 2, windowY + Math.round((titleBarHeight - codeSize) / 2));

    context.save();
    context.beginPath();
    context.rect(editorX, editorY, editorWidth, editorHeight);
    context.clip();
    context.font = `600 ${codeSize}px "Pretendard"`;
    context.textAlign = "right";
    context.textBaseline = "top";
    for (const [index, line] of frame.lines.entries()) {
      const lineY = codeY + index * lineHeight - scrollOffset;
      if (lineY + lineHeight < editorY || lineY > editorY + editorHeight) {
        continue;
      }

      if (line.changed) {
        context.fillStyle = line.pendingOld ? "rgba(248, 81, 73, 0.16)" : "rgba(46, 160, 67, 0.2)";
        context.fillRect(editorX, lineY - 2, editorWidth, lineHeight);
        context.fillStyle = line.pendingOld ? "#f85149" : "#3fb950";
        context.fillRect(editorX, lineY - 2, 4, lineHeight);
      }

      context.fillStyle = "#858585";
      context.fillText(String(index + 1), editorX + gutterWidth - Math.round(codeSize * 0.9), lineY);
      context.textAlign = "left";
      drawCodeLine(context, line.text, codeX, lineY, line.pendingOld ? "#fca5a5" : "");
      if (line.cursor) {
        const cursorX = codeX + context.measureText(line.text.slice(0, frame.cursorColumn)).width + 1;
        context.fillStyle = "#f8fafc";
        context.fillRect(cursorX, lineY + 1, 2, Math.round(lineHeight * 0.82));
      }
      context.textAlign = "right";
    }
    context.restore();
  }

  async function renderSlideToDataUrl(slide, options = {}) {
    await ensureSlideFontsReady?.(slide, options);
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

    await drawSlideObjectsForExport(context, slide.objects || [], options);

    if (options.subtitles) {
      drawSubtitleBox(context, getSubtitleTextForRender(slide, options), exportCanvas.width, exportCanvas.height, options);
    }

    return exportCanvas.toDataURL("image/png");
  }

  return {
    drawTextLines,
    drawGitTypingSlide,
    renderSlideToDataUrl,
  };
}
