// Shared presentational bits for the box score bodies (football + basketball).
import type React from 'react'

export function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a] mb-3 mt-6">
      {title}
    </h3>
  )
}

export function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-black/[0.07] dark:border-white/5 shadow-sm mb-6">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a] bg-[#f7f8fa] dark:bg-[#181818] ${right ? 'text-right' : 'text-left'} first:pl-4 last:pr-4`}>
      {children}
    </th>
  )
}

export function Td({ children, right, bold }: { children: React.ReactNode; right?: boolean; bold?: boolean }) {
  return (
    <td className={`px-3 py-2.5 text-slate-700 dark:text-[#ccc] border-t border-black/[0.04] dark:border-white/[0.04] ${right ? 'text-right tabular-nums' : ''} ${bold ? 'font-semibold text-slate-900 dark:text-white' : ''} first:pl-4 last:pr-4`}>
      {children}
    </td>
  )
}
