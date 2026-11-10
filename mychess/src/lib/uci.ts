import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";

export type EngineLine = {
  multipv: number;
  depth: number;
  cp: number | null;
  mate: number | null;
  pv: string[];
};

const ENGINE_PATH = path.join(
  process.cwd(),
  "node_modules/stockfish/bin/stockfish-19-lite-single.js",
);

type Waiter = {
  resolve: (line: string) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

class Session {
  child: ChildProcessWithoutNullStreams;
  buffer = "";
  queue: string[] = [];
  waiters: Waiter[] = [];
  dead = false;

  constructor() {
    this.child = spawn(process.execPath, [ENGINE_PATH], { stdio: ["pipe", "pipe", "pipe"] });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.push(chunk));
    this.child.stderr.on("data", () => undefined);
    this.child.on("exit", () => {
      this.dead = true;
      this.failAll(new Error("Stockfish exited"));
    });
  }

  private push(chunk: string) {
    this.buffer += chunk;
    let index = this.buffer.indexOf("\n");
    while (index >= 0) {
      const line = this.buffer.slice(0, index).replace(/\r$/, "");
      this.buffer = this.buffer.slice(index + 1);
      if (line) {
        const waiter = this.waiters.shift();
        if (waiter) {
          clearTimeout(waiter.timer);
          waiter.resolve(line);
        } else this.queue.push(line);
      }
      index = this.buffer.indexOf("\n");
    }
  }

  private failAll(error: Error) {
    while (this.waiters.length) {
      const waiter = this.waiters.shift();
      if (!waiter) break;
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }

  send(command: string) {
    if (this.dead) throw new Error("Stockfish is not running");
    this.child.stdin.write(`${command}\n`);
  }

  nextLine(timeoutMs = 30000) {
    const queued = this.queue.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.waiters.findIndex((waiter) => waiter.resolve === resolve);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(new Error("Stockfish timed out"));
      }, timeoutMs);
      this.waiters.push({ resolve, reject, timer });
    });
  }

  async until(predicate: (line: string) => boolean, timeoutMs = 20000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const line = await this.nextLine(timeoutMs);
      if (predicate(line)) return line;
    }
    throw new Error("Stockfish did not answer");
  }

  async analyze(fen: string, depth: number): Promise<EngineLine[]> {
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    const found = new Map<number, EngineLine>();
    const started = Date.now();
    while (Date.now() - started < 28000) {
      const line = await this.nextLine(28000);
      if (line.startsWith("bestmove")) break;
      if (!line.startsWith("info ") || !line.includes(" pv ") || !line.includes(" score ")) continue;
      if (line.includes("upperbound") || line.includes("lowerbound")) continue;
      const depthMatch = line.match(/\bdepth (\d+)/);
      const multipvMatch = line.match(/\bmultipv (\d+)/);
      const cpMatch = line.match(/\bscore cp (-?\d+)/);
      const mateMatch = line.match(/\bscore mate (-?\d+)/);
      const pvMatch = line.match(/\bpv (.+)$/);
      if (!pvMatch) continue;
      const parsed: EngineLine = {
        multipv: multipvMatch ? Number(multipvMatch[1]) : 1,
        depth: depthMatch ? Number(depthMatch[1]) : depth,
        cp: cpMatch ? Number(cpMatch[1]) : null,
        mate: mateMatch ? Number(mateMatch[1]) : null,
        pv: pvMatch[1].trim().split(/\s+/),
      };
      const previous = found.get(parsed.multipv);
      if (!previous || parsed.depth >= previous.depth) found.set(parsed.multipv, parsed);
    }
    return [...found.values()].sort((a, b) => a.multipv - b.multipv);
  }

  stop() {
    try {
      this.send("stop");
    } catch {
      this.dead = true;
    }
  }

  quit() {
    try {
      this.send("quit");
    } catch {
      /* already gone */
    }
    this.child.kill();
    this.dead = true;
  }
}

type GlobalEngine = {
  session: Session | null;
  chain: Promise<unknown>;
  busy: string | null;
};

const globalEngine = globalThis as typeof globalThis & { __hearthlineEngine?: GlobalEngine };

function state() {
  if (!globalEngine.__hearthlineEngine) {
    globalEngine.__hearthlineEngine = { session: null, chain: Promise.resolve(), busy: null };
  }
  return globalEngine.__hearthlineEngine;
}

async function init(session: Session) {
  session.send("uci");
  await session.until((line) => line === "uciok");
  session.send("setoption name MultiPV value 2");
  session.send("setoption name Hash value 32");
  session.send("isready");
  await session.until((line) => line === "readyok");
}

export function engineBusy() {
  return state().busy;
}

export function withEngine<T>(label: string, fn: (session: Session) => Promise<T>) {
  const current = state();
  const run = current.chain.then(async () => {
    current.busy = label;
    try {
      if (!current.session || current.session.dead) {
        current.session = new Session();
        await init(current.session);
      }
      return await fn(current.session);
    } catch (error) {
      current.session?.quit();
      current.session = null;
      throw error;
    } finally {
      current.busy = null;
    }
  });
  current.chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function newGame(session: Session) {
  session.send("ucinewgame");
  session.send("isready");
  await session.until((line) => line === "readyok");
}
