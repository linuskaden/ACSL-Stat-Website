export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string
          slug: string
          name: string
          short_name: string
          university: string
          primary_color: string
          secondary_color: string
          tertiary_color: string | null
          logo_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['teams']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['teams']['Insert']>
      }
      players: {
        Row: {
          id: string
          team_id: string | null
          jersey_number: number | null
          positions: string[]
          first_name: string
          last_name: string
          nickname: string | null
          hometown: string | null
          state_province: string | null
          country: string | null
          date_of_birth: string | null
          height_cm: number | null
          weight_kg: number | null
          field_of_study: string | null
          semester: string | null
          acsl_since: string | null
          football_experience: string | null
          fun_fact: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['players']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['players']['Insert']>
      }
      games: {
        Row: {
          id: string
          season: number
          week: number | null
          game_type: string
          home_team_id: string | null
          away_team_id: string | null
          home_score: number | null
          away_score: number | null
          scheduled_at: string | null
          status: string
          location: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['games']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['games']['Insert']>
      }
      game_stats: {
        Row: {
          id: string
          game_id: string
          player_id: string
          team_id: string
          quarter: string
          pass_yards: number
          pass_attempts: number
          pass_completions: number
          pass_tds: number
          interceptions_thrown: number
          qb_rush_yards: number
          qb_rush_tds: number
          rush_carries: number
          rush_yards: number
          rush_tds: number
          rb_rec_yards: number
          rb_receptions: number
          rb_targets: number
          rb_fumbles: number
          rec_yards: number
          receptions: number
          rec_targets: number
          rec_tds: number
          rec_fumbles: number
          sacks: number
          def_interceptions: number
          fg_made: number
          fg_attempts: number
          ep_made: number
          ep_attempts: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['game_stats']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['game_stats']['Insert']>
      }
      career_stats: {
        Row: {
          id: string
          player_id: string
          season: number
          games_played: number
          pass_yards: number
          pass_attempts: number
          pass_completions: number
          pass_tds: number
          interceptions_thrown: number
          qb_rush_yards: number
          qb_rush_tds: number
          rush_carries: number
          rush_yards: number
          rush_tds: number
          rb_rec_yards: number
          rb_receptions: number
          rb_targets: number
          rb_fumbles: number
          rec_yards: number
          receptions: number
          rec_targets: number
          rec_tds: number
          rec_fumbles: number
          sacks: number
          def_interceptions: number
          fg_made: number
          fg_attempts: number
          ep_made: number
          ep_attempts: number
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['career_stats']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['career_stats']['Insert']>
      }
      standings: {
        Row: {
          id: string
          team_id: string
          season: number
          wins: number
          losses: number
          points_for: number
          points_against: number
          playoff_seed: number | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['standings']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['standings']['Insert']>
      }
      playoff_bracket: {
        Row: {
          id: string
          season: number
          round: string
          match_order: number
          home_team_id: string | null
          away_team_id: string | null
          home_seed: number | null
          away_seed: number | null
          winner_id: string | null
          game_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['playoff_bracket']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['playoff_bracket']['Insert']>
      }
    }
  }
}

export type Team = Database['public']['Tables']['teams']['Row']
export type Player = Database['public']['Tables']['players']['Row']
export type Game = Database['public']['Tables']['games']['Row']
export type GameStats = Database['public']['Tables']['game_stats']['Row']
export type CareerStats = Database['public']['Tables']['career_stats']['Row']
export type Standings = Database['public']['Tables']['standings']['Row']
export type PlayoffBracket = Database['public']['Tables']['playoff_bracket']['Row']

export type PlayerWithTeam = Player & { team: Team | null }
export type GameWithTeams = Game & { home_team: Team | null; away_team: Team | null }
export type StandingsWithTeam = Standings & { team: Team }
