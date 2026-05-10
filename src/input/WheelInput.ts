export interface WheelInputCallbacks {
  onWheel: (deltaY: number) => void;
  onWheelRejected?: () => void;
}

export class WheelInput {
  private readonly element: HTMLElement;
  private readonly callbacks: WheelInputCallbacks;
  private requireModifier: boolean;

  private readonly onWheelEvent = (e: WheelEvent): void => {
    const hasModifier = e.ctrlKey || e.metaKey;
    if (this.requireModifier && !hasModifier) {
      this.callbacks.onWheelRejected?.();
      return;
    }
    e.preventDefault();
    this.callbacks.onWheel(e.deltaY);
  };

  constructor(element: HTMLElement, callbacks: WheelInputCallbacks, requireModifier = true) {
    this.element = element;
    this.callbacks = callbacks;
    this.requireModifier = requireModifier;
    element.addEventListener('wheel', this.onWheelEvent, { passive: false });
  }

  dispose(): void {
    this.element.removeEventListener('wheel', this.onWheelEvent);
  }
}
