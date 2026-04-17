import tiledMapRaw from "../../../tiled/map.json?raw";

const TILED_MAP_DATA = JSON.parse(tiledMapRaw);
const EMPTY_TILE_ID = 400;
const DEFAULT_SCALE = 11;
const MIN_STRUCTURE_SPAN = 2;
const MIN_STRUCTURE_AREA = 8;
const MAX_RECT_SCAN_SPAN = 24;

const TILE_PALETTES = Object.freeze({
  122: Object.freeze({
    baseColor: 0x80848c,
    sideColor: 0x555962,
    roofColor: 0xd8b55b,
  }),
  290: Object.freeze({
    baseColor: 0x7f786e,
    sideColor: 0x524d47,
    roofColor: 0xbe7b55,
  }),
  390: Object.freeze({
    baseColor: 0x7a8188,
    sideColor: 0x4c535a,
    roofColor: 0x66acd1,
  }),
  395: Object.freeze({
    baseColor: 0x7e8076,
    sideColor: 0x53544d,
    roofColor: 0xd26c62,
  }),
  650: Object.freeze({
    baseColor: 0x838086,
    sideColor: 0x58555c,
    roofColor: 0xd58b57,
  }),
  default: Object.freeze({
    baseColor: 0x7f848a,
    sideColor: 0x53585f,
    roofColor: 0xd08d5e,
  }),
});

function extractLayerBounds(mapData) {
  const tileWidth = Number(mapData?.tilewidth) || 8;
  const tileHeight = Number(mapData?.tileheight) || 8;
  let minTileX = Number.POSITIVE_INFINITY;
  let minTileY = Number.POSITIVE_INFINITY;
  let maxTileX = Number.NEGATIVE_INFINITY;
  let maxTileY = Number.NEGATIVE_INFINITY;

  for (const layer of mapData?.layers || []) {
    if (layer?.type !== "tilelayer") continue;

    if (Array.isArray(layer.chunks) && layer.chunks.length > 0) {
      for (const chunk of layer.chunks) {
        const chunkX = Number(chunk.x) || 0;
        const chunkY = Number(chunk.y) || 0;
        const chunkWidth = Number(chunk.width) || 0;
        const chunkHeight = Number(chunk.height) || 0;
        minTileX = Math.min(minTileX, chunkX);
        minTileY = Math.min(minTileY, chunkY);
        maxTileX = Math.max(maxTileX, chunkX + chunkWidth);
        maxTileY = Math.max(maxTileY, chunkY + chunkHeight);
      }
      continue;
    }

    const layerX = Number(layer.startx ?? layer.x) || 0;
    const layerY = Number(layer.starty ?? layer.y) || 0;
    const layerWidth = Number(layer.width ?? mapData?.width) || 0;
    const layerHeight = Number(layer.height ?? mapData?.height) || 0;
    minTileX = Math.min(minTileX, layerX);
    minTileY = Math.min(minTileY, layerY);
    maxTileX = Math.max(maxTileX, layerX + layerWidth);
    maxTileY = Math.max(maxTileY, layerY + layerHeight);
  }

  if (!Number.isFinite(minTileX) || !Number.isFinite(minTileY)) {
    minTileX = 0;
    minTileY = 0;
    maxTileX = Number(mapData?.width) || 0;
    maxTileY = Number(mapData?.height) || 0;
  }

  return {
    minTileX,
    minTileY,
    maxTileX,
    maxTileY,
    tileWidth,
    tileHeight,
    widthTiles: maxTileX - minTileX,
    heightTiles: maxTileY - minTileY,
    widthPx: Math.max(0, (maxTileX - minTileX) * tileWidth),
    heightPx: Math.max(0, (maxTileY - minTileY) * tileHeight),
  };
}

function getPrimaryTileLayer(mapData) {
  return (mapData?.layers || []).find((layer) => layer?.type === "tilelayer") || null;
}

