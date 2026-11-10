import { analyzePgn } from "@/lib/analyze";
import { makeDrills } from "@/lib/learning-drills";
import { ensureProfile, markGameStatus, nextQueued, queueCounts, replaceDrills, resetStuckAnalysis, saveAnalysis } from "@/lib/store";
import type { WorkerStatus } from "@/lib/types";

type WorkerState = { running: boolean; paused: boolean; currentId: string | null; currentLabel: string | null; done: number; failed: number; durations: number[]; startedAt: Date | null; manualWaiting: number };
const globalWorker = globalThis as typeof globalThis & { __mychessWorker?: WorkerState };
function state(): WorkerState {
  if (!globalWorker.__mychessWorker) globalWorker.__mychessWorker = { running: false, paused: false, currentId: null, currentLabel: null, done: 0, failed: 0, durations: [], startedAt: null, manualWaiting: 0 };
  return globalWorker.__mychessWorker;
}

export function manualPriority(delta: number) { state().manualWaiting = Math.max(0, state().manualWaiting + delta); }
export function pauseWorker() { state().paused = true; }
export async function workerStatus(accountIds: string[] | null): Promise<WorkerStatus> {
  const current = state();
  const counts = await queueCounts(accountIds);
  const average = current.durations.length ? current.durations.reduce((a, b) => a + b, 0) / current.durations.length : null;
  return { running: current.running, paused: current.paused, currentId: current.currentId, currentLabel: current.currentLabel, done: current.done, failed: current.failed, averageSeconds: average ? Math.round(average) : null, queued: counts.queued + counts.analyzing, analyzed: counts.analyzed, imported: counts.imported, startedAt: current.startedAt?.toISOString() ?? null };
}

export function startWorker() {
  const current = state();
  current.paused = false;
  if (current.running) return;
  current.running = true;
  current.startedAt = new Date();
  void (async () => {
    try {
      while (!current.paused) {
        if (current.manualWaiting > 0) { await new Promise(resolve => setTimeout(resolve, 1000)); continue; }
        const game = await nextQueued();
        if (!game) break;
        current.currentId = game.id; current.currentLabel = `${game.whiteName} vs ${game.blackName}`;
        await markGameStatus(game.id, "analyzing");
        const started = Date.now();
        try {
          const profile = await ensureProfile();
          const analysis = await analyzePgn({ pgn: game.pgn, depth: profile.bulkDepth, profile, youColor: game.youColor, opponent: game.youColor === "white" ? game.blackName : game.whiteName });
          await saveAnalysis(game.id, analysis);
          await replaceDrills(game.id, game.accountId, makeDrills(analysis.moves, game.youColor, profile.focus));
          current.done += 1;
          current.durations = [...current.durations.slice(-19), (Date.now() - started) / 1000];
        } catch (error) {
          current.failed += 1;
          await markGameStatus(game.id, "failed", error instanceof Error ? error.message : "Analysis failed");
        }
        current.currentId = null; current.currentLabel = null;
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    } finally {
      current.running = false; current.currentId = null; current.currentLabel = null;
    }
  })();
}

export async function resumeWorker() {
  try { await resetStuckAnalysis(); const counts = await queueCounts(null); if (counts.queued > 0) startWorker(); } catch { /* database not ready yet; the next request will resume */ }
}
