interface Props {
  name?: string;
}

export function TypingIndicator({ name }: Props) {
  return (
    <div
      className="flex w-full mb-1 px-4 animate-[fadeSlideIn_0.25s_ease-out]"
      data-ocid="chat.typing_indicator"
    >
      <div className="chat-bubble-ai flex items-center gap-1 py-3.5 px-4">
        <span className="text-xs text-muted-foreground mr-1.5">
          {name} is typing
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
