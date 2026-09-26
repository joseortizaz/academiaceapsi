import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const toggle = () => {
      const input = inputRef.current;
      const start = input?.selectionStart;
      const end = input?.selectionEnd;
      const direction = input?.selectionDirection;
      setVisible((current) => !current);
      requestAnimationFrame(() => {
        input?.focus({ preventScroll: true });
        if (start != null && end != null) input?.setSelectionRange(start, end, direction);
      });
    };

    return (
      <div className="relative">
        <Input
          {...props}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
        />
        <Button
          type="button"
          variant="ghost"
          tabIndex={-1}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggle}
          disabled={props.disabled}
          className="absolute inset-y-0 right-0 h-full rounded-l-none px-3 text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };