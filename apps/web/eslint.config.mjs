import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "storybook-static/**", "public/mockServiceWorker.js", "playwright-report/**", "test-results/**", "next-env.d.ts"],
  },
  {
    rules: {
      // Three.js / R3F intrinsic elements use props the a11y plugin doesn't know.
      "react/no-unknown-property": "off",
    },
  },
  {
    // The farm worlds mutate three.js objects every frame (materials, uniforms,
    // bones), the standard R3F pattern the React Compiler rules don't model.
    files: ["src/three/worlds/**"],
    rules: { "react-hooks/immutability": "off", "react-hooks/refs": "off" },
  },
];

export default config;
