import type { View } from '../types.js';
import { degToRad } from '../utils/clamp.js';
import {
  type Mat4,
  create,
  identity,
  multiply,
  perspective,
  rotationX,
  rotationY,
} from './mat4.js';

const tmpProj = create();
const tmpRotX = create();
const tmpRotY = create();
const tmpView = create();

export function buildViewProjection(view: View, aspect: number, out: Mat4 = create()): Mat4 {
  perspective(degToRad(view.fov), aspect, 0.1, 100, tmpProj);
  rotationX(degToRad(-view.pitch), tmpRotX);
  rotationY(degToRad(-view.yaw), tmpRotY);
  multiply(tmpRotX, tmpRotY, tmpView);
  multiply(tmpProj, tmpView, out);
  return out;
}

export const _internal = { identity };
