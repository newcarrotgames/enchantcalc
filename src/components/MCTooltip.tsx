import { useState, type ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

/** Minecraft-style hover tooltip that follows the cursor. */
export function Tooltip({ content, children }: TooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <span
      className="tt-wrap"
      onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && (
        <div
          className="mc-tooltip"
          style={{
            left: Math.min(pos.x + 16, window.innerWidth - 300),
            top: pos.y + 18,
          }}
        >
          {content}
        </div>
      )}
    </span>
  );
}
