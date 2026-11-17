"use client";
import { Suspense } from "react";
import { SchoolLoginScreen, useSchoolLogin } from "@/features/auth/SchoolLoginScreen";
import { usePostSignIn } from "@/features/auth/use-post-sign-in";

function SchoolLogin() {
  const vm = useSchoolLogin(usePostSignIn());
  return <SchoolLoginScreen state={vm.state} onKeyChange={vm.setKey} onNameChange={vm.setName} onSubmit={vm.submit} />;
}

export default function SchoolLoginPage() {
  return (
    <Suspense>
      <SchoolLogin />
    </Suspense>
  );
}
