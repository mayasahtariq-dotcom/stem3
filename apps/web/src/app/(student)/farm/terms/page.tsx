"use client";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui";
import { TermsRoute } from "@/features/learning/TermsRoute";

export default function TermsPage() {
  return (
    <Suspense fallback={<LoadingState className="h-full" />}>
      <TermsRoute />
    </Suspense>
  );
}
