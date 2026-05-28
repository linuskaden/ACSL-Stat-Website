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
        className="text-[#ff1d25] hover:text-red-400 text-sm border border-[#ff1d25]/30 hover:border-[#ff1d25] px-3 py-2 rounded transition-colors"
      >
        Delete Player
      </button>
    </form>
  )
}
