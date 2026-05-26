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

  function normalizeOpacity(value, fallback = 1) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? clamp(parsed, 0, 1) : fallback;
  }

  function colorWithOpacity(color, opacity) {
    const alpha = normalizeOpacity(opacity);
    const value = String(color || "").trim();
    if (!value || alpha >= 0.999) {
      return color;
    }
    if (alpha <= 0.001) {
      return "rgba(0, 0, 0, 0)";
    }
    if (value === "transparent") {
      return "rgba(0, 0, 0, 0)";
    }
    const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      const raw = hex[1];
      const channels =
        raw.length === 3
          ? raw.split("").map((part) => parseInt(part + part, 16))
          : [raw.slice(0, 2), raw.slice(2, 4), raw.slice(4, 6)].map((part) => parseInt(part, 16));
      return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
    }
    const rgb = value.match(/^rgba?\(([^)]+)\)$/i);
    if (rgb) {
      const parts = rgb[1].split(",").map((part) => part.trim());
      if (parts.length >= 3) {
        const existingAlpha = normalizeOpacity(parts.length >= 4 ? parts[3] : 1);
        const finalAlpha = clamp(existingAlpha * alpha, 0, 1);
        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${finalAlpha})`;
      }
    }
    return value;
  }

  function hashString(value) {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createSeededRandom(seed) {
    let state = hashString(seed);
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getLineLeft(anchorX, lineWidth, align) {
    if (align === "center") {
      return anchorX - lineWidth / 2;
    }
    if (align === "right") {
      return anchorX - lineWidth;
    }
    return anchorX;
  }

  function getTextBlockBounds(renderStyle, safeAlign, contentX, contentY, contentWidth, contentHeight, lines, lineWidths, lineHeight) {
    const paddingX = renderStyle.backgroundColor
      ? renderStyle.backgroundPaddingX || 12
      : renderStyle.decorationPaddingX || 14;
    const paddingY = renderStyle.backgroundColor
      ? renderStyle.backgroundPaddingY || 6
      : renderStyle.decorationPaddingY || 8;
    const widestLine = Math.max(...lineWidths, 1);
    const blockWidth = Math.min(Math.max(1, contentWidth - 2), widestLine + paddingX * 2);
    const blockHeight = Math.min(Math.max(1, contentHeight - 2), Math.max(1, lines.length) * lineHeight + paddingY * 2);
    const rawBlockX =
      safeAlign === "center"
        ? contentX + (contentWidth - blockWidth) / 2
        : safeAlign === "right"
          ? contentX + contentWidth - TEXT_PADDING_X - blockWidth
          : contentX + TEXT_PADDING_X - paddingX;
    const blockX = clamp(rawBlockX, 1, Math.max(1, contentX + contentWidth - blockWidth - 1));
    const blockY = Math.max(1, contentY + TEXT_PADDING_Y - paddingY * 0.65);
    return {
      x: blockX,
      y: blockY,
      width: blockWidth,
      height: blockHeight,
      centerX: blockX + blockWidth / 2,
      centerY: blockY + blockHeight / 2,
    };
  }

  function drawStar(context, x, y, outerRadius, color, opacity, rotation = 0) {
    const innerRadius = outerRadius * 0.38;
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.beginPath();
    for (let index = 0; index < 8; index += 1) {
      const radius = index % 2 === 0 ? outerRadius : innerRadius;
      const angle = -Math.PI / 2 + (index * Math.PI) / 4;
      const pointX = Math.cos(angle) * radius;
      const pointY = Math.sin(angle) * radius;
      if (index === 0) {
        context.moveTo(pointX, pointY);
      } else {
        context.lineTo(pointX, pointY);
      }
    }
    context.closePath();
    context.fillStyle = colorWithOpacity(color, opacity);
    context.fill();
    context.restore();
  }

  function drawTwinkleStar(context, x, y, outerRadius, color, opacity, rotation = 0) {
    const innerRadius = outerRadius * 0.18;
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.beginPath();
    for (let index = 0; index < 8; index += 1) {
      const radius = index % 2 === 0 ? outerRadius : innerRadius;
      const angle = -Math.PI / 2 + (index * Math.PI) / 4;
      const pointX = Math.cos(angle) * radius;
      const pointY = Math.sin(angle) * radius;
      if (index === 0) {
        context.moveTo(pointX, pointY);
      } else {
        context.lineTo(pointX, pointY);
      }
    }
    context.closePath();
    context.fillStyle = colorWithOpacity(color, opacity);
    context.fill();
    context.restore();
  }

  function getDecorationPoint(block, random, spread) {
    const side = Math.floor(random() * 4);
    if (side === 0) {
      return {
        x: block.x - spread + random() * (block.width + spread * 2),
        y: block.y - spread + random() * spread,
      };
    }
    if (side === 1) {
      return {
        x: block.x + block.width + random() * spread,
        y: block.y - spread * 0.35 + random() * (block.height + spread * 0.7),
      };
    }
    if (side === 2) {
      return {
        x: block.x - spread + random() * (block.width + spread * 2),
        y: block.y + block.height + random() * spread,
      };
    }
    return {
      x: block.x - random() * spread,
      y: block.y - spread * 0.35 + random() * (block.height + spread * 0.7),
    };
  }

  const DECORATION_BASE_FONT_SIZE = 28;

  function getDecorationScale(renderStyle) {
    const fontSize = Number(renderStyle?.fontSize);
    return Number.isFinite(fontSize) && fontSize > 0
      ? clamp(fontSize / DECORATION_BASE_FONT_SIZE, 0.7, 3)
      : 1;
  }

  function scaleDecorationValue(value, fallback, scale) {
    const numericValue = Number(value);
    return (Number.isFinite(numericValue) ? numericValue : fallback) * scale;
  }

  function drawSparkleDecoration(context, decoration, block, random, opacity, scale) {
    const colors = decoration.colors?.length ? decoration.colors : ["#ffffff", "#fff45f"];
    const count = Math.max(1, Math.round(Number(decoration.count) || 6));
    const spread = scaleDecorationValue(decoration.spread, 22, scale);
    const heroSize = scaleDecorationValue(decoration.heroSize, 9, scale);
    const satelliteSize = scaleDecorationValue(decoration.satelliteSize, 4.5, scale);
    for (let index = 0; index < count; index += 1) {
      const point = getDecorationPoint(block, random, spread);
      const color = colors[index % colors.length];
      const isHero = index % 3 === 0;
      const size = isHero
        ? heroSize + random() * 2.5 * scale
        : satelliteSize + random() * 1.8 * scale;
      const rotation = random() < 0.5 ? 0 : Math.PI / 4;
      drawTwinkleStar(context, point.x, point.y, size, color, opacity, rotation);
      if (isHero) {
        const offsetAngle = random() * Math.PI * 2;
        const offsetDistance = size * (1.4 + random() * 0.8);
        const dotX = point.x + Math.cos(offsetAngle) * offsetDistance;
        const dotY = point.y + Math.sin(offsetAngle) * offsetDistance;
        context.beginPath();
        context.fillStyle = colorWithOpacity(color, opacity * 0.85);
        context.arc(dotX, dotY, (1.3 + random() * 1.1) * scale, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawConfettiDecoration(context, decoration, block, random, opacity, scale) {
    const colors = decoration.colors?.length ? decoration.colors : ["#ff4fa3", "#ffffff", "#8de6ff"];
    const count = Math.max(1, Math.round(Number(decoration.count) || 12));
    const spread = scaleDecorationValue(decoration.spread, 18, scale);
    for (let index = 0; index < count; index += 1) {
      const point = getDecorationPoint(block, random, spread);
      const size = (3 + random() * 6) * scale;
      context.save();
      context.translate(point.x, point.y);
      context.rotate(random() * Math.PI);
      context.fillStyle = colorWithOpacity(colors[index % colors.length], opacity);
      if (random() < 0.5) {
        context.fillRect(-size * 0.5, -size * 0.28, size, size * 0.56);
      } else {
        context.beginPath();
        context.moveTo(0, -size * 0.65);
        context.lineTo(size * 0.65, 0);
        context.lineTo(0, size * 0.65);
        context.lineTo(-size * 0.65, 0);
        context.closePath();
        context.fill();
      }
      context.restore();
    }
  }

  function drawPaintBurstDecoration(context, decoration, block, random, opacity, scale) {
    const colors = decoration.colors?.length ? decoration.colors : ["#69ff35", "#ff39bf", "#9e4dff"];
    const count = Math.max(1, Math.round(Number(decoration.count) || 22));
    const spread = scaleDecorationValue(decoration.spread, 26, scale);
    const minSize = scaleDecorationValue(decoration.minSize, 5, scale);
    const maxSize = Math.max(minSize, scaleDecorationValue(decoration.maxSize, 20, scale));
    const decorationOpacity = normalizeOpacity(decoration.opacity, 0.9);
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const radiusX = block.width / 2 + random() * spread;
      const radiusY = block.height / 2 + random() * spread;
      const x = block.centerX + Math.cos(angle) * radiusX;
      const y = block.centerY + Math.sin(angle) * radiusY;
      const size = minSize + random() * (maxSize - minSize);
      const points = 5 + Math.floor(random() * 4);
      context.beginPath();
      for (let pointIndex = 0; pointIndex < points; pointIndex += 1) {
        const pointAngle = (pointIndex / points) * Math.PI * 2;
        const pointRadius = size * (0.55 + random() * 0.65);
        const pointX = x + Math.cos(pointAngle) * pointRadius;
        const pointY = y + Math.sin(pointAngle) * pointRadius;
        if (pointIndex === 0) {
          context.moveTo(pointX, pointY);
        } else {
          context.lineTo(pointX, pointY);
        }
      }
      context.closePath();
      context.fillStyle = colorWithOpacity(colors[index % colors.length], opacity * decorationOpacity);
      context.fill();
    }
  }

  function drawSprayDecoration(context, decoration, block, random, opacity, scale) {
    const colors = decoration.colors?.length ? decoration.colors : ["#69ff35", "#ff39bf", "#ffffff"];
    const count = Math.max(1, Math.round(Number(decoration.count) || 60));
    const spread = scaleDecorationValue(decoration.spread, 28, scale);
    const minSize = scaleDecorationValue(decoration.minSize, 0.9, scale);
    const maxSize = Math.max(minSize, scaleDecorationValue(decoration.maxSize, 3, scale));
    const decorationOpacity = normalizeOpacity(decoration.opacity, 0.68);

    for (let index = 0; index < count; index += 1) {
      const point = getDecorationPoint(block, random, spread);
      const size = minSize + random() * (maxSize - minSize);
      context.beginPath();
      context.fillStyle = colorWithOpacity(colors[index % colors.length], opacity * decorationOpacity * (0.55 + random() * 0.45));
      context.arc(point.x, point.y, size, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawBurstDecoration(context, decoration, block, random, opacity, scale) {
    const colors = decoration.colors?.length ? decoration.colors : ["#fff42c", "#ff2dac", "#ffffff"];
    const rayCount = Math.max(2, Math.round(Number(decoration.rayCount) || 5));
    const confettiCount = Math.max(0, Math.round(Number(decoration.confettiCount) ?? 10));
    const spread = scaleDecorationValue(decoration.spread, 22, scale);
    const strokeColor = decoration.strokeColor || "";
    const strokeWidth = scaleDecorationValue(decoration.strokeWidth, 0, scale);
    const fanSpread = Number(decoration.fanSpread) || Math.PI * 0.6;
    const baseRayLength = scaleDecorationValue(
      decoration.rayLength,
      Math.max(26, Math.min(block.height * 0.85, 52)),
      scale
    );
    const cornerInsetX = Math.min(block.width * 0.18, 14 * scale);
    const cornerInsetY = Math.min(block.height * 0.25, 12 * scale);
    const origins = decoration.origins || [
      { x: block.x + cornerInsetX, y: block.y + cornerInsetY, angle: Math.PI + Math.PI / 4 },
      { x: block.x + block.width - cornerInsetX, y: block.y + cornerInsetY, angle: -Math.PI / 4 },
    ];

    for (const [originIdx, origin] of origins.entries()) {
      for (let i = 0; i < rayCount; i += 1) {
        const t = rayCount === 1 ? 0.5 : i / (rayCount - 1);
        const angle = origin.angle - fanSpread / 2 + fanSpread * t + (random() - 0.5) * 0.06;
        const length = baseRayLength * (0.68 + random() * 0.5);
        const baseWidth = (3.5 + random() * 3.5) * scale;
        context.save();
        context.translate(origin.x, origin.y);
        context.rotate(angle);
        context.beginPath();
        context.moveTo(0, -baseWidth / 2);
        context.lineTo(length, -0.4 * scale);
        context.lineTo(length, 0.4 * scale);
        context.lineTo(0, baseWidth / 2);
        context.closePath();
        context.fillStyle = colorWithOpacity(colors[(i + originIdx) % colors.length], opacity);
        context.fill();
        if (strokeColor && strokeWidth > 0) {
          context.lineWidth = strokeWidth;
          context.lineJoin = "round";
          context.strokeStyle = colorWithOpacity(strokeColor, opacity);
          context.stroke();
        }
        context.restore();
      }
      const originColor = colors[(originIdx + 1) % colors.length];
      drawTwinkleStar(context, origin.x, origin.y, (6 + random() * 1.5) * scale, originColor, opacity, 0);
    }

    for (let i = 0; i < confettiCount; i += 1) {
      const point = getDecorationPoint(block, random, spread);
      const color = colors[i % colors.length];
      const roll = random();
      context.save();
      context.translate(point.x, point.y);
      context.fillStyle = colorWithOpacity(color, opacity);
      if (roll < 0.35) {
        const size = (4 + random() * 3) * scale;
        drawTwinkleStar(context, 0, 0, size, color, opacity, random() * Math.PI);
      } else if (roll < 0.7) {
        const size = (2 + random() * 2.2) * scale;
        context.beginPath();
        context.arc(0, 0, size, 0, Math.PI * 2);
        context.fill();
      } else {
        const size = (3 + random() * 3) * scale;
        context.rotate(random() * Math.PI);
        context.fillRect(-size * 0.5, -size * 0.32, size, size * 0.64);
      }
      context.restore();
    }
  }

  function drawDripDecoration(context, decoration, block, random, opacity, scale) {
    const colors = decoration.colors?.length ? decoration.colors : ["#48e568", "#2fcf59"];
    const count = Math.max(1, Math.round(Number(decoration.count) || 7));
    const strokeColor = decoration.strokeColor || "";
    const anchorInset = scaleDecorationValue(decoration.anchorInset, Math.min(22, block.height * 0.24), scale);
    for (let index = 0; index < count; index += 1) {
      const width = (5 + random() * 9) * scale;
      const height = (10 + random() * 24) * scale;
      const x = block.x + block.width * (0.08 + random() * 0.84);
      const y = block.y + block.height - anchorInset + random() * 4 * scale;
      context.beginPath();
      context.moveTo(x - width / 2, y);
      context.quadraticCurveTo(x - width * 0.55, y + height * 0.35, x - width * 0.12, y + height);
      context.quadraticCurveTo(x, y + height + width * 0.45, x + width * 0.12, y + height);
      context.quadraticCurveTo(x + width * 0.55, y + height * 0.35, x + width / 2, y);
      context.closePath();
      context.fillStyle = colorWithOpacity(colors[index % colors.length], opacity);
      context.fill();
      if (strokeColor) {
        context.lineWidth = 2 * scale;
        context.strokeStyle = colorWithOpacity(strokeColor, opacity);
        context.stroke();
      }
    }
  }

  function drawTapeDecoration(context, decoration, block, opacity) {
    const colors = decoration.colors?.length ? decoration.colors : ["rgba(255, 128, 186, 0.92)"];
    const width = block.width + (Number(decoration.paddingX) || 24);
    const height = block.height + (Number(decoration.paddingY) || 16);
    const rotation = ((Number(decoration.rotate) || -4) * Math.PI) / 180;
    for (const [index, color] of colors.entries()) {
      context.save();
      context.translate(block.centerX, block.centerY + index * 4);
      context.rotate(rotation + index * 0.035);
      context.fillStyle = colorWithOpacity(color, opacity);
      fillRoundedRect(context, -width / 2, -height / 2, width, height, 8);
      context.restore();
    }
  }

  function drawStripeDecoration(context, decoration, block, opacity) {
    const color = decoration.color || "rgba(17, 16, 21, 0.14)";
    const stripeWidth = Number(decoration.stripeWidth) || 9;
    const spacing = Number(decoration.spacing) || stripeWidth * 2.5;
    context.save();
    traceRoundedRect(context, block.x, block.y, block.width, block.height, 6);
    context.clip();
    context.fillStyle = colorWithOpacity(color, opacity);
    for (let x = block.x - block.height; x < block.x + block.width + block.height; x += spacing) {
      context.beginPath();
      context.moveTo(x, block.y + block.height);
      context.lineTo(x + stripeWidth, block.y + block.height);
      context.lineTo(x + block.height + stripeWidth, block.y);
      context.lineTo(x + block.height, block.y);
      context.closePath();
      context.fill();
    }
    context.restore();
  }

  function drawTextDecorations(context, renderStyle, phase, block, seed, opacity) {
    if (!Array.isArray(renderStyle.decorations) || !renderStyle.decorations.length) {
      return;
    }
    for (const [index, decoration] of renderStyle.decorations.entries()) {
      if (!decoration || (decoration.phase || "behind") !== phase) {
        continue;
      }
      const random = createSeededRandom(`${seed}:${phase}:${index}:${decoration.type}`);
      const decorationScale = getDecorationScale(renderStyle);
      context.save();
      switch (decoration.type) {
        case "sparkle":
          drawSparkleDecoration(context, decoration, block, random, opacity, decorationScale);
          break;
        case "confetti":
          drawConfettiDecoration(context, decoration, block, random, opacity, decorationScale);
          break;
        case "paintBurst":
          drawPaintBurstDecoration(context, decoration, block, random, opacity, decorationScale);
          break;
        case "spray":
          drawSprayDecoration(context, decoration, block, random, opacity, decorationScale);
          break;
        case "burst":
          drawBurstDecoration(context, decoration, block, random, opacity, decorationScale);
          break;
        case "drip":
          drawDripDecoration(context, decoration, block, random, opacity, decorationScale);
          break;
        case "tape":
          drawTapeDecoration(context, decoration, block, opacity);
          break;
        case "stripe":
          drawStripeDecoration(context, decoration, block, opacity);
          break;
      }
      context.restore();
    }
  }

  function getTextFillStyle(context, renderStyle, lineLeft, y, lineWidth, fontSize, opacity) {
    const gradientConfig = renderStyle.fillGradient;
    if (!gradientConfig || !Array.isArray(gradientConfig.stops) || gradientConfig.stops.length === 0) {
      return colorWithOpacity(renderStyle.fillColor, opacity);
    }
    const direction = gradientConfig.direction || "horizontal";
    const gradient =
      direction === "vertical"
        ? context.createLinearGradient(lineLeft, y, lineLeft, y + fontSize)
        : context.createLinearGradient(lineLeft, y, lineLeft + Math.max(1, lineWidth), y);
    for (const stop of gradientConfig.stops) {
      gradient.addColorStop(clamp(Number(stop.offset) || 0, 0, 1), colorWithOpacity(stop.color || renderStyle.fillColor, opacity));
    }
    return gradient;
  }

  function drawOffsetTextLayer(context, line, x, y, layer, opacity) {
    if (!layer) {
      return;
    }
    const offsetX = Number(layer.offsetX) || 0;
    const offsetY = Number(layer.offsetY) || 0;
    const layerOpacity = normalizeOpacity(layer.opacity, 1) * opacity;
    const layerColor = layer.color || layer.fillColor || layer.strokeColor;
    context.save();
    context.lineJoin = "round";
    context.miterLimit = 2;
    if (layer.shadowColor) {
      context.shadowColor = colorWithOpacity(layer.shadowColor, layerOpacity);
      context.shadowBlur = Number(layer.shadowBlur) || 0;
      context.shadowOffsetX = Number(layer.shadowOffsetX) || 0;
      context.shadowOffsetY = Number(layer.shadowOffsetY) || 0;
    } else {
      context.shadowColor = "transparent";
    }
    if (layer.strokeWidth) {
      context.lineWidth = Number(layer.strokeWidth) || 0;
      context.strokeStyle = colorWithOpacity(layer.strokeColor || layerColor, layerOpacity);
      context.strokeText(line, x + offsetX, y + offsetY);
    }
    if (layer.fill !== false) {
      context.fillStyle = colorWithOpacity(layer.fillColor || layerColor, layerOpacity);
      context.fillText(line, x + offsetX, y + offsetY);
    }
    context.restore();
  }

  function drawTextLines(context, text, width, height, shouldClear = false, textSizeKey = "h3", textAlign = "left", textStyle = {}) {
    const basePreset = getTextPreset(textSizeKey);
    const customFontSize = Number(textStyle.fontSize);
    const customLineHeight = Number(textStyle.lineHeight);
    const preset = {
      fontSize: Number.isFinite(customFontSize) && customFontSize > 0 ? customFontSize : basePreset.fontSize,
      lineHeight: Number.isFinite(customLineHeight) && customLineHeight > 0 ? customLineHeight : basePreset.lineHeight,
    };
    const renderStyle = {
      ...getTextRenderStyle({
        ...textStyle,
        textColor: textStyle.textColor || context.__textColor,
      }),
      fontSize: preset.fontSize,
      lineHeight: preset.lineHeight,
    };
    const renderOpacity = normalizeOpacity(textStyle.renderOpacity);
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
    if (!lines.length) {
      context.restore();
      return;
    }
    const textBlock = getTextBlockBounds(
      renderStyle,
      safeAlign,
      contentX,
      contentY,
      contentWidth,
      contentHeight,
      lines,
      lineWidths,
      preset.lineHeight
    );
    const decorationSeed = `${renderStyle.effectKey || ""}:${text}:${Math.round(width)}x${Math.round(height)}`;
    drawTextDecorations(context, renderStyle, "behind", textBlock, decorationSeed, renderOpacity);
    if (renderStyle.backgroundColor && lines.length) {
      context.save();
      if (renderStyle.shadowColor) {
        context.shadowColor = colorWithOpacity(renderStyle.shadowColor, renderOpacity);
        context.shadowBlur = renderStyle.shadowBlur || 0;
        context.shadowOffsetX = renderStyle.shadowOffsetX || 0;
        context.shadowOffsetY = renderStyle.shadowOffsetY || 0;
      }
      context.fillStyle = colorWithOpacity(renderStyle.backgroundColor, renderOpacity);
      fillRoundedRect(context, textBlock.x, textBlock.y, textBlock.width, textBlock.height, renderStyle.backgroundRadius || 8);
      if (renderStyle.backgroundStrokeColor && renderStyle.backgroundStrokeWidth) {
        context.shadowColor = "transparent";
        context.lineWidth = renderStyle.backgroundStrokeWidth;
        context.strokeStyle = colorWithOpacity(renderStyle.backgroundStrokeColor, renderOpacity);
        strokeRoundedRect(
          context,
          textBlock.x + renderStyle.backgroundStrokeWidth / 2,
          textBlock.y + renderStyle.backgroundStrokeWidth / 2,
          textBlock.width - renderStyle.backgroundStrokeWidth,
          textBlock.height - renderStyle.backgroundStrokeWidth,
          renderStyle.backgroundRadius || 8
        );
      }
      context.restore();
    }
    drawTextDecorations(context, renderStyle, "overBackground", textBlock, decorationSeed, renderOpacity);

    for (const [index, line] of lines.entries()) {
      const y = contentY + TEXT_PADDING_Y + index * preset.lineHeight;
      const x =
        safeAlign === "center"
          ? contentX + contentWidth / 2
          : safeAlign === "right"
            ? contentX + contentWidth - TEXT_PADDING_X
            : contentX + TEXT_PADDING_X;
      if (Array.isArray(renderStyle.offsetLayers)) {
        for (const layer of renderStyle.offsetLayers) {
          drawOffsetTextLayer(context, line, x, y, layer, renderOpacity);
        }
      }
      const shadowLayerColor = renderStyle.backgroundColor ? "" : renderStyle.shadowLayerColor;
      if (shadowLayerColor) {
        const shadowColor = colorWithOpacity(shadowLayerColor, renderOpacity);
        const shadowX = Number(renderStyle.shadowLayerOffsetX ?? renderStyle.shadowOffsetX ?? 0) || 0;
        const shadowY = Number(renderStyle.shadowLayerOffsetY ?? renderStyle.shadowOffsetY ?? 0) || 0;
        context.save();
        context.shadowColor = "transparent";
        context.lineJoin = "round";
        context.miterLimit = 2;
        context.strokeStyle = shadowColor;
        context.fillStyle = shadowColor;
        context.lineWidth = renderStyle.shadowLayerStrokeWidth || renderStyle.strokeWidth || 0;
        if (context.lineWidth) {
          context.strokeText(line, x + shadowX, y + shadowY);
        }
        context.fillText(line, x + shadowX, y + shadowY);
        context.restore();
      }
      if (Array.isArray(renderStyle.glowLayers) && renderStyle.glowLayers.length && !renderStyle.backgroundColor) {
        context.save();
        context.lineJoin = "round";
        context.miterLimit = 2;
        for (const layer of renderStyle.glowLayers) {
          if (!layer || !layer.color) continue;
          const layerColor = colorWithOpacity(layer.color, renderOpacity);
          context.shadowColor = layerColor;
          context.shadowBlur = Math.max(0, Number(layer.blur) || 0);
          context.shadowOffsetX = Number(layer.offsetX) || 0;
          context.shadowOffsetY = Number(layer.offsetY) || 0;
          context.fillStyle = layerColor;
          context.fillText(line, x, y);
        }
        context.restore();
      }
      if (renderStyle.shadowColor && !renderStyle.backgroundColor && !shadowLayerColor) {
        context.shadowColor = colorWithOpacity(renderStyle.shadowColor, renderOpacity);
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
        context.strokeStyle = colorWithOpacity(renderStyle.strokeColor, renderOpacity);
        context.strokeText(line, x, y);
      }
      context.shadowColor = "transparent";
      context.fillStyle = getTextFillStyle(
        context,
        renderStyle,
        getLineLeft(x, lineWidths[index] || 1, safeAlign),
        y,
        lineWidths[index] || 1,
        preset.fontSize,
        renderOpacity
      );
      context.fillText(line, x, y);
    }
    drawTextDecorations(context, renderStyle, "front", textBlock, decorationSeed, renderOpacity);

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
