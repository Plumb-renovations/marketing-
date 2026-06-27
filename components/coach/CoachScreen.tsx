"use client";

import { Compass } from "lucide-react";
import { SectionHeader } from "@/components/ui/primitives";
import CoachPanel from "@/components/coach/CoachPanel";
import AskHazel from "@/components/coach/AskHazel";

export default function CoachScreen() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Compass}
        title="Marketing Coach"
        desc="Hazel reviews your real account like a top media buyer — the few things that matter most right now — then answers anything you ask."
      />
      <CoachPanel />
      <AskHazel />
    </div>
  );
}
