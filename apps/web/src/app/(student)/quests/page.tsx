"use client";
import { GoluMascot } from "@/components/game";
import { QuestList } from "@/components/QuestList";
import { BilingualText, Card } from "@/components/ui";
import { useT } from "@/lib/i18n";

export default function Quests() {
  const { bi } = useT();
  const h = bi("quests.title");
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-4"><GoluMascot size={90} /><BilingualText as="h1" size="xl" regional={h.regional} english={h.english} /></div>
      <Card><QuestList /></Card>
    </div>
  );
}
