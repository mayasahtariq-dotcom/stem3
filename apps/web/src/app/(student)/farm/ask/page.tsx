"use client";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui";
import { AskRoute } from "@/features/learning/AskRoute";

export default function AskPage() {
  return (
    <Suspense fallback={<LoadingState className="h-full" />}>
      <AskRoute />
    </Suspense>
  );
}
