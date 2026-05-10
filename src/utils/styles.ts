const STYLE_ID = 'panorama-player-styles';
const STYLE_REFCOUNT_PROP = '__panoramaPlayerRefcount';

const CSS = `
.panorama-player {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  background: #000;
}
.panorama-player__canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}
.panorama-player__canvas:active {
  cursor: grabbing;
}
.panorama-player__hint {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  color: rgba(255, 255, 255, 0.9);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 16px;
  font-weight: 500;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease-out;
  z-index: 10;
}
.panorama-player__hint.visible {
  opacity: 1;
}
`;

interface StyleHost extends HTMLStyleElement {
  [STYLE_REFCOUNT_PROP]?: number;
}

export function acquireStyles(doc: Document = document): void {
  let el = doc.getElementById(STYLE_ID) as StyleHost | null;
  if (!el) {
    el = doc.createElement('style') as StyleHost;
    el.id = STYLE_ID;
    el.textContent = CSS;
    el[STYLE_REFCOUNT_PROP] = 0;
    doc.head.appendChild(el);
  }
  el[STYLE_REFCOUNT_PROP] = (el[STYLE_REFCOUNT_PROP] ?? 0) + 1;
}

export function releaseStyles(doc: Document = document): void {
  const el = doc.getElementById(STYLE_ID) as StyleHost | null;
  if (!el) return;
  const next = (el[STYLE_REFCOUNT_PROP] ?? 1) - 1;
  if (next <= 0) {
    el.remove();
  } else {
    el[STYLE_REFCOUNT_PROP] = next;
  }
}

export function _stylesRefcount(doc: Document = document): number {
  const el = doc.getElementById(STYLE_ID) as StyleHost | null;
  if (!el) return 0;
  return el[STYLE_REFCOUNT_PROP] ?? 0;
}
