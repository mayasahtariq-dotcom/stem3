"use client";
import { MyClassesCard } from "@/features/classroom/MyClassesCard";
import { GrowthAndBadgesRoute } from "@/features/game/routes";
import { ProfileRoute } from "@/features/learning/ProfileRoute";
import { ParentLinkCard } from "@/features/parent/ParentLinkCard";

export default function ProfilePage() {
  return (
    <ProfileRoute>
      <GrowthAndBadgesRoute />
      <MyClassesCard />
      <ParentLinkCard />
    </ProfileRoute>
  );
}
