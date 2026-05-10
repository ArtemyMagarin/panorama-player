/**
 * @jest-environment jsdom
 */
import { acquireStyles, releaseStyles, _stylesRefcount } from '../../src/utils/styles.js';

const STYLE_ID = 'panorama-player-styles';

describe('shared stylesheet', () => {
  beforeEach(() => {
    document.getElementById(STYLE_ID)?.remove();
  });

  test('acquire injects exactly one <style> element', () => {
    acquireStyles();
    acquireStyles();
    acquireStyles();
    const all = document.querySelectorAll(`#${STYLE_ID}`);
    expect(all.length).toBe(1);
    expect(_stylesRefcount()).toBe(3);
  });

  test('release decrements; element removed when refcount hits zero', () => {
    acquireStyles();
    acquireStyles();
    releaseStyles();
    expect(_stylesRefcount()).toBe(1);
    expect(document.getElementById(STYLE_ID)).not.toBeNull();
    releaseStyles();
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });

  test('extra release with no acquire is a no-op', () => {
    expect(() => releaseStyles()).not.toThrow();
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });

  test('CSS contains canvas class rule', () => {
    acquireStyles();
    const el = document.getElementById(STYLE_ID);
    expect(el?.textContent).toContain('.panorama-player__canvas');
    releaseStyles();
  });
});
