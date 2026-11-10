"use client";

import { useState } from "react";
import { FocusFrame } from "@/components/focus-stage";
import { ReviewDesk } from "@/components/review-desk";
import type { GameView, Profile } from "@/lib/types";

export function ReviewStage({ game, profile, autoRun }: { game: GameView; profile: Profile; autoRun: boolean }) {
  const [focus, setFocus] = useState(false);
  const [panel, setPanel] = useState(true);
  const exit = () => { setFocus(false); setPanel(true); };
  const title = `${game.whiteName} vs ${game.blackName}`;
  return <FocusFrame active={focus} onExit={exit} panelOpen={panel} onTogglePanel={() => setPanel(v => !v)} title={`Game review · ${title}`}>
    <ReviewDesk
      game={game} profile={profile} autoRun={autoRun}
      onToggleFocus={() => { setFocus(true); setPanel(true); }}
    />
  </FocusFrame>;
}
