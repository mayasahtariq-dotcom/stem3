"use client";
import type { FieldId } from "@/lib/world/fields";
import type { QualitySettings } from "../../engine/quality";
import type { Wrap } from "./common";
import { BlossomMeadow, GoldenValley, MountainParadise, WoodlandFarm } from "./OtherFields";
import { StarterMeadow } from "./StarterMeadow";

export function FieldDressing({ field, quality, reducedMotion, growth, wrap }: { field: FieldId; quality: QualitySettings; reducedMotion?: boolean; growth: number; wrap?: Wrap }) {
  switch (field) {
    case "starter-meadow":
      return <StarterMeadow quality={quality} reducedMotion={reducedMotion} growth={growth} wrap={wrap} />;
    case "blossom-meadow":
      return <BlossomMeadow quality={quality} reducedMotion={reducedMotion} />;
    case "golden-valley":
      return <GoldenValley quality={quality} reducedMotion={reducedMotion} />;
    case "woodland-farm":
      return <WoodlandFarm quality={quality} reducedMotion={reducedMotion} />;
    case "mountain-paradise":
      return <MountainParadise quality={quality} reducedMotion={reducedMotion} />;
  }
}
