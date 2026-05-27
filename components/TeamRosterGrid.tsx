'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P']

type Team = {
  id: string; name: string; short_name: string; slug: string
  primary_color: string; secondary_color: string; logo_url: string | null
  university: string | null
}

type Player = {
  id: string; first_name: string; last_name: string; nickname: string | null
  jersey_number: string | null; positions: string[]; team_id: string
  is_active: boolean; height_cm: number | null; weight_kg: number | null
  country: string | null; hometown: string | null; field_of_study: string | null
  semester: string | null; acsl_since: string | null; fun_fact: string | null
  football_experience: string | null
}

interface Props {
  team: Team
  players: Player[]
  allTeams: Team[]
  /** When set, shows the "Live Stats einblenden" button and overlay controls */
  overlayMode?: boolean
  /** Callback for pushing player to overlay (overlayMode only) */
  onOverlayPush?: (player: Player, mode: 'live' | 'career') => void
  /** Currently active overlay player id (overlayMode only) */
  overlayActiveId?: string | null
  /** Whether overlay is currently visible (overlayMode only) */
  overlayVisible?: boolean
}

export default function TeamRosterGrid({
  team,
  players,
  allTeams,
  overlayMode = false,
  onOverlayPush,
  overlayActiveId,
  overlayVisible,
}: Props) {
  const [selected, setSelected] = useState<Player | null>(null)
  const [careerStats, setCareerStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')

  // Load career stats when player is selected
  useEffect(() => {
    if (!selected) { setCareerStats(null); return }
    setLoadingStats(true)
    const supabase = createClient()
    supabase
      .from('career_stats')
      .select('*')
      .eq('player_id', selected.id)
      .order('season', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { setCareerStats(data); setLoadingStats(false) })
  }, [selected?.id])

  const filtered = players.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || [
      p.first_name, p.last_name, String(p.jersey_number ?? ''),
      ...(p.positions ?? []), p.field_of_study ?? '', p.nickname ?? '',
    ].some(v => v.toLowerCase().includes(q))
    const matchPos = filter === 'All' || p.positions.includes(filter)
    return matchSearch && matchPos
  })

  return (
    <div style={{
      display: 'flex',
      height: overlayMode ? 'auto' : 'calc(100vh - 56px)',
      overflow: overlayMode ? 'visible' : 'hidden',
      background: '#10142080',
    }}>

      {/* ── Left sidebar: all teams ── */}
      {!overlayMode && (
        <div style={{
          width: 200,
          flexShrink: 0,
          background: '#0c0f1a',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          overflowY: 'auto',
          padding: '16px 0',
        }}>
          {/* Section: TEAMS */}
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            color: '#444', textTransform: 'uppercase',
            padding: '0 16px 8px',
          }}>
            Teams
          </div>
          {allTeams.map(t => {
            const isActive = t.id === team.id
            return (
              <Link key={t.id} href={`/teams/${t.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 16px',
                  background: isActive ? `${t.primary_color}18` : 'transparent',
                  borderLeft: isActive ? `3px solid ${t.primary_color}` : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                  {t.logo_url ? (
                    <img src={t.logo_url} alt="" style={{ width: 26, height: 26, objectFit: 'contain', flexShrink: 0 }} />
                  ) : (
                    <div style={{
                      width: 26, height: 26, borderRadius: 4, flexShrink: 0,
                      background: t.primary_color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 900, color: 'white',
                    }}>
                      {t.short_name.slice(0, 2)}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: isActive ? 700 : 500,
                      color: isActive ? 'white' : '#aaa',
                      lineHeight: 1.2, whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {t.name}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}

          {/* Liga */}
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            color: '#444', textTransform: 'uppercase',
            padding: '16px 16px 8px',
            marginTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}>
            Liga
          </div>
          <Link href="/players" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 16px', cursor: 'pointer',
              borderLeft: '3px solid transparent',
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 4,
                background: '#ff1d25',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 900, color: 'white', flexShrink: 0,
              }}>
                ACSL
              </div>
              <span style={{ fontSize: 12, color: '#888' }}>Alle Teams</span>
            </div>
          </Link>
        </div>
      )}

      {/* ── Main area ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        {/* Top bar */}
        <div style={{
          background: '#0c0f1a',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '12px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}>
          {/* Team identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {team.logo_url ? (
              <div style={{
                width: 40, height: 40,
                background: team.primary_color,
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
              }}>
                <img src={team.logo_url} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{
                width: 40, height: 40, background: team.primary_color,
                borderRadius: 8, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 14, fontWeight: 900, color: 'white',
              }}>
                {team.short_name.slice(0, 2)}
              </div>
            )}
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: 'white', letterSpacing: -0.3, lineHeight: 1.1 }}>
                {team.name}
              </div>
              <div style={{ fontSize: 11, color: '#555' }}>
                {filtered.length} Spieler
              </div>
            </div>
          </div>

          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suche nach Name oder Nummer..."
            style={{
              flex: 1, minWidth: 180, maxWidth: 400,
              background: '#171c2e',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '7px 12px',
              color: 'white', fontSize: 13,
              outline: 'none',
            }}
          />

          {/* Position filter */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {POSITIONS.map(pos => (
              <button
                key={pos}
                onClick={() => setFilter(pos)}
                style={{
                  padding: '5px 10px',
                  fontSize: 11, fontWeight: 700,
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                  background: filter === pos ? team.primary_color : 'rgba(255,255,255,0.06)',
                  color: filter === pos ? 'white' : '#888',
                  transition: 'all 0.15s',
                }}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable grid + panel */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Grid */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
          }}>
            {filtered.length === 0 ? (
              <div style={{ color: '#444', textAlign: 'center', padding: '48px', fontSize: 14 }}>
                Keine Spieler gefunden
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 10,
              }}>
                {filtered.map(p => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    team={team}
                    isSelected={selected?.id === p.id}
                    isOnAir={overlayMode && overlayActiveId === p.id}
                    onClick={() => setSelected(selected?.id === p.id ? null : p)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right detail panel */}
          {selected && (
            <PlayerDetailPanel
              player={selected}
              team={team}
              careerStats={careerStats}
              loadingStats={loadingStats}
              overlayMode={overlayMode}
              overlayActiveId={overlayActiveId}
              overlayVisible={overlayVisible}
              onClose={() => setSelected(null)}
              onOverlayPush={onOverlayPush ? (mode) => onOverlayPush(selected, mode) : undefined}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Player Card
───────────────────────────────────────────── */
function PlayerCard({
  player, team, isSelected, isOnAir, onClick,
}: {
  player: Player; team: Team; isSelected: boolean; isOnAir: boolean; onClick: () => void
}) {
  const posBadge = player.positions.slice(0, 2).join(' / ')
  const primaryColor = team.primary_color

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        background: isSelected ? `${primaryColor}22` : '#171c2e',
        border: `1px solid ${isSelected ? primaryColor : isOnAir ? '#04a550' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 10,
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        userSelect: 'none',
        minHeight: 130,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Top row: jersey + position badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: 36, fontWeight: 900,
          fontFamily: '"Arial Black", Impact, sans-serif',
          color: isSelected ? primaryColor : 'rgba(255,255,255,0.7)',
          lineHeight: 1,
          transition: 'color 0.15s',
        }}>
          {player.jersey_number ?? '—'}
        </span>
        <span style={{
          background: primaryColor,
          color: 'white',
          fontSize: 9, fontWeight: 800,
          letterSpacing: 0.5,
          padding: '3px 6px',
          borderRadius: 4,
          textTransform: 'uppercase',
          maxWidth: 60,
          textAlign: 'center',
          lineHeight: 1.3,
          wordBreak: 'break-all',
        }}>
          {posBadge}
        </span>
      </div>

      {/* Bottom: name + active dot */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'white', lineHeight: 1.2 }}>
            {player.first_name}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', lineHeight: 1.2 }}>
            {player.last_name}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {player.is_active && (
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#04a550',
              boxShadow: '0 0 6px #04a550',
            }} />
          )}
          {isOnAir && (
            <div style={{
              fontSize: 8, fontWeight: 800, letterSpacing: 1,
              color: '#04a550', textTransform: 'uppercase',
            }}>
              AIR
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Player Detail Panel
───────────────────────────────────────────── */
function PlayerDetailPanel({
  player, team, careerStats, loadingStats,
  overlayMode, overlayActiveId, overlayVisible,
  onClose, onOverlayPush,
}: {
  player: Player; team: Team; careerStats: any; loadingStats: boolean
  overlayMode: boolean; overlayActiveId?: string | null; overlayVisible?: boolean
  onClose: () => void
  onOverlayPush?: (mode: 'live' | 'career') => void
}) {
  const pos = player.positions.join(' · ')
  const isOnAir = overlayMode && overlayActiveId === player.id
  const primaryColor = team.primary_color

  return (
    <div style={{
      width: 320,
      flexShrink: 0,
      background: '#0c0f1a',
      borderLeft: '1px solid rgba(255,255,255,0.06)',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Panel header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0,
        background: '#0c0f1a',
        zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: primaryColor, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            {pos}
          </span>
          <span style={{ color: '#333' }}>·</span>
          <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>
            #{player.jersey_number ?? '—'}
          </span>
          <span style={{ color: '#333' }}>·</span>
          {team.logo_url ? (
            <div style={{
              width: 22, height: 22, background: primaryColor,
              borderRadius: 4, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src={team.logo_url} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
            </div>
          ) : (
            <div style={{
              width: 22, height: 22, background: primaryColor, borderRadius: 4,
              fontSize: 8, fontWeight: 900, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {team.short_name.slice(0, 2)}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.05)', border: 'none',
            borderRadius: 6, width: 26, height: 26,
            color: '#888', fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>

      {/* Name */}
      <div style={{ padding: '20px 16px 12px' }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: 'white', lineHeight: 1.1, letterSpacing: -0.5 }}>
          {player.first_name}
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: 'rgba(255,255,255,0.6)', lineHeight: 1.1, letterSpacing: -0.5 }}>
          {player.last_name}
        </div>

        {/* Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {player.is_active && (
            <Chip color="#04a550" dot>Aktiv</Chip>
          )}
          {player.field_of_study && (
            <Chip>{player.field_of_study}</Chip>
          )}
          {player.semester && (
            <Chip>{player.semester}</Chip>
          )}
        </div>
      </div>

      {/* ── vMix Overlay Controls ── */}
      {overlayMode && onOverlayPush && (
        <div style={{
          margin: '0 16px 16px',
          background: isOnAir ? 'rgba(4,165,80,0.1)' : 'rgba(255,29,37,0.06)',
          border: `1px solid ${isOnAir ? '#04a550' : 'rgba(255,29,37,0.2)'}`,
          borderRadius: 10,
          padding: '12px',
        }}>
          {isOnAir && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: 10, fontSize: 11, color: '#04a550', fontWeight: 700,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#04a550', boxShadow: '0 0 6px #04a550' }} />
              LIVE AUF OVERLAY
              {overlayVisible ? ' · SICHTBAR' : ' · VERBORGEN'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onOverlayPush('live')}
              style={{
                flex: 1,
                padding: '10px 8px',
                fontSize: 12, fontWeight: 800,
                border: 'none', borderRadius: 8, cursor: 'pointer',
                background: isOnAir ? '#ff1d25' : '#ff1d25',
                color: 'white',
                letterSpacing: 0.5,
              }}
            >
              ▲ Live Stats einblenden
            </button>
            <button
              onClick={() => onOverlayPush('career')}
              style={{
                flex: 1,
                padding: '10px 8px',
                fontSize: 12, fontWeight: 800,
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
                color: '#aaa',
                letterSpacing: 0.5,
              }}
            >
              📊 Saisonwerte
            </button>
          </div>
        </div>
      )}

      {/* ── Biografie ── */}
      <Section title="Biografie">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 8, overflow: 'hidden' }}>
          {player.height_cm && <BioCell label="Größe" value={`${player.height_cm} cm`} />}
          {player.weight_kg && <BioCell label="Gewicht" value={`${player.weight_kg} kg`} />}
          {player.country && <BioCell label="Herkunft" value={player.country} />}
          {player.hometown && <BioCell label="Heimatort" value={player.hometown} />}
          {player.acsl_since && <BioCell label="ACSL seit" value={player.acsl_since} />}
          {player.field_of_study && <BioCell label="Studiengang" value={player.field_of_study} span />}
          {player.semester && <BioCell label="Semester" value={player.semester} />}
        </div>
        {player.football_experience && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            <span style={{ color: '#888', fontWeight: 600 }}>Erfahrung: </span>
            {player.football_experience}
          </div>
        )}
        {player.fun_fact && (
          <div style={{
            marginTop: 8, background: 'rgba(255,255,255,0.03)',
            borderRadius: 6, padding: '8px 10px',
            fontSize: 11, color: '#666', fontStyle: 'italic',
            borderLeft: `2px solid ${primaryColor}`,
          }}>
            „{player.fun_fact}"
          </div>
        )}
      </Section>

      {/* ── Karrieredaten ── */}
      <Section title="Karrieredaten">
        {loadingStats ? (
          <div style={{ color: '#444', fontSize: 12 }}>Lade…</div>
        ) : careerStats ? (
          <CareerStatsDisplay cs={careerStats} positions={player.positions} />
        ) : (
          <div style={{ color: '#444', fontSize: 12, fontStyle: 'italic' }}>
            Noch keine Statistiken eingetragen
          </div>
        )}
      </Section>

      {/* ── Notizen ── */}
      {(player.nickname) && (
        <Section title="Notizen">
          {player.nickname && (
            <div style={{ fontSize: 12, color: '#888' }}>
              Spitzname: <span style={{ color: '#bbb' }}>„{player.nickname}"</span>
            </div>
          )}
        </Section>
      )}

      <div style={{ height: 24 }} />
    </div>
  )
}

/* ─── Helper sub-components ─── */

function Chip({ children, color, dot }: { children: React.ReactNode; color?: string; dot?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: color ? `${color}18` : 'rgba(255,255,255,0.07)',
      color: color ?? '#999',
      fontSize: 11, fontWeight: 600,
      padding: '4px 9px', borderRadius: 20,
      border: `1px solid ${color ? `${color}30` : 'rgba(255,255,255,0.08)'}`,
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block' }} />}
      {children}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 2,
        color: '#444', textTransform: 'uppercase',
        marginBottom: 10,
        paddingBottom: 6,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function BioCell({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div style={{
      gridColumn: span ? '1 / -1' : 'auto',
      background: '#131826',
      padding: '8px 10px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#444', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd' }}>
        {value}
      </div>
    </div>
  )
}

function CareerStatsDisplay({ cs, positions }: { cs: any; positions: string[] }) {
  const items: { label: string; value: string | number }[] = []

  if (positions.includes('QB')) {
    items.push(
      { label: 'Pass YDS', value: cs.pass_yards ?? 0 },
      { label: 'TDs', value: (cs.pass_tds ?? 0) + (cs.qb_rush_tds ?? 0) },
      { label: 'INT', value: cs.interceptions_thrown ?? 0 },
      { label: 'Comp/Att', value: `${cs.pass_completions ?? 0}/${cs.pass_attempts ?? 0}` },
    )
  } else if (positions.includes('RB')) {
    items.push(
      { label: 'Rush YDS', value: cs.rush_yards ?? 0 },
      { label: 'TDs', value: cs.rush_tds ?? 0 },
      { label: 'Carries', value: cs.rush_carries ?? 0 },
    )
  } else if (positions.some(p => ['WR', 'TE'].includes(p))) {
    items.push(
      { label: 'Rec YDS', value: cs.rec_yards ?? 0 },
      { label: 'TDs', value: cs.rec_tds ?? 0 },
      { label: 'Rec', value: cs.receptions ?? 0 },
    )
  } else if (positions.some(p => ['K', 'P'].includes(p))) {
    items.push(
      { label: 'FG', value: `${cs.fg_made ?? 0}/${cs.fg_attempts ?? 0}` },
      { label: 'EP', value: `${cs.ep_made ?? 0}/${cs.ep_attempts ?? 0}` },
    )
  } else {
    items.push(
      { label: 'Sacks', value: cs.sacks ?? 0 },
      { label: 'INT', value: cs.def_interceptions ?? 0 },
    )
  }

  if (items.length === 0) return (
    <div style={{ color: '#444', fontSize: 12, fontStyle: 'italic' }}>Keine Statistiken</div>
  )

  return (
    <div>
      {cs.season && (
        <div style={{ fontSize: 10, color: '#555', marginBottom: 8 }}>
          Saison {cs.season} · {cs.games_played ?? 0} Spiele
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {items.map(item => (
          <div key={item.label} style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 6, padding: '8px 6px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, fontWeight: 900, fontFamily: '"Arial Black", sans-serif', color: 'white', lineHeight: 1 }}>
              {item.value}
            </div>
            <div style={{ fontSize: 9, color: '#555', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
