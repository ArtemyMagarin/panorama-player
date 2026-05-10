export function loadImage(src: string | HTMLImageElement): Promise<HTMLImageElement> {
  if (typeof src !== 'string') {
    if (src.complete && src.naturalWidth > 0) return Promise.resolve(src);
    return new Promise((resolve, reject) => {
      const onLoad = (): void => {
        cleanup();
        resolve(src);
      };
      const onError = (): void => {
        cleanup();
        reject(new Error('panorama-player: image failed to load'));
      };
      const cleanup = (): void => {
        src.removeEventListener('load', onLoad);
        src.removeEventListener('error', onError);
      };
      src.addEventListener('load', onLoad);
      src.addEventListener('error', onError);
    });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = (): void => resolve(img);
    img.onerror = (): void => reject(new Error(`panorama-player: failed to load ${src}`));
    img.src = src;
  });
}
