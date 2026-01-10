"use client"

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Bot, User, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";

interface ChatMessageProps {
  role: "user" | "model";
  content: string;
}

const markdownStyles = [
  "prose prose-sm dark:prose-invert max-w-none",
  "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5",
  "prose-headings:my-2",
  "prose-pre:my-2 prose-pre:bg-background/50 prose-pre:p-2 prose-pre:rounded",
  "prose-code:text-xs prose-code:bg-background/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
].join(" ");

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    try {
      // Get the rendered HTML from the content element
      const htmlContent = contentRef.current?.innerHTML || "";
      
      // Create clipboard items with both HTML and plain text formats
      // This preserves formatting when pasting into rich text apps like iPhone Notes
      const clipboardItem = new ClipboardItem({
        "text/html": new Blob([htmlContent], { type: "text/html" }),
        "text/plain": new Blob([content], { type: "text/plain" }),
      });
      
      await navigator.clipboard.write([clipboardItem]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback to plain text if ClipboardItem is not supported
      try {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error("Failed to copy text:", fallbackErr);
      }
    }
  };

  return (
    <div className={cn("flex gap-3 mb-4", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
        isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>
      <div className={cn(
        "rounded-lg px-4 py-2 max-w-[80%] text-sm relative group",
        isUser ? "bg-primary text-primary-foreground" : "bg-muted"
      )}>
        {isUser ? (
          <span className="whitespace-pre-wrap">{content}</span>
        ) : (
          <>
            <div ref={contentRef} className={markdownStyles}>
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              onClick={handleCopy}
              title={copied ? "Copiado!" : "Copiar resposta"}
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
