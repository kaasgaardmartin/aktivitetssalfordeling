// Auto-generate with: npm run db:types
// Manual version matching the schema in supabase/migrations/

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      haller: {
        Row: {
          id: string
          navn: string
          underlag: string | null
          merknader: string | null
          adresse: string | null
          stengedager: string | null
          bilder: string[] | null
          normert_timer: number | null
          aktiv: boolean
          opprettet_at: string
        }
        Insert: Omit<Database['public']['Tables']['haller']['Row'], 'id' | 'opprettet_at'>
        Update: Partial<Database['public']['Tables']['haller']['Insert']>
      }
      klubber: {
        Row: {
          id: string
          navn: string
          idrett: string | null
          epost: string
          nif_org_id: string | null
          medlemstall: number | null
          andel_barn: number | null
          aktiv: boolean
          opprettet_at: string
        }
        Insert: Omit<Database['public']['Tables']['klubber']['Row'], 'id' | 'opprettet_at'>
        Update: Partial<Database['public']['Tables']['klubber']['Insert']>
      }
      sesonger: {
        Row: {
          id: string
          navn: string
          frist: string
          status: 'utkast' | 'aktiv' | 'lukket'
          opprettet_av: string | null
          opprettet_at: string
        }
        Insert: Omit<Database['public']['Tables']['sesonger']['Row'], 'id' | 'opprettet_at'>
        Update: Partial<Database['public']['Tables']['sesonger']['Insert']>
      }
      tidslots: {
        Row: {
          id: string
          hal_id: string
          ukedag: 'mandag' | 'tirsdag' | 'onsdag' | 'torsdag' | 'fredag' | 'lordag' | 'sondag'
          fra_kl: string
          til_kl: string
          klubb_id: string | null
          sesong_id: string | null
          opprettet_at: string
        }
        Insert: Omit<Database['public']['Tables']['tidslots']['Row'], 'id' | 'opprettet_at'>
        Update: Partial<Database['public']['Tables']['tidslots']['Insert']>
      }
      magic_links: {
        Row: {
          id: string
          klubb_id: string
          token: string
          sesong_id: string
          brukt_at: string | null
          utloper_at: string
          opprettet_at: string
        }
        Insert: Omit<Database['public']['Tables']['magic_links']['Row'], 'id' | 'token' | 'opprettet_at'>
        Update: Partial<Database['public']['Tables']['magic_links']['Insert']>
      }
      svar: {
        Row: {
          id: string
          sesong_id: string
          klubb_id: string
          tidslot_id: string
          handling: 'bekreft' | 'endre' | 'si_opp'
          ny_ukedag: string | null
          ny_fra_kl: string | null
          ny_til_kl: string | null
          kommentar: string | null
          tidsstempel: string
        }
        Insert: Omit<Database['public']['Tables']['svar']['Row'], 'id' | 'tidsstempel'>
        Update: Partial<Database['public']['Tables']['svar']['Insert']>
      }
      soknader: {
        Row: {
          id: string
          sesong_id: string
          klubb_id: string
          tidslot_id: string
          gruppe: 'barn' | 'voksne' | 'begge'
          begrunnelse: string | null
          status: 'venter' | 'godkjent' | 'avslatt'
          behandlet_av: string | null
          behandlet_at: string | null
          opprettet_at: string
        }
        Insert: Omit<Database['public']['Tables']['soknader']['Row'], 'id' | 'opprettet_at'>
        Update: Partial<Database['public']['Tables']['soknader']['Insert']>
      }
      bytterunder: {
        Row: {
          id: string
          sesong_id: string
          initierende_klubb: string
          mottakende_klubb: string
          slot_a_id: string
          slot_b_id: string
          melding: string | null
          status: 'venter' | 'godkjent' | 'avslatt' | 'trukket'
          initierende_svar: boolean | null
          mottakende_svar: boolean | null
          opprettet_at: string
        }
        Insert: Omit<Database['public']['Tables']['bytterunder']['Row'], 'id' | 'opprettet_at'>
        Update: Partial<Database['public']['Tables']['bytterunder']['Insert']>
      }
      venteliste: {
        Row: {
          id: string
          klubb_id: string
          idrett: string | null
          oensket_hal_id: string | null
          gruppe: 'barn' | 'voksne' | 'begge' | null
          meldt_dato: string
          status: 'aktiv' | 'tildelt' | 'inaktiv'
        }
        Insert: Omit<Database['public']['Tables']['venteliste']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['venteliste']['Insert']>
      }
      admin_brukere: {
        Row: {
          id: string
          auth_id: string
          rolle: string
          opprettet_at: string
        }
        Insert: Omit<Database['public']['Tables']['admin_brukere']['Row'], 'id' | 'opprettet_at'>
        Update: Partial<Database['public']['Tables']['admin_brukere']['Insert']>
      }
      regler_info: {
        Row: {
          id: string
          innhold: string
          oppdatert_av: string | null
          oppdatert_at: string
        }
        Insert: Omit<Database['public']['Tables']['regler_info']['Row'], 'id' | 'oppdatert_at'>
        Update: Partial<Database['public']['Tables']['regler_info']['Insert']>
      }
    }
    Views: {
      ledige_slots: {
        Row: {
          id: string
          sesong_id: string | null
          ukedag: string
          fra_kl: string
          til_kl: string
          hal_id: string
          hal_navn: string
          underlag: string | null
          merknader: string | null
          stengedager: string | null
        }
      }
      timer_per_hal: {
        Row: {
          hal_id: string
          hal_navn: string
          sesong_id: string | null
          antall_slots: number
          timer_per_uke: number
          tildelte_slots: number
          ledige_slots: number
        }
      }
      soknader_med_info: {
        Row: {
          id: string
          sesong_id: string
          status: string
          gruppe: string
          begrunnelse: string | null
          opprettet_at: string
          klubb_id: string
          klubb_navn: string
          idrett: string | null
          medlemstall: number | null
          andel_barn: number | null
          slot_id: string
          ukedag: string
          fra_kl: string
          til_kl: string
          hal_id: string
          hal_navn: string
          underlag: string | null
          eksisterende_timer: number
        }
      }
    }
  }
}
