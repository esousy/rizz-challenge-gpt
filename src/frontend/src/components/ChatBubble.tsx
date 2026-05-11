import { cn } from "@/lib/utils";
import type { Message } from "@/types";

interface Props {
  message: Message;
}

export function ChatBubble({ message }: Props) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex w-full mb-1.5 px-4 animate-[fadeSlideIn_0.25s_ease-out]",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          isUser
            ? "bg-gradient-to-br from-[oklch(0.65_0.22_280)] to-[oklch(0.58_0.24_310)] text-accent-foreground rounded-2xl rounded-br-sm px-4 py-3 max-w-[75%] break-words shadow-md text-[15px] leading-relaxed"
            : "chat-bubble-ai",
        )}
        data-ocid={isUser ? "chat.user_bubble" : "chat.ai_bubble"}
      >
        {message.content}
      </div>
    </div>
  );
}
