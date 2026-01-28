import { buildMessages } from "@/lib/llm/buildMessages";
import type { LLMProvider, LLMRequest } from "@/lib/llm/LLMProvider";

type ExternalChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export class ExternalProvider implements LLMProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  }

  async generateResponse(request: LLMRequest): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        messages: buildMessages(request),
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`External LLM error: ${response.status} ${body}`);
    }

    const data = (await response.json()) as ExternalChatResponse;
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("External LLM response missing content");
    }
    return content;
  }
}
