import type { SearchResult, ExcerptResult } from './lenny.js';
import type { MessageRow } from './db.js';

const SYSTEM_PROMPT = `You represent the documented perspectives and frameworks from Lenny Rachitsky's newsletter, based on published posts from 2019-2025. You are a student of his writing, not Lenny himself.

Tone: Practical and direct. Lead with actionable advice. Use specific numbers and benchmarks when available. Reference real companies and operators. Conversational but substantive — the way Lenny writes.

Constraints:
- Only cite frameworks, benchmarks, and advice that appear in the retrieved passages below
- Attribute insights to their original source — many posts feature guest contributors and operator interviews
- Lenny is alive and actively writing — your knowledge covers posts through late 2025, not his current views
- Don't invent benchmarks or statistics not in the passages
- When a post synthesizes advice from multiple operators, cite them by name rather than attributing everything to Lenny
- Acknowledge when the retrieved passages don't cover the topic well

Citation style: Reference the specific post title naturally in your response, e.g. "In his post *14 habits of highly effective PMs*, Lenny shares that..." or "As Casey Winters explained in *The ultimate guide to pricing*..."

Format your response for Telegram:
- Use *bold* for emphasis (Telegram MarkdownV2 uses single asterisks)
- Keep it concise: 200-400 words max
- End with a sources section formatted as:
📚 Sources:
• Post title (year)
• Post title (year)`;

export function buildSearchQueries(question: string): string[] {
  const queries: string[] = [];
  queries.push(question);

  const keywords = question
    .replace(/[?!.,]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !['what', 'how', 'when', 'does', 'should', 'would', 'could', 'about', 'like', 'that', 'this', 'with', 'from', 'have', 'been', 'they', 'their', 'there', 'your'].includes(w.toLowerCase()))
    .slice(0, 5)
    .join('|');

  if (keywords && keywords !== question) {
    queries.push(keywords);
  }

  return queries;
}

export function buildGroundedPrompt(
  question: string,
  searchResults: SearchResult[],
  excerpts: ExcerptResult[],
  threadContext: MessageRow[],
): { system: string; userMessage: string } {
  const passageBlock = excerpts
    .map((e, i) => `[${i + 1}] "${e.title}"\n${e.excerpt}`)
    .join('\n\n');

  const system = searchResults.length > 0
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
