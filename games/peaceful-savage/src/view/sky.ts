import { BackSide, Mesh, ShaderMaterial, SphereGeometry } from "three";

// The night sky of the book, painted in one shader on a great dome: deep indigo overhead fading to a teal-blue glow at the horizon, the
// purple and teal swirl of the galaxy across it, stars that twinkle, and a big crescent moon. As colour comes back to the world the
// horizon warms toward rose and gold.
export interface Sky {
  readonly mesh: Mesh;
  update(warmth: number, time: number): void;
}

const vertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w * 0.9999;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uWarm;
  uniform float uTime;
  varying vec3 vDirection;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float value = 0.0;
    float weight = 0.5;
    for (int octave = 0; octave < 5; octave++) {
      value += weight * noise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.1);
      weight *= 0.5;
    }
    return value;
  }
  void main() {
    vec3 d = normalize(vDirection);
    float up = clamp(d.y, -0.2, 1.0);
    vec3 zenith = vec3(0.018, 0.016, 0.075);
    vec3 middle = vec3(0.075, 0.04, 0.2);
    vec3 horizon = mix(vec3(0.11, 0.2, 0.36), vec3(0.62, 0.3, 0.38), uWarm);
    vec3 colour = mix(horizon, middle, smoothstep(-0.02, 0.32, up));
    colour = mix(colour, zenith, smoothstep(0.32, 1.0, up));
    // The galaxy: a band across the sky, swirled.
    vec3 axis = normalize(vec3(0.35, 0.6, -0.72));
    float swirl = fbm(d * 3.2 + vec3(0.0, uTime * 0.004, 0.0));
    float band = 1.0 - abs(dot(d, axis)) + (swirl - 0.5) * 0.38;
    float cloud = smoothstep(0.8, 1.0, band) * (0.55 + swirl * 0.8);
    vec3 purple = vec3(0.42, 0.13, 0.58);
    vec3 teal = vec3(0.08, 0.5, 0.56);
    colour += cloud * mix(purple, teal, smoothstep(0.38, 0.68, fbm(d * 6.0 + 3.0))) * 0.6;
    // Stars, thicker in the galaxy, each twinkling at its own pace.
    vec3 cell = floor(d * 150.0);
    float seed = hash(cell);
    float chance = 0.982 - cloud * 0.03;
    if (seed > chance) {
      vec3 centre = normalize((cell + 0.5) / 150.0);
      float away = length(d - centre) * 150.0;
      float twinkle = 0.55 + 0.45 * sin(uTime * (1.5 + seed * 3.0) + seed * 90.0);
      colour += vec3(1.0, 0.94, 0.82) * smoothstep(0.42, 0.0, away) * twinkle * (0.6 + (seed - chance) * 40.0);
    }
    // The moon, a big crescent, and its halo.
    vec3 moon = normalize(vec3(-0.42, 0.4, -0.81));
    float onMoon = smoothstep(0.99925, 0.99945, dot(d, moon));
    float shade = smoothstep(0.99925, 0.99945, dot(d, normalize(moon + vec3(0.022, 0.012, 0.0))));
    colour += vec3(1.0, 0.95, 0.8) * onMoon * (1.0 - shade) * 2.4;
    colour += vec3(0.55, 0.55, 0.95) * pow(max(dot(d, moon), 0.0), 220.0) * 0.5;
    gl_FragColor = vec4(colour, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function buildSky(): Sky {
  const material = new ShaderMaterial({
    depthWrite: false,
    fog: false,
    fragmentShader,
    side: BackSide,
    uniforms: { uTime: { value: 0 }, uWarm: { value: 0 } },
    vertexShader,
  });
  const mesh = new Mesh(new SphereGeometry(140, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.name = "sky";
  return {
    mesh,
    update(warmth, time) {
      const { uTime, uWarm } = material.uniforms;
      if (uTime !== undefined) uTime.value = time;
      if (uWarm !== undefined) uWarm.value = warmth;
    },
  };
}
