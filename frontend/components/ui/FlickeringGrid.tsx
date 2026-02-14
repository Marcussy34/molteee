import { useCallback, useEffect, useRef, useState } from "react";

interface FlickeringGridProps extends React.HTMLAttributes<HTMLCanvasElement> {
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  color?: string;
  maxOpacity?: number;
  width?: number;
  height?: number;
}

function toRGBA(color: string, opacity: number): string {
  // Handle hex colors
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const bigint = parseInt(hex.length === 3
      ? hex.split("").map(c => c + c).join("")
      : hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${opacity})`;
  }
  // Handle rgb/rgba
  if (color.startsWith("rgb")) {
    const match = color.match(/[\d.]+/g);
    if (match) {
      return `rgba(${match[0]},${match[1]},${match[2]},${opacity})`;
    }
  }
  return color;
}

export function FlickeringGrid({
  squareSize = 4,
  gridGap = 6,
  flickerChance = 0.1,
  color = "#60A5FA",
  maxOpacity = 0.5,
  width,
  height,
  className,
  ...props
}: FlickeringGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: width || 0, height: height || 0 });
  const gridRef = useRef<number[]>([]);
  const animationRef = useRef<number>(0);

  // Build/rebuild grid opacities
  const setupGrid = useCallback(
    (cols: number, rows: number) => {
      const count = cols * rows;
      const grid = new Array(count);
      for (let i = 0; i < count; i++) {
        grid[i] = Math.random() * maxOpacity;
      }
      gridRef.current = grid;
    },
    [maxOpacity]
  );

  // Observe container size
  useEffect(() => {
    if (width && height) {
      setCanvasSize({ width, height });
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [width, height]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width === 0 || canvasSize.height === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    ctx.scale(dpr, dpr);

    const step = squareSize + gridGap;
    const cols = Math.ceil(canvasSize.width / step) + 1;
    const rows = Math.ceil(canvasSize.height / step) + 1;

    setupGrid(cols, rows);

    const draw = () => {
      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

      const grid = gridRef.current;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const idx = i * rows + j;

          // Flicker: randomly change opacity
          if (Math.random() < flickerChance) {
            grid[idx] = Math.random() * maxOpacity;
          }

          const opacity = grid[idx];
          if (opacity < 0.01) continue; // skip invisible squares

          ctx.fillStyle = toRGBA(color, opacity);
          ctx.fillRect(i * step, j * step, squareSize, squareSize);
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [canvasSize, squareSize, gridGap, flickerChance, color, maxOpacity, setupGrid]);

  return (
    <div ref={containerRef} className={className} style={{ width: width || "100%", height: height || "100%" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
        }}
        {...props}
      />
    </div>
  );
}
