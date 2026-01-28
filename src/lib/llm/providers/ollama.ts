import { buildMessages } from "@/lib/llm/buildMessages";
import type { LLMProvider, LLMRequest } from "@/lib/llm/LLMProvider";

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
};

export class OllamaProvider implements LLMProvider {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async generateResponse(request: LLMRequest): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.model,
        messages: buildMessages(request),
        stream: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama error: ${response.status} ${body}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const content = data.message?.content?.trim();
    if (!content) {
      throw new Error("Ollama response missing content");
    }
    return content;
  }
}
