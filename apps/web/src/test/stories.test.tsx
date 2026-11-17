import { composeStories, setProjectAnnotations } from "@storybook/react";
import { render } from "@testing-library/react";
import axe from "axe-core";
import preview from "../../.storybook/preview";

setProjectAnnotations(preview);

// Every story file in the design system.
const files = import.meta.glob(["../components/ui/*.stories.tsx", "../features/**/*.stories.tsx"], { eager: true }) as Record<string, Record<string, unknown>>;

/**
 * Phase 1 definition of done: every component has a story that passes axe.
 * jsdom can't compute colour contrast, so contrast is covered by the token
 * contrast test (@mooshala/tokens) and the Playwright axe run on real pages.
 */
describe.each(Object.entries(files))("%s", (_file, mod) => {
  type Composed = Record<string, () => React.ReactElement>;
  const compose = (locale: string) =>
    composeStories(mod as Parameters<typeof composeStories>[0], { ...preview, initialGlobals: { locale } }) as unknown as Composed;
  const byLocale = { hi: compose("hi"), kn: compose("kn") };
  it.each(Object.keys(byLocale.hi))("%s passes axe in Hindi and Kannada", async (name) => {
    for (const locale of ["hi", "kn"] as const) {
      const Story = byLocale[locale][name]!;
      const { container, unmount } = render(<Story />);
      expect(container.closest("body")!.querySelector(`[lang="${locale}"]`)).not.toBeNull();
      await new Promise((r) => setTimeout(r, 0));
      const results = await axe.run(document.body, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
      expect(container.innerHTML.length).toBeGreaterThan(0);
      unmount();
    }
  });
});
