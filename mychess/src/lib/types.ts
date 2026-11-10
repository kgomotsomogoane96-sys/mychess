export const CLASS_NAMES = ["brilliant", "great", "best", "excellent", "good", "book", "inaccuracy", "mistake", "miss", "blunder"] as const;
export type ClassName = (typeof CLASS_NAMES)[number];
export type Side = "w" | "b";
export type ColorName = "white" | "black";
export type BoardThemeName = "neon" | "walnut" | "ink" | "sage" | "ice";
export type PieceSetName = "chessnut" | "merida" | "cburnett";
export type CoachTone = "patient" | "direct" | "sharp";
export type StudyFocus = "all" | "tactics" | "openings" | "endgames";
export type Phase = "opening" | "middlegame" | "endgame";
export type Platform = "chesscom" | "lichess";
export type DrillKind = "find_win" | "punish" | "defend" | "endgame" | "opening" | "improve";

export type MoveFeatures = { hung: boolean; missedCapture: boolean; missedMate: boolean; missedCheck: boolean; missedCastle: boolean };
export type EngineLineView = { uci: string; san: string; cp: number | null; mate: number | null; pvSan: string };
export type AnalyzedMove = {
  ply: number; san: string; uci: string; color: Side; piece: string; fenBefore: string; fenAfter: string;
  evalBefore: number; evalAfter: number; mateBefore: number | null; mateAfter: number | null;
  bestUci: string; bestSan: string; lines: EngineLineView[]; cpLoss: number; winBefore: number; winAfter: number;
  accuracy: number; classification: ClassName; sacrifice: boolean; forced: boolean; phase: Phase; features: MoveFeatures; themes: string[];
};
export type PositionTail = { fen: string; evalWhite: number; mate: number | null; lines: EngineLineView[] };
export type KeyMoment = { ply: number; classification: ClassName; san: string; color: Side; comment: string };
export type PhaseAccuracy = { opening: { w: number | null; b: number | null }; middlegame: { w: number | null; b: number | null }; endgame: { w: number | null; b: number | null } };
export type GameSummary = {
  model: "hearthline-winpercent-v1";
  counts: Record<ClassName, { w: number; b: number }>;
  phaseAccuracy: PhaseAccuracy;
  lessons: string[];
  headline: string;
  keyMoments: KeyMoment[];
  yourLeak: string | null;
  themeCounts?: { w: Record<string, number>; b: Record<string, number> };
};

export type AccountRatings = Partial<Record<"bullet" | "blitz" | "rapid" | "daily" | "puzzles", { rating: number; best?: number | null; wins?: number; losses?: number; draws?: number }>>;
export type AccountView = {
  id: string; platform: Platform; username: string; displayName: string; avatarUrl: string | null; country: string | null; joinedAt: string | null;
  ratings: AccountRatings; totalGames: number; importedGames: number; lastSyncedAt: string | null; syncStatus: string; syncMessage: string;
};

export type Profile = {
  displayName: string; chesscom: string; lichess: string; rating: number; depth: number; bulkDepth: number; boardTheme: BoardThemeName; pieceSet: PieceSetName;
  coachTone: CoachTone; focus: StudyFocus; sound: boolean; showArrows: boolean; activeAccountId: string | null;
};

export type GameView = {
  id: string; source: string; externalUrl: string | null; accountId: string | null; whiteName: string; blackName: string; whiteRating: number | null; blackRating: number | null;
  result: string; youColor: ColorName | null; opening: string; openingFamily: string; eco: string | null; timeControl: string | null; speed: string | null; rated: boolean;
  termination: string | null; yourResult: string | null; oppResult: string | null; endgameType: string | null; endgameStartPly: number | null; endgameDiff: number | null;
  platformAccuracy: number | null; event: string | null; site: string | null; playedAt: string | null; pgn: string; initialFen: string; plyCount: number; status: string;
  analysisError: string | null; depth: number | null; accuracyWhite: number | null; accuracyBlack: number | null; acplWhite: number | null; acplBlack: number | null;
  estimatedWhite: number | null; estimatedBlack: number | null; summary: GameSummary | null; moves: AnalyzedMove[] | null; tail: PositionTail | null; notes: string;
  createdAt: string; analyzedAt: string | null;
};
export type GameListItem = Omit<GameView, "pgn" | "moves" | "tail" | "notes" | "initialFen" | "summary">;

export type DrillView = {
  id: string; gameId: string; accountId: string | null; kind: DrillKind; found: boolean; ply: number; fen: string; solution: string; solutionSan: string; playedSan: string;
  prompt: string; theme: string; classification: string; attempts: number; solved: number; lastResult: string | null; whiteName: string; blackName: string; opening: string; playedAt: string | null;
};

export type CompactGame = {
  id: string; accountId: string | null; source: string; youColor: ColorName | null; result: string; speed: string | null; rated: boolean;
  openingFamily: string; opening: string; openingLine: string; eco: string | null; yourResult: string | null; oppResult: string | null; termination: string | null;
  endgameType: string | null; endgameStartPly: number | null; endgameDiff: number | null; whiteCastledPly: number | null; blackCastledPly: number | null;
  whiteRating: number | null; blackRating: number | null; platformAccuracy: number | null; playedAt: string | null; plyCount: number; status: string;
  accuracyWhite: number | null; accuracyBlack: number | null; acplWhite: number | null; acplBlack: number | null; summary: GameSummary | null;
};

export type PlanItem = { id: string; area: "openings" | "endgames" | "tactics" | "time" | "habits" | "engine"; title: string; why: string; action: { label: string; href: string }; metric: string; severity: number };
export type ScoreRow = { key: string; label: string; games: number; wins: number; draws: number; losses: number; score: number; accuracy: number | null; extra?: Record<string, number | null> };
export type OpeningFamilyRow = ScoreRow & { color: ColorName; eco: string | null; analyzed: number; lastPlayed: string | null };
export type OpeningNode = { san: string; games: number; wins: number; draws: number; losses: number; children: OpeningNode[] };
export type WorkerStatus = { running: boolean; paused: boolean; currentId: string | null; currentLabel: string | null; done: number; failed: number; averageSeconds: number | null; queued: number; analyzed: number; imported: number; startedAt: string | null };

export type ReferenceGame = {
  id: string; externalUrl: string | null; source: string; whiteName: string; blackName: string; whiteElo: number | null; blackElo: number | null; era?: string | null; tier?: string | null; story?: string | null;
  result: string; opening: string; openingFamily: string; eco: string | null; event: string | null; speed: string | null; playedAt: string | null;
  pgn: string; initialFen: string; midgameFen: string; midgamePly: number; plyCount: number; tags: string[];
};
export type TheoryProgressView = { uid: string; moduleId: string; correct: number; attempts: number; bestScore: number; notes: string; completedAt: string };
export type TheoryDay = { key: string; moduleId: string; title: string; promise: string; category: string };
