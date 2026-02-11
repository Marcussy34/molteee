import Link from "next/link";

interface GameOverErrorProps {
  message?: string;
  backHref?: string;
  backLabel?: string;
}

export function GameOverError({
  message = "Something went wrong",
  backHref = "/",
  backLabel = "CONTINUE?",
}: GameOverErrorProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-monad-dark">
      <div className="crt-overlay" />
      <div className="relative z-10 text-center">
        <h1 className="font-pixel text-3xl text-neon-red glow-red animate-blink-soft">
          GAME OVER
        </h1>
        <p className="mt-4 text-sm text-text-dim">{message}</p>
        <Link
          href={backHref}
          className="mt-8 inline-block font-pixel text-sm text-neon-yellow animate-blink hover:text-white transition-colors"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
