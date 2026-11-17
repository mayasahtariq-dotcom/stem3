import * as THREE from "three";

/** One clock for every swaying material, advanced by <WindTicker>. */
export const WIND = { uTime: { value: 0 }, uStrength: { value: 1 } };

/**
 * Adds a gentle sway to a material: vertices move more the higher they are
 * above the model's base, with a phase that varies across the world so a
 * meadow ripples instead of moving in lockstep.
 */
export function addSway(material: THREE.Material, amount: number, height: number) {
  const mat = material as THREE.Material & { userData: Record<string, unknown> };
  if (mat.userData.swayed) return;
  mat.userData.swayed = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.uWindTime = WIND.uTime;
    shader.uniforms.uWindStrength = WIND.uStrength;
    shader.uniforms.uSwayAmount = { value: amount };
    shader.uniforms.uSwayHeight = { value: Math.max(0.01, height) };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWindTime; uniform float uWindStrength; uniform float uSwayAmount; uniform float uSwayHeight;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec4 wp = modelMatrix * vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
          #endif
          float k = clamp(transformed.y / uSwayHeight, 0.0, 1.5);
          k = k * k;
          float phase = wp.x * 0.21 + wp.z * 0.17;
          float s = sin(uWindTime * 1.6 + phase) * 0.7 + sin(uWindTime * 2.9 + phase * 1.7) * 0.3;
          transformed.x += s * uSwayAmount * uSwayHeight * k * uWindStrength;
          transformed.z += cos(uWindTime * 1.3 + phase) * 0.5 * uSwayAmount * uSwayHeight * k * uWindStrength;
        }`,
      );
  };
  mat.customProgramCacheKey = () => `sway-${amount.toFixed(3)}-${height.toFixed(2)}`;
  mat.needsUpdate = true;
}
