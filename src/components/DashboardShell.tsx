"use client";

import { TutorialProvider } from "@/contexts/TutorialContext";
import TutorialOverlay from "./TutorialOverlay";
import OnboardingModal from "./OnboardingModal";

interface Props {
  userId: string;
  children: React.ReactNode;
}

export default function DashboardShell({ userId, children }: Props) {
  return (
    <TutorialProvider userId={userId}>
      {children}
      <OnboardingModal userId={userId} />
      <TutorialOverlay />
    </TutorialProvider>
  );
}
