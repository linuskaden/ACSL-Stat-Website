'use client'

export default function DeletePlayerButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={e => {
        if (!confirm('Delete this player? This cannot be undone.')) e.preventDefault()
      }}
      className="ml-auto"
    >
      <button
        type="submit"
        className="text-slate-500 dark:text-[#7a7a7a] hover:text-[#16163f] dark:hover:text-white text-sm border border-black/10 dark:border-white/10 hover:border-[#16163f] px-3 py-2 rounded transition-colors"
      >
        Delete Player
      </button>
    </form>
  )
}
