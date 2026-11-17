"use client";
import { RequireSignIn } from "@/features/auth/RequireSignIn";
import { WelcomeScreen, useWelcome } from "@/features/auth/WelcomeScreen";

function Welcome() {
  const vm = useWelcome();
  return <WelcomeScreen state={vm.state} onNameChange={vm.setName} onSubmit={vm.submit} />;
}

export default function WelcomePage() {
  return (
    <RequireSignIn>
      <Welcome />
    </RequireSignIn>
  );
}
