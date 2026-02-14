interface TickerItem {
  id: string;
  text: string;
  type: "info" | "win" | "loss";
}

interface ScoreTickerProps {
  items: TickerItem[];
}

export function ScoreTicker({ items }: ScoreTickerProps) {
  if (items.length === 0) return null;

  // Duplicate 4x so content always overflows; translate -25% for seamless loop
  const doubled = Array.from({ length: 4 }, () => items).flat();

  return (
    <div className="min-w-0 shrink-0 overflow-hidden border-b border-monad-purple/20 bg-monad-deeper/80 pointer-events-none">
      {/* min-w-0 allows flex child to clip; inline-flex + shrink-0 lets content overflow for scroll */}
      <div
        className="inline-flex shrink-0 gap-12 whitespace-nowrap py-1.5 px-4"
        style={{
          // Translate by -1/copies so loop is seamless when animation resets
          animation: `ticker-scroll ${Math.max(items.length * 5, 15)}s linear infinite`,
        }}
      >
        {doubled.map((item, i) => (
          <span key={`${item.id}-${i}`} className="font-pixel text-[7px] text-text-dim shrink-0">
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}
