// Builds the proof-of-concept GLB farm models (public/models/*.glb) with
// three's GLTFExporter, so the GLB loading path is exercised with real files
// before artists deliver final models. Same names/scale conventions apply to
// artist models (see docs/web/architecture.md, "3D asset conventions").
// Run: pnpm models
import { writeFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// GLTFExporter's binary path uses FileReader, which Node lacks.
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type};base64,${Buffer.from(b).toString("base64")}`;
      this.onloadend?.();
    });
  }
}
(globalThis as unknown as { FileReader: unknown }).FileReader = NodeFileReader;

const mat = (hex: string, roughness = 0.9) => new THREE.MeshStandardMaterial({ color: hex, roughness, metalness: 0, flatShading: true });

function tree(): THREE.Object3D {
  const g = new THREE.Group();
  g.name = "tree";
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.2, 7), mat("#8B5A2B"));
  trunk.name = "trunk";
  trunk.position.y = 1.1;
  g.add(trunk);
  const leaves = mat("#3E9A2A");
  const light = mat("#58B83A");
  for (const [x, y, z, r, m] of [
    [0, 3.0, 0, 1.55, leaves],
    [0.8, 2.6, 0.3, 1.05, light],
    [-0.7, 2.7, -0.4, 1.1, leaves],
    [0.1, 3.9, -0.1, 0.95, light],
  ] as const) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), m);
    blob.name = "leaves";
    blob.position.set(x, y, z);
    g.add(blob);
  }
  return g;
}

function hayBale(): THREE.Object3D {
  const g = new THREE.Group();
  g.name = "hay-bale";
  const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 14), mat("#E8C35A"));
  bale.rotation.z = Math.PI / 2;
  bale.position.y = 0.75;
  g.add(bale);
  for (const x of [-0.35, 0.35]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.77, 0.77, 0.08, 14), mat("#B98B2E"));
    band.rotation.z = Math.PI / 2;
    band.position.set(x, 0.75, 0);
    g.add(band);
  }
  return g;
}

async function exportGlb(obj: THREE.Object3D, file: string) {
  const scene = new THREE.Scene();
  scene.add(obj);
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
  writeFileSync(new URL(`../public/models/${file}`, import.meta.url), Buffer.from(glb));
  console.log(`wrote public/models/${file} (${glb.byteLength} bytes)`);
}

await exportGlb(tree(), "tree.glb");
await exportGlb(hayBale(), "hay-bale.glb");
