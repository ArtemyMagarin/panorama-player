export interface WheelInputCallbacks {
  onWheel: (deltaY: number) => void;
}

export class WheelInput {
  private readonly element: HTMLElement;
  private readonly callbacks: WheelInputCallbacks;

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.callbacks.onWheel(e.deltaY);
  };

  constructor(element: HTMLElement, callbacks: WheelInputCallbacks) {
    this.element = element;
    this.callbacks = callbacks;
    element.addEventListener('wheel', this.onWheel, { passive: false });
  }

  dispose(): void {
    this.element.removeEventListener('wheel', this.onWheel);
  }
}
