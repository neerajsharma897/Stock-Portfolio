// Database types for supabase-js, matching the SQL in supabase/migrations.
// Regenerate after each migration (needs `npx supabase login` once):
//   npx supabase gen types typescript --project-id <project-ref> --schema public > lib/supabase/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_owner: {
        Row: {
          created_at: string
          display_name: string
          singleton: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          singleton?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          singleton?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broker_accounts: {
        Row: {
          broker: Database["public"]["Enums"]["broker"]
          client_id_last4: string | null
          created_at: string
          id: string
          label: string | null
          member_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          broker: Database["public"]["Enums"]["broker"]
          client_id_last4?: string | null
          created_at?: string
          id?: string
          label?: string | null
          member_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          broker?: Database["public"]["Enums"]["broker"]
          client_id_last4?: string | null
          created_at?: string
          id?: string
          label?: string | null
          member_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_accounts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          id: string
          name: string
          notes: string | null
          pan_last4: string | null
          relation: Database["public"]["Enums"]["member_relation"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          pan_last4?: string | null
          relation?: Database["public"]["Enums"]["member_relation"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          pan_last4?: string | null
          relation?: Database["public"]["Enums"]["member_relation"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      is_owner: { Args: never; Returns: boolean }
    }
    Enums: {
      broker:
        | "angelone"
        | "zerodha"
        | "groww"
        | "upstox"
        | "fivepaisa"
        | "coindcx"
        | "other"
      member_relation:
        | "self"
        | "spouse"
        | "son"
        | "daughter"
        | "father"
        | "mother"
        | "brother"
        | "sister"
        | "other"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]

export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T]
