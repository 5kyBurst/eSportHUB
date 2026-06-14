export type DBMatch = {
  id: string;
  match_key: string;
  team_a: string;
  team_b: string;
  score_a: number | null;
  score_b: number | null;
  status: "upcoming" | "live" | "finished";
  scheduled_at: string;
  round_label: string;
};
