import type { Team } from '@/lib/supabase/types'
import Image from 'next/image'

type Props = {
  team: Team
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
}

const sizes = { sm: 28, md: 40, lg: 64 }
const textSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-lg' }

export default function TeamBadge({ team, size = 'md', showName = false }: Props) {
  const px = sizes[size]
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
