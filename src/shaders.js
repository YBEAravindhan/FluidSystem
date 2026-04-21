const baseVertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

export default {
  splat: [
    baseVertex,
    `
    precision highp float;
    varying vec2 vUv;

    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform float radius;
    uniform vec3 color;
    uniform vec2 point;

    void main() {
      vec2 p = vUv - point;
      p.x *= aspectRatio;
      vec3 splat = exp(-dot(p, p) / radius) * color;
      vec3 base = texture2D(uTarget, vUv).xyz;
      gl_FragColor = vec4(base + splat, 1.0);
    }
    `,
  ],

  advection: [
    baseVertex,
    `
    precision highp float;
    varying vec2 vUv;

    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform float dt;
    uniform float dissipation;

    void main() {
      vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
      gl_FragColor = vec4(dissipation * texture2D(uSource, coord).rgb, 1.0);
    }
    `,
  ],

  display: [
    baseVertex,
    `
    precision highp float;
    varying vec2 vUv;

    uniform sampler2D uTexture;

    void main() {
      vec3 c = texture2D(uTexture, vUv).rgb;
      gl_FragColor = vec4(c, 1.0);
    }
    `,
  ],

  // minimal placeholders so simulation doesn't crash
  divergence: [baseVertex, `void main(){gl_FragColor=vec4(0.0);}`],
  curl: [baseVertex, `void main(){gl_FragColor=vec4(0.0);}`],
  vorticity: [baseVertex, `void main(){gl_FragColor=vec4(0.0);}`],
  pressure: [baseVertex, `void main(){gl_FragColor=vec4(0.0);}`],
  gradientSubtract: [baseVertex, `void main(){gl_FragColor=vec4(0.0);}`],
  clear: [baseVertex, `void main(){gl_FragColor=vec4(0.0);}`],
};