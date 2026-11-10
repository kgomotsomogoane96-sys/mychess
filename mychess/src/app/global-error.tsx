"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body style={{ margin: 0, background: "#0a0c0b", color: "#f4f6f3", fontFamily: "system-ui, sans-serif", minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
    <div style={{ maxWidth: 560, padding: 32, border: "1px solid #303a32", borderRadius: 18, background: "#141815" }}>
      <p style={{ color: "#63f45b", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>MYCHESS</p>
      <h1 style={{ fontSize: 32, margin: "8px 0 12px", fontWeight: 500 }}>The app couldn't start.</h1>
      <p style={{ color: "#9dada1", lineHeight: 1.7, fontSize: 14 }}>Set <code>DATABASE_URL</code> or a supported <code>POSTGRES_URL</code>/<code>NEON_DATABASE_URL</code> variable on this deployment and redeploy. The schema and bundled library restore automatically on first load. No Firebase or CLI setup is required.</p>
      <button onClick={reset} style={{ marginTop: 18, padding: "12px 18px", borderRadius: 9, border: 0, background: "#63f45b", color: "#0b210e", fontWeight: 600, cursor: "pointer" }}>Try again</button>
    </div>
  </body></html>;
}
