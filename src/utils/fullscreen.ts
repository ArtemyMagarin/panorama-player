export function isFullscreenAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  return !!(
    document.fullscreenEnabled ||
    (document as any).webkitFullscreenEnabled ||
    (document as any).mozFullScreenEnabled ||
    (document as any).msFullscreenEnabled
  );
}

export function requestFullscreen(element: HTMLElement): Promise<void> {
  if (element.requestFullscreen) {
    return element.requestFullscreen();
  }
  if ((element as any).webkitRequestFullscreen) {
    return (element as any).webkitRequestFullscreen();
  }
  if ((element as any).mozRequestFullScreen) {
    return (element as any).mozRequestFullScreen();
  }
  if ((element as any).msRequestFullscreen) {
    return (element as any).msRequestFullscreen();
  }
  return Promise.reject(new Error('Fullscreen not supported'));
}

export function exitFullscreen(): Promise<void> {
  if (document.exitFullscreen) {
    return document.exitFullscreen();
  }
  if ((document as any).webkitExitFullscreen) {
    return (document as any).webkitExitFullscreen();
  }
  if ((document as any).mozCancelFullScreen) {
    return (document as any).mozCancelFullScreen();
  }
  if ((document as any).msExitFullscreen) {
    return (document as any).msExitFullscreen();
  }
  return Promise.reject(new Error('Fullscreen not supported'));
}

export function isFullscreen(): boolean {
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
}

export function onFullscreenChange(callback: () => void): () => void {
  const events = [
    'fullscreenchange',
    'webkitfullscreenchange',
    'mozfullscreenchange',
    'MSFullscreenChange',
  ];

  events.forEach((event) => {
    document.addEventListener(event, callback);
  });

  return () => {
    events.forEach((event) => {
      document.removeEventListener(event, callback);
    });
  };
}
