/* Compact coloured team header band for the Roster / Stats sub-pages. */
export default function TeamBand({ team, subtitle }: { team: any; subtitle?: string }) {
  const primary = team.primary_color || '#111'
  const secondary = team.secondary_color || primary
  return (
    <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.35))' }} />
      <div className="relative max-w-6xl mx-auto px-4 py-7 flex items-center gap-4">
        {team.logo_url && (
          <img src={team.logo_url} alt="" className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-xl shrink-0" />
        )}
        <div className="min-w-0">
          <h1 className="text-white font-black italic tracking-tight leading-tight drop-shadow-lg" style={{ fontSize: 'clamp(26px, 4.5vw, 44px)' }}>
            {team.name}
          </h1>
          {subtitle && <div className="text-white/80 text-xs font-semibold mt-0.5">{subtitle}</div>}
        </div>
      </div>
    </div>
  )
}
