export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Rarity = "common" | "rare" | "epic" | "legendary";
export type CardType = "player" | "ceo" | "org";
export type MatchStatus = "upcoming" | "live" | "finished";
export type TournamentFormat = "swiss" | "double_elimination" | "single_elimination";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          points: number;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          avatar_url?: string | null;
          points?: number;
          is_admin?: boolean;
        };
        Update: {
          username?: string;
          avatar_url?: string | null;
          points?: number;
          is_admin?: boolean;
        };
      };
      tournaments: {
        Row: {
          id: string;
          name: string;
          slug: string;
          format: TournamentFormat;
          start_date: string;
          end_date: string;
          status: MatchStatus;
          liquipedia_url: string | null;
          game: string | null;
          created_at: string;
        };
        Insert: {
          name: string;
          slug: string;
          format: TournamentFormat;
          start_date: string;
          end_date: string;
          status?: MatchStatus;
          liquipedia_url?: string | null;
          game?: string | null;
        };
        Update: {
          name?: string;
          slug?: string;
          format?: TournamentFormat;
          start_date?: string;
          end_date?: string;
          status?: MatchStatus;
          liquipedia_url?: string | null;
          game?: string | null;
        };
      };
      matches: {
        Row: {
          id: string;
          tournament_id: string;
          match_key: string;
          team_a: string;
          team_b: string;
          format: string;
          score_a: number | null;
          score_b: number | null;
          status: MatchStatus;
          scheduled_at: string;
          round_label: string;
          created_at: string;
        };
        Insert: {
          tournament_id: string;
          match_key: string;
          team_a: string;
          team_b: string;
          format?: string;
          score_a?: number | null;
          score_b?: number | null;
          status?: MatchStatus;
          scheduled_at: string;
          round_label: string;
        };
        Update: {
          tournament_id?: string;
          match_key?: string;
          team_a?: string;
          team_b?: string;
          format?: string;
          score_a?: number | null;
          score_b?: number | null;
          status?: MatchStatus;
          scheduled_at?: string;
          round_label?: string;
        };
      };
      predictions: {
        Row: {
          id: string;
          user_id: string;
          match_id: string;
          score_a: number;
          score_b: number;
          points_earned: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          match_id: string;
          score_a: number;
          score_b: number;
        };
        Update: {
          score_a?: number;
          score_b?: number;
        };
      };
      cards: {
        Row: {
          id: string;
          type: CardType;
          name: string;
          role: string | null;
          team: string;
          region: string;
          rarity: Rarity;
          image_url: string | null;
          stats: Json;
          created_at: string;
        };
        Insert: {
          type: CardType;
          name: string;
          role?: string | null;
          team: string;
          region: string;
          rarity: Rarity;
          image_url?: string | null;
          stats?: Json;
        };
        Update: {
          type?: CardType;
          name?: string;
          role?: string | null;
          team?: string;
          region?: string;
          rarity?: Rarity;
          image_url?: string | null;
          stats?: Json;
        };
      };
      card_packs: {
        Row: {
          id: string;
          name: string;
          description: string;
          cost_points: number;
          card_count: number;
          rarity_weights: Json;
          created_at: string;
        };
        Insert: {
          name: string;
          description?: string;
          cost_points: number;
          card_count?: number;
          rarity_weights?: Json;
        };
        Update: {
          name?: string;
          description?: string;
          cost_points?: number;
          card_count?: number;
          rarity_weights?: Json;
        };
      };
      user_cards: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          acquired_at: string;
        };
        Insert: {
          user_id: string;
          card_id: string;
        };
        Update: never;
      };
    };
  };
}
