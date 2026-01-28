import type { ChatMessage } from "@/lib/types";
import type { LLMRequest } from "@/lib/llm/LLMProvider";

type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function toProviderRole(role: ChatMessage["role"]): ProviderMessage["role"] | null {
  if (role === "user" || role === "assistant") {
    return role;
  }
  return null;
}

export function buildMessages(request: LLMRequest): ProviderMessage[] {
  const messages: ProviderMessage[] = [
    { role: "system", content: request.systemPrompt },
    {
      role: "system",
      content: `Resume data (JSON): ${JSON.stringify(request.resumeContext)}`,
    },
  ];

  if (request.bulletContext) {
    messages.push({
      role: "system",
      content: `Bullet story context (id: ${request.bulletContext.id}): ${JSON.stringify(
        request.bulletContext,
      )}`,
    });
  }

  for (const message of request.chatHistory) {
    const role = toProviderRole(message.role);
    if (role) {
      messages.push({ role, content: message.content });
    }
  }

  messages.push({ role: "user", content: request.userMessage });

  return messages;
}
