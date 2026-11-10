export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build" || process.env.VERCEL) return;
  setTimeout(() => { void import("@/lib/worker").then(module => module.resumeWorker()).catch(() => undefined); }, 4000);
}
