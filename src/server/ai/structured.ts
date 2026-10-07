import "server-only";
import { z } from "zod";

export interface StructuredInterpreter {
  generate<T>(schema: z.ZodType<T>, instructions: string, input: unknown): Promise<T>;
}
/** Local inference only: no hosted URL, API key, paid provider, or cloud model setting. */
export class OllamaInterpreter implements StructuredInterpreter {
  constructor(private request: typeof fetch = fetch) {}
  async generate<T>(schema: z.ZodType<T>, instructions: string, input: unknown): Promise<T> {
    const format = z.toJSONSchema(schema);
    const response = await this.request("http://127.0.0.1:11434/api/chat", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(45000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "qwen3:4b", stream: false, think: false, format,
        options: { temperature: 0, num_predict: 512, num_ctx: 8192 },
        messages: [{ role: "system", content: instructions + " Return only JSON matching this schema: " + JSON.stringify(format) },
          { role: "user", content: JSON.stringify(input) }] }),
    });
    if (!response.ok) throw new Error("Local AI interpretation unavailable.");
    const body = z.object({ done: z.literal(true), done_reason: z.literal("stop"),
      message: z.object({ content: z.string() }) }).parse(await response.json());
    return schema.parse(JSON.parse(body.message.content));
  }
}
