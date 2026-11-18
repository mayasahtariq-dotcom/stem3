"use client";
import { Suspense } from "react";
import { LanguageFirst } from "@/features/onboarding/LanguageFirst";
import { PhoneLoginScreen, usePhoneLogin } from "@/features/auth/PhoneLoginScreen";
import { usePostSignIn } from "@/features/auth/use-post-sign-in";
import { useAppStore } from "@/lib/store/app-store";
import { env } from "@/lib/env";
import { DEMO_PHONES } from "@/features/auth/demo";

function PhoneLogin() {
  const vm = usePhoneLogin(usePostSignIn());
  const role = useAppStore((s) => s.draftRole);
  const setRole = useAppStore((s) => s.setDraftRole);
  return <PhoneLoginScreen role={role} onRoleChange={setRole} demoPhone={env.useFakes && role ? DEMO_PHONES[role] : null} state={vm.state} onPhoneChange={vm.setPhone} onCodeChange={vm.setCode} onSend={vm.send} onVerify={vm.verify} onChangeNumber={vm.changeNumber} />;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LanguageFirst>
        <PhoneLogin />
      </LanguageFirst>
    </Suspense>
  );
}
