/**
 * Fundo oficial da plataforma — replica o background da apresentação da marca:
 * petróleo profundo com grid fino, glows radiais teal e vinheta (tema dark).
 * No tema light é branco 100% puro, sem camadas decorativas.
 * Fica fixo atrás de todo o shell (sidebar + conteúdo).
 */
export function DashboardBackground() {
  return (
    <div
      aria-hidden
      className="dashboard-galaxy pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Grid fino com máscara radial (some nas bordas) — só no dark */}
      <div className="bg-grid-pattern absolute inset-0 hidden [mask-image:radial-gradient(ellipse_75%_65%_at_50%_40%,black_35%,transparent_100%)] dark:block" />

      {/* Glow ciano no topo — só no dark */}
      <div className="absolute left-1/2 top-[-22%] hidden h-[440px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(20,247,254,0.1),transparent)] blur-3xl dark:block" />

      {/* Glow verde na base (horizonte do slide de capa) — só no dark */}
      <div className="absolute bottom-[-32%] left-1/2 hidden h-[540px] w-[960px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(55,250,156,0.08),transparent)] blur-3xl dark:block" />

      {/* Vinheta — só no dark */}
      <div className="absolute inset-0 hidden bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.5)_100%)] dark:block" />
    </div>
  )
}