function buildResolvedTileGrid(mapData) {
  const bounds = extractLayerBounds(mapData);
  const widthTiles = Math.max(0, bounds.widthTiles);
  const heightTiles = Math.max(0, bounds.heightTiles);
  const grid = Array.from({ length: heightTiles }, () =>
    Array(widthTiles).fill(EMPTY_TILE_ID)
  );

  for (const layer of mapData?.layers || []) {
    if (layer?.type !== "tilelayer") continue;

    const chunks =
      Array.isArray(layer.chunks) && layer.chunks.length > 0 ? layer.chunks : [layer];

    for (const chunk of chunks) {
      const chunkWidth = Number(chunk.width ?? layer.width ?? mapData?.width) || 0;
      const chunkHeight = Number(chunk.height ?? layer.height ?? mapData?.height) || 0;
      const chunkX = Number(chunk.x ?? layer.startx ?? layer.x) || 0;
      const chunkY = Number(chunk.y ?? layer.starty ?? layer.y) || 0;
      const data = Array.isArray(chunk.data) ? chunk.data : [];

      for (let index = 0; index < data.length; index += 1) {
        const localX = index % chunkWidth;
        const localY = Math.floor(index / chunkWidth);
        if (localY >= chunkHeight) continue;

        const targetX = chunkX + localX - bounds.minTileX;
        const targetY = chunkY + localY - bounds.minTileY;
        if (
          targetX < 0 ||
          targetY < 0 ||
          targetX >= widthTiles ||
          targetY >= heightTiles
        ) {
          continue;
        }

        grid[targetY][targetX] = Number(data[index]) || 0;
      }
    }
  }

  return {
    bounds,
    grid,
    layer: getPrimaryTileLayer(mapData),
  };
}

function getPreviewOriginPx(sourceImage, resolved) {
  const imageWidth = Number(sourceImage?.width || resolved.bounds.widthPx);
  const imageHeight = Number(sourceImage?.height || resolved.bounds.heightPx);
  const extraWidth = Math.max(0, imageWidth - resolved.bounds.widthPx);
  const extraHeight = Math.max(0, imageHeight - resolved.bounds.heightPx);
  const offsetX = Number(resolved.layer?.offsetx) || 0;
  const offsetY = Number(resolved.layer?.offsety) || 0;

  return {
    x: offsetX < 0 ? extraWidth : 0,
    y: offsetY > 0 ? extraHeight : 0,
  };
}

function isStructureTile(tileId) {
  return Number(tileId) > 0 && Number(tileId) !== EMPTY_TILE_ID;
}

function measureRowWidth(grid, used, startX, y, maxWidth, targetTileId) {
  let width = 0;
  const row = grid[y];
  if (!row) return 0;

  while (startX + width < row.length && width < maxWidth) {
    if (
      used[y][startX + width] ||
      row[startX + width] !== targetTileId ||
      !isStructureTile(row[startX + width])
    ) {
      break;
    }
    width += 1;
  }

  return width;
}

function findBestRectangle(grid, used, startX, startY) {
  const targetTileId = grid[startY][startX];
  const initialWidth = measureRowWidth(
    grid,
    used,
    startX,
    startY,
    MAX_RECT_SCAN_SPAN,
    targetTileId
  );

  let bestWidth = initialWidth;
  let bestHeight = 1;
  let bestArea = initialWidth;
  let width = initialWidth;

  for (
    let height = 1;
    startY + height <= grid.length && height <= MAX_RECT_SCAN_SPAN;
    height += 1
  ) {
    width = Math.min(
      width,
      measureRowWidth(grid, used, startX, startY + height - 1, width, targetTileId)
    );
    if (width <= 0) break;

    const area = width * height;
    const currentMinSpan = Math.min(width, height);
    const bestMinSpan = Math.min(bestWidth, bestHeight);

    if (area > bestArea || (area === bestArea && currentMinSpan > bestMinSpan)) {
      bestWidth = width;
      bestHeight = height;
      bestArea = area;
    }
  }

  return {
    tileId: targetTileId,
    width: bestWidth,
    height: bestHeight,
    area: bestArea,
  };
}

function markRectangleUsed(used, startX, startY, width, height) {
  for (let y = startY; y < startY + height; y += 1) {
    for (let x = startX; x < startX + width; x += 1) {
      used[y][x] = true;
    }
  }
}

function getDominantTileId(grid, startX, startY, width, height) {
  const counts = new Map();

  for (let y = startY; y < startY + height; y += 1) {
    for (let x = startX; x < startX + width; x += 1) {
      const tileId = grid[y][x];
      counts.set(tileId, (counts.get(tileId) || 0) + 1);
    }
  }

  let dominantTileId = EMPTY_TILE_ID;
  let dominantCount = -1;
  for (const [tileId, count] of counts.entries()) {
    if (count > dominantCount) {
      dominantTileId = tileId;
      dominantCount = count;
    }
  }

  return dominantTileId;
}

function getPaletteForTile(tileId) {
  return TILE_PALETTES[tileId] || TILE_PALETTES.default;
}

function clampFakeHeight(tileWidth, tileHeight, scale) {
  const shortestSpan = Math.min(tileWidth, tileHeight);
  const longestSpan = Math.max(tileWidth, tileHeight);
  const rawHeight = (5 + shortestSpan * 1.2 + longestSpan * 0.45) * scale;
  return Math.max(72, Math.min(240, Math.round(rawHeight)));
}

