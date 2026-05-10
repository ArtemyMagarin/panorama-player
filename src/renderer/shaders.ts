export const VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aUV;

uniform mat4 uViewProjection;

out vec2 vUV;

void main() {
  vUV = aUV;
  gl_Position = uViewProjection * vec4(aPosition, 1.0);
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUV;

uniform sampler2D uTexture;

out vec4 outColor;

void main() {
  outColor = texture(uTexture, vUV);
}
`;
