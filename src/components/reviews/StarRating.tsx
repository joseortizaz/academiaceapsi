import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type ReadOnlyProps = {
  value: number;
  size?: number;
  className?: string;
};

/** Estrellas de solo lectura, admite decimales (relleno parcial). */
export function StarRating({ value, size = 18, className }: ReadOnlyProps) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} de 5 estrellas`}>
      {stars.map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-amber-400/40" style={{ width: size, height: size }} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star
                className="text-amber-500"
                style={{ width: size, height: size, fill: "currentColor" }}
              />
            </span>
          </span>
        );
      })}
    </span>
  );
}

type InputProps = {
  value: number;
  onChange: (v: number) => void;
  size?: number;
  disabled?: boolean;
  className?: string;
};

/** Selector interactivo de estrellas, accesible con teclado. */
export function StarRatingInput({ value, onChange, size = 30, disabled, className }: InputProps) {
  return (
    <div className={cn("inline-flex items-center gap-1", className)} role="radiogroup" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} ${i === 1 ? "estrella" : "estrellas"}`}
          disabled={disabled}
          onClick={() => onChange(i)}
          className="rounded transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <Star
            style={{ width: size, height: size, fill: i <= value ? "currentColor" : "none" }}
            className={i <= value ? "text-amber-500" : "text-amber-400/50"}
          />
        </button>
      ))}
    </div>
  );
}
