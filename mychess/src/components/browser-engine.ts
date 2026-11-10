export type RawLine = { uci: string; san: string; cp: number | null; mate: number | null; pv: string[]; pvSan: string };
type Pending = { resolve: (line: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

class BrowserEngine {
  private worker: Worker | null = null;
  private lines: string[] = [];
  private pending: Pending[] = [];
  private chain: Promise<unknown> = Promise.resolve();
  private ready: Promise<void>;
  private skill = 20;
  failed = false;
  constructor() { this.ready = this.boot(); }
  private fail(error: Error) { this.failed = true; this.pending.splice(0).forEach(item => { clearTimeout(item.timer); item.reject(error); }); this.worker?.terminate(); this.worker = null; }
  private async boot() {
    try {
      this.worker = new Worker("/engine/stockfish-19-lite-single.js");
      this.worker.onmessage = (event: MessageEvent<string>) => { const line = String(event.data); const item = this.pending.shift(); if (item) { clearTimeout(item.timer); item.resolve(line); } else this.lines.push(line); };
      this.worker.onerror = () => this.fail(new Error("Browser engine unavailable"));
      this.send("uci"); await this.until(line => line === "uciok");
      this.send("setoption name MultiPV value 2"); this.send("setoption name Hash value 32"); this.send("isready"); await this.until(line => line === "readyok");
    } catch (error) { this.fail(error instanceof Error ? error : new Error("Engine failed")); }
  }
  private send(command: string) { if (!this.worker) throw new Error("Engine unavailable"); this.worker.postMessage(command); }
  private next(timeout = 30000) {
    const line = this.lines.shift(); if (line) return Promise.resolve(line);
    return new Promise<string>((resolve, reject) => { const timer = setTimeout(() => { this.pending = this.pending.filter(item => item.resolve !== resolve); this.fail(new Error("Engine timed out")); reject(new Error("Engine timed out")); }, timeout); this.pending.push({ resolve, reject, timer }); });
  }
  private async until(test: (line: string) => boolean) { for (let i = 0; i < 600; i += 1) { if (test(await this.next())) return; } throw new Error("Engine did not respond"); }
  private enqueue<T>(task: () => Promise<T>) { const run = this.chain.catch(() => undefined).then(task); this.chain = run.catch(() => undefined); return run; }
  private async ensureSkill(level: number) { if (this.skill === level) return; this.skill = level; this.send(`setoption name Skill Level value ${level}`); this.send("isready"); await this.until(line => line === "readyok"); }
  private parseInfo(line: string) {
    const pv = line.match(/\bpv (.+)$/)?.[1].trim().split(/\s+/); if (!pv) return null;
    const cp = line.match(/\bscore cp (-?\d+)/); const mate = line.match(/\bscore mate (-?\d+)/);
    return { multipv: Number(line.match(/\bmultipv (\d+)/)?.[1] ?? 1), depth: Number(line.match(/\bdepth (\d+)/)?.[1] ?? 0), cp: cp ? Number(cp[1]) : null, mate: mate ? Number(mate[1]) : null, pv };
  }
  analyze(fen: string, depth = 12): Promise<RawLine[]> {
    return this.enqueue(async () => {
      await this.ready; if (this.failed || !this.worker) throw new Error("Browser engine unavailable");
      await this.ensureSkill(20);
      this.send(`position fen ${fen}`); this.send(`go depth ${Math.max(6, Math.min(14, depth))}`);
      const found = new Map<number, ReturnType<BrowserEngine["parseInfo"]>>();
      while (true) {
        const line = await this.next();
        if (line.startsWith("bestmove")) break;
        if (!line.startsWith("info ") || !line.includes(" pv ") || /upperbound|lowerbound/.test(line)) continue;
        const info = this.parseInfo(line); if (!info) continue;
        const previous = found.get(info.multipv); if (!previous || info.depth >= previous.depth) found.set(info.multipv, info);
      }
      return [...found.entries()].sort((a, b) => a[0] - b[0]).map(([, info]) => ({ uci: info!.pv[0] ?? "", san: "", cp: info!.cp, mate: info!.mate, pv: info!.pv, pvSan: "" }));
    });
  }
  play(fen: string, options: { skill: number; movetime: number; depth?: number }): Promise<string | null> {
    return this.enqueue(async () => {
      await this.ready; if (this.failed || !this.worker) throw new Error("Browser engine unavailable");
      await this.ensureSkill(Math.max(0, Math.min(20, options.skill)));
      this.send(`position fen ${fen}`); this.send(options.depth ? `go depth ${options.depth} movetime ${options.movetime}` : `go movetime ${options.movetime}`);
      while (true) { const line = await this.next(); if (line.startsWith("bestmove")) { const move = line.split(/\s+/)[1]; return move && move !== "(none)" ? move : null; } }
    });
  }
}
let engine: BrowserEngine | null = null;
export function getBrowserEngine() { if (!engine || engine.failed) engine = new BrowserEngine(); return engine; }
