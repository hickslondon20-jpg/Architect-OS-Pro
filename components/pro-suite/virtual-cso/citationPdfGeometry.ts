export interface CitationBBox {
  page_no?: number | null;
  l: number;
  t: number;
  r: number;
  b: number;
  coord_origin?: string | null;
  page_w: number;
  page_h: number;
}

export interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const isBBoxLocator = (locator: unknown): locator is { kind: 'bbox'; page_number?: number | null; bbox: CitationBBox } => {
  if (!locator || typeof locator !== 'object') return false;
  const candidate = locator as Record<string, unknown>;
  return candidate.kind === 'bbox' && isCitationBBox(candidate.bbox);
};

export const isCitationBBox = (value: unknown): value is CitationBBox => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return ['l', 't', 'r', 'b', 'page_w', 'page_h'].every((key) => typeof candidate[key] === 'number');
};

export const transformBBoxToCanvasRect = (
  bbox: CitationBBox,
  canvasWidth: number,
  canvasHeight: number,
): HighlightRect => {
  const sx = canvasWidth / bbox.page_w;
  const sy = canvasHeight / bbox.page_h;
  const x0 = Math.min(bbox.l, bbox.r);
  const x1 = Math.max(bbox.l, bbox.r);
  const y0 = Math.min(bbox.t, bbox.b);
  const y1 = Math.max(bbox.t, bbox.b);
  const coordOrigin = String(bbox.coord_origin || 'TOPLEFT').toUpperCase().replace(/[_\s-]/g, '');
  const isBottomLeft = coordOrigin === 'BOTTOMLEFT' || coordOrigin === 'BOTTOM';

  return {
    left: x0 * sx,
    top: isBottomLeft ? (bbox.page_h - y1) * sy : y0 * sy,
    width: (x1 - x0) * sx,
    height: (y1 - y0) * sy,
  };
};

