export function SetupScreen() {
  return <div className="setup-screen">
    <div className="setup-card">
      <div className="setup-mark">♞</div>
      <p className="eyebrow"><span className="status-dot"/>ONE-TIME SETUP</p>
      <h1>MYCHESS needs a database.</h1>
      <p className="lede">The app built and started, but no supported PostgreSQL connection variable is set on this deployment. The app accepts <span className="mono">DATABASE_URL</span> or the common Vercel/Neon names: <span className="mono">POSTGRES_URL</span>, <span className="mono">POSTGRES_PRISMA_URL</span>, <span className="mono">POSTGRES_URL_NON_POOLING</span>, <span className="mono">NEON_DATABASE_URL</span>, or <span className="mono">SUPABASE_DB_URL</span>.</p>
      <ol className="setup-steps">
        <li><strong>Create a managed Postgres database</strong><span>Neon, Supabase, or Vercel Postgres. Do not use the sandbox's <span className="mono">127.0.0.1</span> URL on Vercel. Use the pooled connection string and <span className="mono">?sslmode=require</span> when TLS is required.</span></li>
        <li><strong>Add the environment variables</strong><span>Vercel → Project Settings → Environment Variables → set <span className="mono">DATABASE_URL</span> to the pooled Neon URL and <span className="mono">DATABASE_URL_UNPOOLED</span> (or <span className="mono">POSTGRES_URL_NON_POOLING</span>) to the direct URL. Apply them to <strong>Production</strong>, then <strong>redeploy</strong>. Neon's Vercel integration can set both automatically.</span></li>
        <li><strong>Open the app once</strong><span>The schema is created automatically and the bundled 20,000-game library is restored. No CLI command or migration step is needed.</span></li>
        <li><strong>Reload</strong><span>Check <a className="lime" href="/api/setup">/api/setup</a> for <span className="mono">databaseConfigured: true</span> and <a className="lime" href="/api/health">/api/health</a> for <span className="mono">{'{"ok":true}'}</span>. Settings has a manual restore button if needed.</span></li>
      </ol>
      <div className="setup-note"><strong>No Firebase, no login, no service-account key.</strong> This deployment is open to anyone who knows its URL. Enable Vercel Deployment Protection or a platform-level password if you want it private.</div>
    </div>
  </div>;
}
