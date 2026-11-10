"use client";

import { useState } from "react";
import { FocusFrame } from "@/components/focus-stage";
import { PracticeDesk } from "@/components/practice-desk";
import type { DrillView, Profile } from "@/lib/types";

export function PracticeStage({ drills, stats, profile, initialKind, scopeLabel }: {
  drills: DrillView[]; stats: { total: number; mastered: number; due: number; byKind: Record<string, number> }; profile: Profile; initialKind: string; scopeLabel: string;
}) {
  const [focus, setFocus] = useState(false);
  const [panel, setPanel] = useState(true);
  const exit = () => { setFocus(false); setPanel(true); };
  return <FocusFrame active={focus} onExit={exit} panelOpen={panel} onTogglePanel={() => setPanel(v => !v)} title="Practice">
    <PracticeDesk
      drills={drills} stats={stats} profile={profile} initialKind={initialKind} scopeLabel={scopeLabel}
      onToggleFocus={() => { setFocus(true); setPanel(true); }}
    />
  </FocusFrame>;
}
