import {
  isFullscreenAvailable,
  requestFullscreen,
  exitFullscreen,
  isFullscreen,
  onFullscreenChange,
} from '../../src/utils/fullscreen.js';

describe('fullscreen utils', () => {
  let mockElement: HTMLElement;

  beforeEach(() => {
    mockElement = document.createElement('div');
    document.body.appendChild(mockElement);
  });

  afterEach(() => {
    document.body.removeChild(mockElement);
  });

  describe('isFullscreenAvailable', () => {
    it('returns true when fullscreen API is available', () => {
      Object.defineProperty(document, 'fullscreenEnabled', {
        value: true,
        writable: true,
      });
      expect(isFullscreenAvailable()).toBe(true);
    });

    it('returns false when fullscreen API is not available', () => {
      Object.defineProperty(document, 'fullscreenEnabled', {
        value: false,
        writable: true,
      });
      expect(isFullscreenAvailable()).toBe(false);
    });

    it('checks webkit prefix when standard API is not available', () => {
      Object.defineProperty(document, 'fullscreenEnabled', {
        value: undefined,
        writable: true,
      });
      Object.defineProperty(document, 'webkitFullscreenEnabled', {
        value: true,
        writable: true,
      });
      expect(isFullscreenAvailable()).toBe(true);
    });
  });

  describe('requestFullscreen', () => {
    it('calls standard requestFullscreen when available', async () => {
      const mockRequest = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(mockElement, 'requestFullscreen', {
        value: mockRequest,
        writable: true,
      });

      await requestFullscreen(mockElement);
      expect(mockRequest).toHaveBeenCalled();
    });

    it('calls webkitRequestFullscreen when standard API is not available', async () => {
      const mockRequest = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(mockElement, 'requestFullscreen', {
        value: undefined,
        writable: true,
      });
      Object.defineProperty(mockElement, 'webkitRequestFullscreen', {
        value: mockRequest,
        writable: true,
      });

      await requestFullscreen(mockElement);
      expect(mockRequest).toHaveBeenCalled();
    });

    it('rejects when fullscreen is not supported', async () => {
      await expect(requestFullscreen(mockElement)).rejects.toThrow('Fullscreen not supported');
    });
  });

  describe('exitFullscreen', () => {
    it('calls standard exitFullscreen when available', async () => {
      const mockExit = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(document, 'exitFullscreen', {
        value: mockExit,
        writable: true,
      });

      await exitFullscreen();
      expect(mockExit).toHaveBeenCalled();
    });

    it('calls webkitExitFullscreen when standard API is not available', async () => {
      const mockExit = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(document, 'exitFullscreen', {
        value: undefined,
        writable: true,
      });
      Object.defineProperty(document, 'webkitExitFullscreen', {
        value: mockExit,
        writable: true,
      });

      await exitFullscreen();
      expect(mockExit).toHaveBeenCalled();
    });

    it('rejects when fullscreen is not supported', async () => {
      Object.defineProperty(document, 'exitFullscreen', {
        value: undefined,
        writable: true,
      });
      Object.defineProperty(document, 'webkitExitFullscreen', {
        value: undefined,
        writable: true,
      });
      Object.defineProperty(document, 'mozCancelFullScreen', {
        value: undefined,
        writable: true,
      });
      Object.defineProperty(document, 'msExitFullscreen', {
        value: undefined,
        writable: true,
      });

      await expect(exitFullscreen()).rejects.toThrow('Fullscreen not supported');
    });
  });

  describe('isFullscreen', () => {
    it('returns true when fullscreenElement is set', () => {
      Object.defineProperty(document, 'fullscreenElement', {
        value: mockElement,
        writable: true,
      });
      expect(isFullscreen()).toBe(true);
    });

    it('returns false when fullscreenElement is null', () => {
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        writable: true,
      });
      expect(isFullscreen()).toBe(false);
    });

    it('checks webkit prefix when standard API is not available', () => {
      Object.defineProperty(document, 'fullscreenElement', {
        value: undefined,
        writable: true,
      });
      Object.defineProperty(document, 'webkitFullscreenElement', {
        value: mockElement,
        writable: true,
      });
      expect(isFullscreen()).toBe(true);
    });
  });

  describe('onFullscreenChange', () => {
    it('adds event listeners for fullscreen change events', () => {
      const callback = jest.fn();
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

      const unsubscribe = onFullscreenChange(callback);

      expect(addEventListenerSpy).toHaveBeenCalledWith('fullscreenchange', callback);
      expect(addEventListenerSpy).toHaveBeenCalledWith('webkitfullscreenchange', callback);
      expect(addEventListenerSpy).toHaveBeenCalledWith('mozfullscreenchange', callback);
      expect(addEventListenerSpy).toHaveBeenCalledWith('MSFullscreenChange', callback);

      unsubscribe();
      addEventListenerSpy.mockRestore();
    });

    it('removes event listeners when unsubscribe is called', () => {
      const callback = jest.fn();
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

      const unsubscribe = onFullscreenChange(callback);
      unsubscribe();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('fullscreenchange', callback);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('webkitfullscreenchange', callback);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mozfullscreenchange', callback);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('MSFullscreenChange', callback);

      removeEventListenerSpy.mockRestore();
    });

    it('calls callback when fullscreen change event is triggered', () => {
      const callback = jest.fn();
      onFullscreenChange(callback);

      const event = new Event('fullscreenchange');
      document.dispatchEvent(event);

      expect(callback).toHaveBeenCalled();
    });
  });
});
