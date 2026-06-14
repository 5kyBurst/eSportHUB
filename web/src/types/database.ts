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
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
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
        Insert: Omit<Database["public"]["Tables"]["tournaments"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["tournaments"]["Insert"]>;
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
        Insert: Omit<Database["public"]["Tables"]["matches"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["matches"]["Insert"]>;
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
        Insert: Omit<Database["public"]["Tables"]["predictions"]["Row"], "id" | "points_earned" | "created_at" | "updated_at">;
        Update: Partial<Pick<Database["public"]["Tables"]["predictions"]["Row"], "score_a" | "score_b">>;
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
        Insert: Omit<Database["public"]["Tables"]["cards"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["cards"]["Insert"]>;
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
        Insert: Omit<Database["public"]["Tables"]["card_packs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["card_packs"]["Insert"]>;
      };
      user_cards: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          acquired_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_cards"]["Row"], "id" | "acquired_at">;
        Update: never;
      };
    };
  };
}