function expandBounds(bounds, rect) {
  if (!bounds) {
    return {
      left: rect.x,
      top: rect.y,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
    };
  }

  return {
    left: Math.min(bounds.left, rect.x),
    top: Math.min(bounds.top, rect.y),
    right: Math.max(bounds.right, rect.x + rect.width),
    bottom: Math.max(bounds.bottom, rect.y + rect.height),
  };
}

function buildStructureRectangles(sourceImage, resolved, scale) {
  const used = resolved.grid.map((row) => row.map(() => false));
  const originPx = getPreviewOriginPx(sourceImage, resolved);
  const buildings = [];
  let structureBounds = null;
  let structureTileCount = 0;

  for (let y = 0; y < resolved.grid.length; y += 1) {
    const row = resolved.grid[y];

    for (let x = 0; x < row.length; x += 1) {
      if (used[y][x] || !isStructureTile(row[x])) continue;

      const rect = findBestRectangle(resolved.grid, used, x, y);
      markRectangleUsed(used, x, y, rect.width, rect.height);

      if (
        rect.area < MIN_STRUCTURE_AREA ||
        rect.width < MIN_STRUCTURE_SPAN ||
        rect.height < MIN_STRUCTURE_SPAN
      ) {
        continue;
      }

      structureTileCount += rect.area;

      const dominantTileId =
        rect.tileId ||
        getDominantTileId(resolved.grid, x, y, rect.width, rect.height);
      const palette = getPaletteForTile(dominantTileId);
      const rectPx = {
        x: originPx.x + x * resolved.bounds.tileWidth,
        y: originPx.y + y * resolved.bounds.tileHeight,
        width: rect.width * resolved.bounds.tileWidth,
        height: rect.height * resolved.bounds.tileHeight,
      };

      structureBounds = expandBounds(structureBounds, rectPx);
      buildings.push({
        x: rectPx.x * scale,
        y: rectPx.y * scale,
        width: rectPx.width * scale,
        height: rectPx.height * scale,
        fakeHeight: clampFakeHeight(rect.width, rect.height, scale),
        parallaxStrength: 0.17 + Math.min(0.09, rect.area / 420),
        tileId: dominantTileId,
        ...palette,
      });
    }
  }

  const focusPoint = structureBounds
    ? {
        x: (structureBounds.left + structureBounds.right) * 0.5 * scale,
        y: (structureBounds.top + structureBounds.bottom) * 0.5 * scale,
      }
    : null;

  return {
    buildings,
    structureBounds,
    structureTileCount,
    focusPoint,
    originPx,
  };
}

function buildMapMetadata(sourceImage, scale = DEFAULT_SCALE) {
  const resolved = buildResolvedTileGrid(TILED_MAP_DATA);
  const imageWidthPx = Number(sourceImage?.width || resolved.bounds.widthPx);
  const imageHeightPx = Number(sourceImage?.height || resolved.bounds.heightPx);

  return {
    mapData: TILED_MAP_DATA,
    resolved,
    imageWidthPx,
    imageHeightPx,
    worldWidth: imageWidthPx * scale,
    worldHeight: imageHeightPx * scale,
    midpoint: {
      x: imageWidthPx * scale * 0.5,
      y: imageHeightPx * scale * 0.5,
    },
  };
}

export function getFakeDepthMapMetadata(sourceImage, scale = DEFAULT_SCALE) {
  const metadata = buildMapMetadata(sourceImage, scale);
  return {
    mapData: metadata.mapData,
    bounds: metadata.resolved.bounds,
    imageWidthPx: metadata.imageWidthPx,
    imageHeightPx: metadata.imageHeightPx,
    worldWidth: metadata.worldWidth,
    worldHeight: metadata.worldHeight,
    midpoint: metadata.midpoint,
    originPx: getPreviewOriginPx(sourceImage, metadata.resolved),
  };
}

export function createFakeDepthCityLayout(sourceImage, options = {}) {
  const scale = Number(options.scale) || DEFAULT_SCALE;
  const metadata = buildMapMetadata(sourceImage, scale);
  const structureLayout = buildStructureRectangles(
    sourceImage,
    metadata.resolved,
    scale
  );

  return {
    mapData: metadata.mapData,
    bounds: metadata.resolved.bounds,
    imageWidthPx: metadata.imageWidthPx,
    imageHeightPx: metadata.imageHeightPx,
    worldWidth: metadata.worldWidth,
    worldHeight: metadata.worldHeight,
    midpoint: metadata.midpoint,
    originPx: structureLayout.originPx,
    buildings: structureLayout.buildings,
    structureBounds: structureLayout.structureBounds,
    structureTileCount: structureLayout.structureTileCount,
    focusPoint: structureLayout.focusPoint || metadata.midpoint,
  };
}
