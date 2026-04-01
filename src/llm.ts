import Anthropic from '@anthropic-ai/sdk';

export type Provider = 'anthropic' | 'openai' | 'gemini';

export function detectProvider(apiKey: string): Provider | null {
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  if (apiKey.startsWith('sk-')) return 'openai';
  if (apiKey.startsWith('AI')) return 'gemini';
  return null;
}

export function providerName(provider: Provider): string {
  switch (provider) {
    case 'anthropic': return 'Anthropic (Claude)';
    case 'openai': return 'OpenAI (GPT-4.1)';
    case 'gemini': return 'Google (Gemini)';
  }
}

export async function generateResponse(
  apiKey: string,
  provider: Provider,
  system: string,
  userMessage: string,
): Promise<string> {
  switch (provider) {
    case 'anthropic':
      return generateAnthropic(apiKey, system, userMessage);
    case 'openai':
      return generateOpenAI(apiKey, system, userMessage);
    case 'gemini':
      return generateGemini(apiKey, system, userMessage);
  }
}

async function generateAnthropic(apiKey: string, system: string, userMessage: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });
  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock?.text ?? 'I was unable to generate a response.';
}

async function generateOpenAI(apiKey: string, system: string, userMessage: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? 'I was unable to generate a response.';
}

async function generateGemini(apiKey: string, system: string, userMessage: string): Promise<string> {
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  return data.candidates[0]?.content?.parts[0]?.text ?? 'I was unable to generate a response.';
}
