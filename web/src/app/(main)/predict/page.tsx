import GameCard from "./_GameCard";

const GAMES = [
  {
    id: "vct",
    name: "VCT",
    full: "VALORANT Champions Tour",
    color: "#FF4655",
    bg: "rgba(255,70,85,0.08)",
    border: "rgba(255,70,85,0.25)",
    icon: <img src="/logos/VCT.png" alt="VCT" style={{ height: 48, width: "auto", objectFit: "contain" }} />,
  },
  {
    id: "vct-gc",
    name: "VCT GC",
    full: "Game Changers",
    color: "#B97CFF",
    bg: "rgba(185,124,255,0.08)",
    border: "rgba(185,124,255,0.25)",
    icon: <img src="/logos/VCT GC.png" alt="VCT GC" style={{ height: 48, width: "auto", objectFit: "contain" }} />,
  },
  {
    id: "rlcs",
    name: "RLCS",
    full: "Rocket League Championship Series",
    color: "#4A9EFF",
    bg: "rgba(74,158,255,0.08)",
    border: "rgba(74,158,255,0.25)",
    icon: <img src="/logos/RLCS.png" alt="RLCS" style={{ height: 48, width: "auto", objectFit: "contain" }} />,
  },
  {
    id: "cdl",
    name: "CDL",
    full: "Call of Duty League",
    color: "#36D399",
    bg: "rgba(54,211,153,0.08)",
    border: "rgba(54,211,153,0.25)",
    icon: <img src="/logos/cdl.png" alt="CDL" style={{ height: 48, width: "auto", objectFit: "contain" }} />,
  },
];

export default function PredictPage() {
  return (
    <div className="w-full max-w-5xl mx-auto px-6 sm:px-10 py-8 sm:py-12">
      <div className="mb-6 sm:mb-8">
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: "clamp(22px, 5vw, 32px)", fontWeight: 900, color: "var(--text)", letterSpacing: 1, textTransform: "uppercase" }}>
          Prédictions
        </h1>
        <p style={{ color: "var(--text3)", fontSize: "clamp(12px, 2vw, 14px)", marginTop: 4 }}>
          Choisis ton jeu et prédit les résultats des compétitions
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:gap-4">
        {GAMES.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
}
