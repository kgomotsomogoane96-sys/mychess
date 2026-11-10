export const SAMPLE_GAMES = [
  {
    id: "sample-opera",
    youColor: null as "white" | "black" | null,
    source: "sample",
    pgn: `[Event "Opera Game"]
[Site "Paris"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duke & Count"]
[Result "1-0"]
[Opening "Philidor Defense"]
[ECO "C41"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`,
  },
  {
    id: "sample-legal",
    youColor: null as "white" | "black" | null,
    source: "sample",
    pgn: `[Event "Legal's Mate"]
[Site "Paris"]
[Date "1750.??.??"]
[White "Kermur de Legal"]
[Black "Saint-Brie"]
[Result "1-0"]
[Opening "Philidor Defense"]
[ECO "C41"]

1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0`,
  },
  {
    id: "sample-trap",
    youColor: null as "white" | "black" | null,
    source: "sample",
    pgn: `[Event "A trap to remember"]
[Site "MYCHESS"]
[Date "2026.03.02"]
[White "Example player"]
[Black "Example opponent"]
[Result "1-0"]
[WhiteElo "1280"]
[BlackElo "1310"]
[TimeControl "300"]
[Opening "Scholar's mate"]
[ECO "C20"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`,
  },
];
