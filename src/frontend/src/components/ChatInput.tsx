import { SendHorizonal } from "lucide-react";
import { type FormEvent, type RefObject, useEffect, useState } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  placeholder?: string;
  /** When set, pre-fills the input with this value (e.g. from opener/assist injection) */
  injectedValue?: string;
  /** Called when injectedValue has been consumed (cleared externally) */
  onInjectedConsumed?: () => void;
}

export function ChatInput({
  onSend,
  disabled,
  inputRef,
  placeholder,
  injectedValue,
  onInjectedConsumed,
}: Props) {
  const [value, setValue] = useState("");

  // Sync injected value into the input (opener/assist text injection)
  // biome-ignore lint/correctness/useExhaustiveDependencies: injectedValue drives this effect
  useEffect(() => {
    if (injectedValue !== undefined && injectedValue !== "") {
      setValue(injectedValue);
      onInjectedConsumed?.();
      // Focus the input so user can immediately edit or send
      setTimeout(() => inputRef?.current?.focus(), 30);
    }
  }, [injectedValue]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 px-4 py-3 border-t border-border bg-card"
    >
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? "Type your reply…"}
          disabled={disabled}
          className="w-full bg-muted text-foreground placeholder:text-muted-foreground rounded-full px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed transition-smooth"
          data-ocid="chat.input"
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="w-11 h-11 rounded-full bg-gradient-to-br from-[oklch(0.65_0.22_280)] to-[oklch(0.58_0.24_310)] flex items-center justify-center flex-shrink-0 disabled:opacity-30 hover:opacity-90 hover:scale-105 active:scale-90 transition-all duration-200 ease-out shadow-md disabled:cursor-not-allowed"
        data-ocid="chat.send_button"
        aria-label="Send message"
      >
        <SendHorizonal className="w-4 h-4 text-white" />
      </button>
    </form>
  );
}
