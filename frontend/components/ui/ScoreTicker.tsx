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

  // Double items for seamless loop
  const doubled = [...items, ...items];

  return (
    <div className="shrink-0 overflow-hidden border-b border-monad-purple/20 bg-monad-deeper/80 pointer-events-none">
      <div
        className="flex gap-12 whitespace-nowrap py-1.5 px-4"
        style={{
          animation: `ticker ${items.length * 5}s linear infinite`,
        }}
      >
        {doubled.map((item, i) => (
          <span key={`${item.id}-${i}`} className="font-pixel text-[7px] text-text-dim">
            {item.text}
          </span>
        ))}
      </div>
      <style jsx>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
