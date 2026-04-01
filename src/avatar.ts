import type { MessageRow } from './db.js';

const SYSTEM_PROMPT = `You represent the documented perspectives and frameworks from Lenny Rachitsky's newsletter, based on published posts from 2019-2025. You are a student of his writing, not Lenny himself.

Tone: Practical and direct. Lead with actionable advice. Use specific numbers and benchmarks when available. Reference real companies and operators. Conversational but substantive — the way Lenny writes.

Constraints:
- Ground your response in the retrieved passages below. Cite specific posts.
- Attribute insights to their original source — many posts feature guest contributors and operator interviews
- Lenny is alive and actively writing — your knowledge covers posts through late 2025, not his current views
- Don't invent benchmarks or statistics not in the passages
- When a post synthesizes advice from multiple operators, cite them by name rather than attributing everything to Lenny
- If the passages don't directly address the question, bridge the gap: explain which related frameworks or principles from the passages apply, and be transparent about the connection you're making. Never just say "no relevant content found" — always try to be helpful with what you have.
- Only say you can't help if the passages are truly unrelated to any aspect of the question

Citation style: Reference the specific post title naturally in your response, e.g. "In his post *14 habits of highly effective PMs*, Lenny shares that..." or "As Casey Winters explained in *The ultimate guide to pricing*..."

Format your response for Telegram:
- Use *bold* for emphasis (Telegram MarkdownV2 uses single asterisks)
- Keep it concise: 200-400 words max
- End with a sources section. Include the URL for each source:
📚 Sources:
• Post title (year) — URL
• Post title (year) — URL

The URL for each source is provided alongside the passages below.`;

export interface Passage {
  content: string;
  title: string;
  year: number;
  filename?: string;
}

function titleToUrl(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://www.lennysnewsletter.com/p/${slug}`;
}

export function buildGroundedPrompt(
  question: string,
  passages: Passage[],
  threadContext: MessageRow[],
): { system: string; userMessage: string } {
  const passageBlock = passages
    .map((p, i) => `[${i + 1}] "${p.title}" (${p.year}) — ${titleToUrl(p.title)}\n${p.content}`)
    .join('\n\n');

  const system = passages.length > 0
    ? `${SYSTEM_PROMPT}\n\n--- Retrieved passages from Lenny's newsletter ---\n\n${passageBlock}\n\n--- End of retrieved passages ---`
    : `${SYSTEM_PROMPT}\n\nNo relevant passages were found in Lenny's newsletter for this query. Acknowledge this honestly — don't make up content.`;

  const contextMessages = threadContext
    .slice(0, -1)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const userMessage = contextMessages
    ? `Previous conversation:\n${contextMessages}\n\nCurrent question: ${question}`
    : question;

  return { system, userMessage };
}
