/**
 * @jest-environment jsdom
 */
import { WheelInput } from '../../src/input/WheelInput.js';

describe('WheelInput', () => {
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
  });

  afterEach(() => {
    document.body.removeChild(element);
  });

  test('with modifier required: consumes wheel when Ctrl held', () => {
    const onWheel = jest.fn();
    const onRejected = jest.fn();
    const input = new WheelInput(element, { onWheel, onWheelRejected: onRejected }, true);

    const event = new WheelEvent('wheel', { deltaY: 100, ctrlKey: true, cancelable: true });
    const preventedSpy = jest.spyOn(event, 'preventDefault');

    element.dispatchEvent(event);

    expect(onWheel).toHaveBeenCalledWith(100);
    expect(onRejected).not.toHaveBeenCalled();
    expect(preventedSpy).toHaveBeenCalled();

    input.dispose();
  });

  test('with modifier required: consumes wheel when Cmd held (Mac)', () => {
    const onWheel = jest.fn();
    const input = new WheelInput(element, { onWheel }, true);

    const event = new WheelEvent('wheel', { deltaY: -50, metaKey: true });
    jest.spyOn(event, 'preventDefault');

    element.dispatchEvent(event);

    expect(onWheel).toHaveBeenCalledWith(-50);

    input.dispose();
  });

  test('with modifier required: rejects wheel without modifier', () => {
    const onWheel = jest.fn();
    const onRejected = jest.fn();
    const input = new WheelInput(element, { onWheel, onWheelRejected: onRejected }, true);

    const event = new WheelEvent('wheel', { deltaY: 100, ctrlKey: false, metaKey: false });
    jest.spyOn(event, 'preventDefault');

    element.dispatchEvent(event);

    expect(onRejected).toHaveBeenCalled();
    expect(onWheel).not.toHaveBeenCalled();

    input.dispose();
  });

  test('with modifier disabled: consumes wheel regardless of modifier', () => {
    const onWheel = jest.fn();
    const onRejected = jest.fn();
    const input = new WheelInput(element, { onWheel, onWheelRejected: onRejected }, false);

    const event = new WheelEvent('wheel', { deltaY: 100, ctrlKey: false });
    jest.spyOn(event, 'preventDefault');

    element.dispatchEvent(event);

    expect(onWheel).toHaveBeenCalledWith(100);
    expect(onRejected).not.toHaveBeenCalled();

    input.dispose();
  });

  test('dispose removes event listener', () => {
    const onWheel = jest.fn();
    const input = new WheelInput(element, { onWheel }, true);

    input.dispose();

    const event = new WheelEvent('wheel', { deltaY: 100, ctrlKey: true });
    element.dispatchEvent(event);

    expect(onWheel).not.toHaveBeenCalled();
  });
});
