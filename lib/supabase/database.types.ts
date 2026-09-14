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
      eod_prices: {
        Row: {
          close_price: number
          created_at: string
          instrument_id: number
          price_date: string
        }
        Insert: {
          close_price: number
          created_at?: string
          instrument_id: number
          price_date: string
        }
        Update: {
          close_price?: number
          created_at?: string
          instrument_id?: number
          price_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "eod_prices_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      instrument_prices: {
        Row: {
          instrument_id: number
          last_price: number
          previous_close: number | null
          priced_at: string
          source: Database["public"]["Enums"]["price_source"]
          updated_at: string
        }
        Insert: {
          instrument_id: number
          last_price: number
          previous_close?: number | null
          priced_at?: string
          source?: Database["public"]["Enums"]["price_source"]
          updated_at?: string
        }
        Update: {
          instrument_id?: number
          last_price?: number
          previous_close?: number | null
          priced_at?: string
          source?: Database["public"]["Enums"]["price_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instrument_prices_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: true
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          created_at: string
          exchange: Database["public"]["Enums"]["exchange"]
          id: number
          is_active: boolean
          kind: Database["public"]["Enums"]["instrument_kind"]
          last_seen_at: string
          name: string
          series: string | null
          symbol: string
          tick_size: number
          token: string
          trading_symbol: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exchange: Database["public"]["Enums"]["exchange"]
          id?: never
          is_active?: boolean
          kind: Database["public"]["Enums"]["instrument_kind"]
          last_seen_at?: string
          name: string
          series?: string | null
          symbol: string
          tick_size?: number
          token: string
          trading_symbol: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exchange?: Database["public"]["Enums"]["exchange"]
          id?: never
          is_active?: boolean
          kind?: Database["public"]["Enums"]["instrument_kind"]
          last_seen_at?: string
          name?: string
          series?: string | null
          symbol?: string
          tick_size?: number
          token?: string
          trading_symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: number
          job: string
          started_at: string
          status: Database["public"]["Enums"]["job_status"]
          summary: string | null
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: never
          job: string
          started_at?: string
          status?: Database["public"]["Enums"]["job_status"]
          summary?: string | null
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: never
          job?: string
          started_at?: string
          status?: Database["public"]["Enums"]["job_status"]
          summary?: string | null
        }
        Relationships: []
      }
      market_holidays: {
        Row: {
          created_at: string
          description: string
          holiday_date: string
        }
        Insert: {
          created_at?: string
          description: string
          holiday_date: string
        }
        Update: {
          created_at?: string
          description?: string
          holiday_date?: string
        }
        Relationships: []
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
      portfolio_snapshots: {
        Row: {
          created_at: string
          current_value: number
          holding_count: number
          invested: number
          member_id: string
          priced_count: number
          realized_pnl: number
          snapshot_date: string
          unrealized_pnl: number
        }
        Insert: {
          created_at?: string
          current_value: number
          holding_count: number
          invested: number
          member_id: string
          priced_count: number
          realized_pnl: number
          snapshot_date: string
          unrealized_pnl: number
        }
        Update: {
          created_at?: string
          current_value?: number
          holding_count?: number
          invested?: number
          member_id?: string
          priced_count?: number
          realized_pnl?: number
          snapshot_date?: string
          unrealized_pnl?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_snapshots_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          broker_account_id: string
          charges: number
          created_at: string
          id: string
          instrument_id: number
          member_id: string
          notes: string | null
          price: number
          quantity: number
          trade_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          broker_account_id: string
          charges?: number
          created_at?: string
          id?: string
          instrument_id: number
          member_id: string
          notes?: string | null
          price: number
          quantity: number
          trade_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          broker_account_id?: string
          charges?: number
          created_at?: string
          id?: string
          instrument_id?: number
          member_id?: string
          notes?: string | null
          price?: number
          quantity?: number
          trade_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_broker_account_id_member_id_fkey"
            columns: ["broker_account_id", "member_id"]
            isOneToOne: false
            referencedRelation: "broker_accounts"
            referencedColumns: ["id", "member_id"]
          },
          {
            foreignKeyName: "transactions_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
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
      exchange: "NSE" | "BSE"
      instrument_kind: "equity" | "sgb" | "index"
      job_status: "running" | "success" | "skipped" | "failed"
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
      price_source: "manual" | "angelone"
      transaction_type: "opening_balance" | "buy" | "sell"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]

export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T]
