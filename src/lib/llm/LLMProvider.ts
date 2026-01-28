import type { ChatMessage, ResumeBullet } from "@/lib/types";

export type LLMRequest = {
  systemPrompt: string;
  resumeContext: unknown;
  chatHistory: ChatMessage[];
  userMessage: string;
  bulletContext?: ResumeBullet | null;
  model: string;
};

export interface LLMProvider {
  generateResponse(request: LLMRequest): Promise<string>;
}
