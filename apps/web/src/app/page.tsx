import { EntryGate } from "@/features/auth/EntryGate";

/** "/" decides where to go: onboarding, login, or the role's home. */
export default function Home() {
  return <EntryGate />;
}
