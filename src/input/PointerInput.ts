export interface PointerInputCallbacks {
  onDrag: (dxPx: number, dyPx: number) => void;
  onPinch: (scale: number) => void;
}

interface ActivePointer {
  id: number;
  x: number;
  y: number;
}

export class PointerInput {
  private readonly element: HTMLElement;
  private readonly callbacks: PointerInputCallbacks;
  private pointers = new Map<number, ActivePointer>();
  private lastPinchDistance = 0;

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.pointers.size >= 2) return;
    this.element.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      this.lastPinchDistance = this.measurePinchDistance();
    }
    e.preventDefault();
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (this.pointers.size === 1) {
      this.callbacks.onDrag(dx, dy);
    } else if (this.pointers.size === 2) {
      const dist = this.measurePinchDistance();
      if (this.lastPinchDistance > 0 && dist > 0) {
        this.callbacks.onPinch(dist / this.lastPinchDistance);
      }
      this.lastPinchDistance = dist;
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (this.element.hasPointerCapture(e.pointerId)) {
      this.element.releasePointerCapture(e.pointerId);
    }
    this.pointers.delete(e.pointerId);
    this.lastPinchDistance =
      this.pointers.size === 2 ? this.measurePinchDistance() : 0;
  };

  constructor(element: HTMLElement, callbacks: PointerInputCallbacks) {
    this.element = element;
    this.callbacks = callbacks;
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointercancel', this.onPointerUp);
    element.addEventListener('pointerleave', this.onPointerUp);
  }

  private measurePinchDistance(): number {
    const arr = Array.from(this.pointers.values());
    if (arr.length < 2) return 0;
    const a = arr[0]!;
    const b = arr[1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.hypot(dx, dy);
  }

  dispose(): void {
    const e = this.element;
    e.removeEventListener('pointerdown', this.onPointerDown);
    e.removeEventListener('pointermove', this.onPointerMove);
    e.removeEventListener('pointerup', this.onPointerUp);
    e.removeEventListener('pointercancel', this.onPointerUp);
    e.removeEventListener('pointerleave', this.onPointerUp);
    this.pointers.clear();
  }
}
