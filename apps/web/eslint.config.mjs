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
];

export default config;
