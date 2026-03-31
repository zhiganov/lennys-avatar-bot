const MCP_URL = 'https://mcp.lennysdata.com/mcp';

interface McpResponse {
  result?: {
    content?: Array<{ type: string; text: string }>;
  };
  error?: { code: number; message: string };
}

export interface SearchResult {
  title: string;
  filename: string;
  content_type: string;
  date: string;
  snippet: string;
  tags: string[];
}

export interface ExcerptResult {
  excerpt: string;
  filename: string;
  title: string;
}

export class LennyMcpClient {
  private token: string;
  private requestId = 0;

  constructor(token: string) {
    this.token = token;
  }

  private async call(method: string, params: Record<string, unknown>): Promise<McpResponse> {
    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++this.requestId,
        method,
        params,
      }),
    });

    if (res.status === 401) {
      throw new TokenExpiredError('Lenny MCP token expired or invalid');
    }

    if (!res.ok) {
      throw new Error(`Lenny MCP error: ${res.status} ${res.statusText}`);
    }

    return (await res.json()) as McpResponse;
  }

  private extractText(response: McpResponse): string {
    if (response.error) {
      throw new Error(`MCP error: ${response.error.message}`);
    }
    const textContent = response.result?.content?.find((c) => c.type === 'text');
    return textContent?.text ?? '';
  }

  async searchContent(query: string, contentType = '', limit = 10): Promise<SearchResult[]> {
    const response = await this.call('tools/call', {
      name: 'search_content',
      arguments: { query, content_type: contentType, limit },
    });
    const text = this.extractText(response);
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      return parsed.results ?? parsed ?? [];
    } catch {
      return [];
    }
  }

  async readExcerpt(
    filename: string,
    query = '',
    matchIndex = 0,
    radius = 500,
  ): Promise<ExcerptResult | null> {
    const response = await this.call('tools/call', {
      name: 'read_excerpt',
      arguments: { filename, query, match_index: matchIndex, radius },
    });
    const text = this.extractText(response);
    if (!text) return null;
    try {
      return JSON.parse(text) as ExcerptResult;
    } catch {
      return null;
    }
  }
}

export class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}
