"use client";
import { RoleGate } from "@/features/auth/RoleGate";
import { JoinScreen, useJoinScreen } from "./JoinScreen";

function Join({ initialKey }: { initialKey?: string }) {
  return <JoinScreen vm={useJoinScreen(initialKey)} />;
}

/** /join and /join/[key]: students only. */
export function JoinRoute({ initialKey }: { initialKey?: string }) {
  return (
    <RoleGate role="student">
      <Join initialKey={initialKey} />
    </RoleGate>
  );
}
