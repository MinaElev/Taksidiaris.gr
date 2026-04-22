import Anthropic from '@anthropic-ai/sdk';
import { STYLE_GUIDE } from './ai-prompts';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing in .env');
  _client = new Anthropic({ apiKey, maxRetries: 5 });
  return _client;
}

export const MODEL = 'claude-opus-4-7';
export const MAX_TOKENS = 7500;

export function extractJson(text: string): any {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return JSON.parse(t);
}

export async function callClaude(userPrompt: string, opts: { system?: string; maxTokens?: number } = {}): Promise<{ text: string; usage: any }> {
  const client = getClient();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? MAX_TOKENS,
    thinking: { type: 'adaptive' },
    system: [
      { type: 'text', text: opts.system ?? STYLE_GUIDE, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });
  const finalMessage = await stream.finalMessage();
  let text = '';
  for (const block of finalMessage.content) {
    if (block.type === 'text') text += block.text;
  }
  return { text, usage: finalMessage.usage };
}
