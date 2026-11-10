"use client";

import { useState } from "react";
import { FocusFrame } from "@/components/focus-stage";
import { PlayDesk } from "@/components/play-desk";
import type { ColorName, Profile } from "@/lib/types";

export function PlayStage({ profile, startFen, label, sourceGameId, rating, youColor }: {
  profile: Profile; startFen: string | null; label: string | null; sourceGameId: string | null; rating: number; youColor: ColorName | null;
}) {
  const [focus, setFocus] = useState(false);
  const [panel, setPanel] = useState(true);
  const exit = () => { setFocus(false); setPanel(true); };
  return <FocusFrame active={focus} onExit={exit} panelOpen={panel} onTogglePanel={() => setPanel(v => !v)} title={label ? `Play it out: ${label}` : "Play the engine"}>
    <PlayDesk
      profile={profile} startFen={startFen} label={label} sourceGameId={sourceGameId} rating={rating} youColor={youColor}
      onToggleFocus={() => { setFocus(true); setPanel(true); }}
    />
  </FocusFrame>;
}
