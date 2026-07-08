import { describe, expect, it } from 'vitest';

import { transformBBoxToCanvasRect, type CitationBBox } from './citationPdfGeometry';

describe('transformBBoxToCanvasRect', () => {
  it('maps top-left page coordinates to canvas pixels', () => {
    const bbox: CitationBBox = {
      page_no: 1,
      l: 10,
      t: 20,
      r: 110,
      b: 70,
      coord_origin: 'TOPLEFT',
      page_w: 200,
      page_h: 100,
    };

    expect(transformBBoxToCanvasRect(bbox, 400, 200)).toEqual({
      left: 20,
      top: 40,
      width: 200,
      height: 100,
    });
  });

  it('flips bottom-left page coordinates for a top-left canvas overlay', () => {
    const bbox: CitationBBox = {
      page_no: 2,
      l: 10,
      t: 70,
      r: 110,
      b: 20,
      coord_origin: 'BOTTOMLEFT',
      page_w: 200,
      page_h: 100,
    };

    expect(transformBBoxToCanvasRect(bbox, 400, 200)).toEqual({
      left: 20,
      top: 60,
      width: 200,
      height: 100,
    });
  });

  it('normalizes reversed coordinates before scaling', () => {
    const bbox: CitationBBox = {
      l: 110,
      t: 70,
      r: 10,
      b: 20,
      coord_origin: 'TOP_LEFT',
      page_w: 200,
      page_h: 100,
    };

    expect(transformBBoxToCanvasRect(bbox, 400, 200)).toEqual({
      left: 20,
      top: 40,
      width: 200,
      height: 100,
    });
  });
});

