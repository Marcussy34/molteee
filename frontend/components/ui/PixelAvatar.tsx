import { useMemo } from "react";

interface PixelAvatarProps {
  address: string;
  size?: number;
}

/** Deterministic pixel-art avatar generated from a wallet address */
export function PixelAvatar({ address, size = 32 }: PixelAvatarProps) {
  const pixels = useMemo(() => {
    const hex = address.replace("0x", "").toLowerCase();
    const grid: string[][] = [];
    for (let row = 0; row < 5; row++) {
      grid[row] = [];
      for (let col = 0; col < 3; col++) {
        const idx = (row * 3 + col) * 2;
        const byte = parseInt(hex.slice(idx % hex.length, (idx % hex.length) + 2), 16);
        const on = byte > 100;
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        grid[row][col] = on ? `rgb(${r},${g},${b})` : "transparent";
      }
    }
    // Mirror columns 0-2 to make 5 wide (symmetric)
    return grid.map((row) => [...row, row[1], row[0]]);
  }, [address]);

  const cellSize = size / 5;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {pixels.map((row, y) =>
        row.map((color, x) =>
          color !== "transparent" ? (
            <rect
              key={`${x}-${y}`}
              x={x * cellSize}
              y={y * cellSize}
              width={cellSize}
              height={cellSize}
              fill={color}
            />
          ) : null
        )
      )}
    </svg>
  );
}
