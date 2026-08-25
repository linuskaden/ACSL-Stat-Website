import type { Team } from '@/lib/supabase/types'
import Image from 'next/image'

type Props = {
  team: Team | null | undefined
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
}

const sizes = { sm: 28, md: 40, lg: 64 }
const textSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-lg' }

export default function TeamBadge({ team, size = 'md', showName = false }: Props) {
  const px = sizes[size]

  // No team yet (e.g. a playoff placeholder / TBD slot) — neutral chip
  if (!team) {
    return (
      <div className="flex items-center gap-2">
        <div
          style={{ width: px, height: px }}
          className="rounded-lg flex items-center justify-center shrink-0 bg-black/[0.06] dark:bg-white/[0.06] text-slate-400 dark:text-[#555]"
        >
          <span className="font-black" style={{ fontSize: px * 0.4 }}>?</span>
        </div>
        {showName && (
          <span className={`font-semibold text-slate-400 dark:text-[#555] ${textSizes[size]}`}>TBD</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {team.logo_url ? (
        // Plain logo — no background circle, for a cleaner look
        <Image
          src={team.logo_url}
          alt={team.name}
          width={px}
          height={px}
          className="object-contain shrink-0"
          style={{ width: px, height: px }}
        />
      ) : (
        // Fallback only when a team has no logo: initials on a colour chip
        <div
          style={{ width: px, height: px, background: team.primary_color }}
          className="rounded-lg flex items-center justify-center overflow-hidden shrink-0"
        >
          <span className="font-black text-white" style={{ fontSize: px * 0.35 }}>
            {team.university.slice(0, 2)}
          </span>
        </div>
      )}
      {showName && (
        <span className={`font-semibold text-slate-900 dark:text-white ${textSizes[size]}`}>{team.name}</span>
      )}
    </div>
  )
}
