import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

/** Campo de 6 dígitos para el código del autenticador. Envía al completar. */
export function CodigoVerificacion({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
}) {
  return (
    <InputOTP
      id={id}
      maxLength={6}
      value={value}
      onChange={(v) => onChange(v.replace(/\D/g, ""))}
      onComplete={onComplete}
      disabled={disabled}
      autoFocus={autoFocus}
      inputMode="numeric"
      pattern="^[0-9]*$"
      autoComplete="one-time-code"
      aria-label="Código de 6 dígitos"
    >
      <InputOTPGroup>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
