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
      audit_log: {
        Row: {
          action: string
          changed_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          row_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string | null
          table_name?: string
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
      corporate_actions: {
        Row: {
          created_at: string
          ex_date: string
          id: string
          instrument_id: number
          kind: Database["public"]["Enums"]["corporate_action_kind"]
          notes: string | null
          ratio_from: number
          ratio_to: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          ex_date: string
          id?: string
          instrument_id: number
          kind: Database["public"]["Enums"]["corporate_action_kind"]
          notes?: string | null
          ratio_from: number
          ratio_to: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          ex_date?: string
          id?: string
          instrument_id?: number
          kind?: Database["public"]["Enums"]["corporate_action_kind"]
          notes?: string | null
          ratio_from?: number
          ratio_to?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporate_actions_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_deposits: {
        Row: {
          bank: string
          closed_on: string | null
          created_at: string
          id: string
          interest: Database["public"]["Enums"]["fd_interest"]
          maturity_date: string
          member_id: string
          notes: string | null
          principal: number
          rate_pct: number
          start_date: string
          updated_at: string
        }
        Insert: {
          bank: string
          closed_on?: string | null
          created_at?: string
          id?: string
          interest?: Database["public"]["Enums"]["fd_interest"]
          maturity_date: string
          member_id: string
          notes?: string | null
          principal: number
          rate_pct: number
          start_date: string
          updated_at?: string
        }
        Update: {
          bank?: string
          closed_on?: string | null
          created_at?: string
          id?: string
          interest?: Database["public"]["Enums"]["fd_interest"]
          maturity_date?: string
          member_id?: string
          notes?: string | null
          principal?: number
          rate_pct?: number
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_deposits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      ipo_applications: {
        Row: {
          applied_on: string
          company: string
          created_at: string
          id: string
          member_id: string
          notes: string | null
          price: number
          shares_allotted: number | null
          shares_applied: number
          status: Database["public"]["Enums"]["ipo_status"]
          updated_at: string
        }
        Insert: {
          applied_on: string
          company: string
          created_at?: string
          id?: string
          member_id: string
          notes?: string | null
          price: number
          shares_allotted?: number | null
          shares_applied: number
          status?: Database["public"]["Enums"]["ipo_status"]
          updated_at?: string
        }
        Update: {
          applied_on?: string
          company?: string
          created_at?: string
          id?: string
          member_id?: string
          notes?: string | null
          price?: number
          shares_allotted?: number | null
          shares_applied?: number
          status?: Database["public"]["Enums"]["ipo_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ipo_applications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      other_assets: {
        Row: {
          created_at: string
          current_value: number
          id: string
          invested: number
          kind: Database["public"]["Enums"]["other_asset_kind"]
          member_id: string
          name: string
          notes: string | null
          updated_at: string
          value_as_of: string
        }
        Insert: {
          created_at?: string
          current_value: number
          id?: string
          invested: number
          kind: Database["public"]["Enums"]["other_asset_kind"]
          member_id: string
          name: string
          notes?: string | null
          updated_at?: string
          value_as_of: string
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          invested?: number
          kind?: Database["public"]["Enums"]["other_asset_kind"]
          member_id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          value_as_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "other_assets_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_assets: {
        Row: {
          change_24h_pct: number | null
          created_at: string
          is_active: boolean
          last_price: number | null
          last_seen_at: string
          market: string
          name: string
          priced_at: string | null
          symbol: string
          updated_at: string
        }
        Insert: {
          change_24h_pct?: number | null
          created_at?: string
          is_active?: boolean
          last_price?: number | null
          last_seen_at?: string
          market: string
          name: string
          priced_at?: string | null
          symbol: string
          updated_at?: string
        }
        Update: {
          change_24h_pct?: number | null
          created_at?: string
          is_active?: boolean
          last_price?: number | null
          last_seen_at?: string
          market?: string
          name?: string
          priced_at?: string | null
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      crypto_transactions: {
        Row: {
          broker_account_id: string
          charges: number
          created_at: string
          id: string
          market: string
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
          market: string
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
          market?: string
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
            foreignKeyName: "crypto_transactions_broker_account_id_member_id_fkey"
            columns: ["broker_account_id", "member_id"]
            isOneToOne: false
            referencedRelation: "broker_accounts"
            referencedColumns: ["id", "member_id"]
          },
          {
            foreignKeyName: "crypto_transactions_market_fkey"
            columns: ["market"]
            isOneToOne: false
            referencedRelation: "crypto_assets"
            referencedColumns: ["market"]
          },
          {
            foreignKeyName: "crypto_transactions_member_id_fkey"
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
      mf_schemes: {
        Row: {
          amc: string
          amfi_code: number
          category: string | null
          created_at: string
          is_active: boolean
          isin_growth: string | null
          isin_reinvest: string | null
          last_seen_at: string
          name: string
          nav: number | null
          nav_date: string | null
          option_label: string | null
          option_type: Database["public"]["Enums"]["mf_option"] | null
          plan: Database["public"]["Enums"]["mf_plan"] | null
          previous_nav: number | null
          previous_nav_date: string | null
          scheme_type: string | null
          updated_at: string
        }
        Insert: {
          amc: string
          amfi_code: number
          category?: string | null
          created_at?: string
          is_active?: boolean
          isin_growth?: string | null
          isin_reinvest?: string | null
          last_seen_at?: string
          name: string
          nav?: number | null
          nav_date?: string | null
          option_label?: string | null
          option_type?: Database["public"]["Enums"]["mf_option"] | null
          plan?: Database["public"]["Enums"]["mf_plan"] | null
          previous_nav?: number | null
          previous_nav_date?: string | null
          scheme_type?: string | null
          updated_at?: string
        }
        Update: {
          amc?: string
          amfi_code?: number
          category?: string | null
          created_at?: string
          is_active?: boolean
          isin_growth?: string | null
          isin_reinvest?: string | null
          last_seen_at?: string
          name?: string
          nav?: number | null
          nav_date?: string | null
          option_label?: string | null
          option_type?: Database["public"]["Enums"]["mf_option"] | null
          plan?: Database["public"]["Enums"]["mf_plan"] | null
          previous_nav?: number | null
          previous_nav_date?: string | null
          scheme_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mf_transactions: {
        Row: {
          amfi_code: number
          broker_account_id: string
          charges: number
          created_at: string
          folio_number: string | null
          id: string
          member_id: string
          nav: number
          notes: string | null
          trade_date: string
          type: Database["public"]["Enums"]["mf_transaction_type"]
          units: number
          updated_at: string
        }
        Insert: {
          amfi_code: number
          broker_account_id: string
          charges?: number
          created_at?: string
          folio_number?: string | null
          id?: string
          member_id: string
          nav: number
          notes?: string | null
          trade_date: string
          type: Database["public"]["Enums"]["mf_transaction_type"]
          units: number
          updated_at?: string
        }
        Update: {
          amfi_code?: number
          broker_account_id?: string
          charges?: number
          created_at?: string
          folio_number?: string | null
          id?: string
          member_id?: string
          nav?: number
          notes?: string | null
          trade_date?: string
          type?: Database["public"]["Enums"]["mf_transaction_type"]
          units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mf_transactions_amfi_code_fkey"
            columns: ["amfi_code"]
            isOneToOne: false
            referencedRelation: "mf_schemes"
            referencedColumns: ["amfi_code"]
          },
          {
            foreignKeyName: "mf_transactions_broker_account_id_member_id_fkey"
            columns: ["broker_account_id", "member_id"]
            isOneToOne: false
            referencedRelation: "broker_accounts"
            referencedColumns: ["id", "member_id"]
          },
          {
            foreignKeyName: "mf_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      news_article_stocks: {
        Row: {
          article_id: number
          instrument_id: number
        }
        Insert: {
          article_id: number
          instrument_id: number
        }
        Update: {
          article_id?: number
          instrument_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "news_article_stocks_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_article_stocks_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          created_at: string
          id: number
          published_at: string
          source: string | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: never
          published_at: string
          source?: string | null
          title: string
          url: string
        }
        Update: {
          created_at?: string
          id?: never
          published_at?: string
          source?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      news_feeds: {
        Row: {
          checked_at: string | null
          error: string | null
          instrument_id: number
          search_name: string | null
          updated_at: string
        }
        Insert: {
          checked_at?: string | null
          error?: string | null
          instrument_id: number
          search_name?: string | null
          updated_at?: string
        }
        Update: {
          checked_at?: string | null
          error?: string | null
          instrument_id?: number
          search_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_feeds_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: true
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
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
      watchlist_items: {
        Row: {
          created_at: string
          instrument_id: number
          note: string | null
          updated_at: string
          watchlist_id: string
        }
        Insert: {
          created_at?: string
          instrument_id: number
          note?: string | null
          updated_at?: string
          watchlist_id: string
        }
        Update: {
          created_at?: string
          instrument_id?: number
          note?: string | null
          updated_at?: string
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_items_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_items_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      is_owner: { Args: never; Returns: boolean }
      owner_access: { Args: never; Returns: string }
      restore_family_data: { Args: { backup: Json }; Returns: Json }
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
      corporate_action_kind: "split" | "bonus"
      exchange: "NSE" | "BSE"
      fd_interest: "quarterly" | "monthly" | "half_yearly" | "yearly" | "payout"
      ipo_status: "applied" | "allotted" | "not_allotted" | "withdrawn"
      other_asset_kind:
        | "gold"
        | "silver"
        | "ppf"
        | "epf"
        | "nps"
        | "bond"
        | "real_estate"
        | "other"
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
      mf_option: "growth" | "idcw"
      mf_plan: "direct" | "regular"
      mf_transaction_type: "opening_balance" | "purchase" | "sip" | "redemption"
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
