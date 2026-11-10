import {
  AdditiveBlending,
  MeshStandardMaterial,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from "three";

// Small changes to the materials Blender made, done in their shaders as three.js compiles them: water that moves, ice that glints, an
// aurora that ripples, a ram of light with scanlines, a miner's spirit that breathes, crystals that pulse. Every one reads the same two
// numbers, the time and how deep frost vision is, which the screen sets once a frame.
export const shaderTime = { value: 0 };
export const visionDepth = { value: 0 };

type Patch = (shader: WebGLProgramParametersWithUniforms) => void;

// The packer stores each mesh's points scaled into a small box and sets the scale back on the mesh, so a move made in the mesh's own
// space must be divided by that scale to be the size it means in the world.
const unitScale = "length(modelMatrix[1].xyz)";

const worldVarying =
  "varying vec3 vWorldPos;\nuniform float uTime;\nuniform float uVision;\n";

function patch(
  material: MeshStandardMaterial,
  key: string,
  vertex: string,
  fragment: string,
  extra?: Patch,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shaderTime;
    shader.uniforms.uVision = visionDepth;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${worldVarying}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${vertex}`)
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${worldVarying}`)
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>\n${fragment}`,
      );
    extra?.(shader);
  };
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
}

const glint = `
  vec2 cell = floor(vWorldPos.xz * 7.0);
  float seed = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
  float twinkle = step(0.991, seed) * max(0.0, sin(uTime * 2.4 + seed * 60.0));
  totalEmissiveRadiance += vec3(0.75, 0.95, 1.0) * twinkle * 1.4;
  float lines = step(0.94, fract(vWorldPos.x * 0.5)) + step(0.94, fract(vWorldPos.z * 0.5));
  totalEmissiveRadiance += vec3(0.12, 0.42, 0.75) * uVision * (0.18 + 0.5 * min(lines, 1.0));
`;

export function frostIce(material: MeshStandardMaterial): void {
  patch(material, "frost-ice", "", glint);
}

export function water(material: MeshStandardMaterial): void {
  // Night water: dark, a little glassy, its crests catching the moon.
  material.flatShading = true;
  material.color.set("#0c2230");
  material.roughness = 0.55;
  material.metalness = 0;
  patch(
    material,
    "frost-water",
    `
    vec4 placed = modelMatrix * vec4(transformed, 1.0);
    float swell = sin(placed.x * 0.55 + uTime * 1.1) * 0.09 + sin(placed.z * 0.8 - uTime * 1.4) * 0.07
      + sin((placed.x + placed.z) * 1.7 + uTime * 2.1) * 0.025;
    transformed.y += swell / ${unitScale};
    `,
    `
    float crest = smoothstep(-0.2, -0.12, vWorldPos.y);
    totalEmissiveRadiance += vec3(0.18, 0.45, 0.6) * crest * 0.35 + vec3(0.05, 0.2, 0.35) * uVision;
    `,
  );
}

// The aurora is light and nothing else: its curtains are painted in Blender (black where they are clear), and the game adds that paint
// to the sky, in rays that drift, with no moonlight or fog on it. Where frost vision holds it burns brighter.
export function aurora(material: MeshStandardMaterial): void {
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;
  material.fog = false;
  patch(
    material,
    "frost-aurora",
    `
    vec4 placed = modelMatrix * vec4(transformed, 1.0);
    transformed.x += sin(placed.y * 0.4 + uTime * 0.5) * 0.6 / ${unitScale};
    transformed.z += cos(placed.y * 0.3 + uTime * 0.37) * 0.4 / ${unitScale};
    `,
    `
    float rays = 0.62 + 0.38 * sin(vWorldPos.x * 1.3 + vWorldPos.z * 1.1 + 2.0 * sin(vWorldPos.y * 0.2 + uTime * 0.31));
    float band = 0.75 + 0.25 * sin(vWorldPos.x * 0.18 + uTime * 0.6) * sin(vWorldPos.y * 0.5 - uTime * 0.9);
    totalEmissiveRadiance = vColor.rgb * rays * band * (1.5 + uVision);
    `,
    (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "outgoingLight = totalEmissiveRadiance;\n#include <opaque_fragment>",
      );
    },
  );
}

const fresnel =
  "pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2)";

export function holo(material: MeshStandardMaterial): void {
  patch(
    material,
    "frost-holo",
    "",
    `
    float scan = 0.65 + 0.35 * sin(vWorldPos.y * 70.0 - uTime * 7.0);
    float rim = ${fresnel};
    vec3 shift = 0.5 + 0.5 * cos(uTime * 0.8 + vWorldPos.y * 3.0 + vec3(0.0, 2.1, 4.2));
    totalEmissiveRadiance = totalEmissiveRadiance * scan + mix(vec3(0.2, 0.9, 1.0), shift, 0.5) * rim * 1.3;
    `,
  );
}

export function spirit(material: MeshStandardMaterial): void {
  material.transparent = true;
  material.opacity = 0.9;
  patch(
    material,
    "frost-spirit",
    "",
    `
    float breath = 0.82 + 0.24 * sin(uTime * 2.0 + vWorldPos.y * 4.0);
    totalEmissiveRadiance = totalEmissiveRadiance * breath + vec3(0.55, 0.85, 1.0) * ${fresnel} * 0.9;
    `,
  );
}

export function pulse(
  material: MeshStandardMaterial,
  key: string,
  rate: number,
  depth: number,
): void {
  patch(
    material,
    key,
    "",
    `totalEmissiveRadiance *= ${(1 - depth).toFixed(2)} + ${depth.toFixed(2)} * (0.5 + 0.5 * sin(uTime * ${rate.toFixed(2)} + vWorldPos.x * 1.3 + vWorldPos.z));`,
  );
}

// A material's standard face, if it is the kind Blender's exporter makes.
export const standard = (material: Material): MeshStandardMaterial | null =>
  material instanceof MeshStandardMaterial ? material : null;
