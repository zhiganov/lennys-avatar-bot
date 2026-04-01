const MCP_URL = 'https://mcp.lennysdata.com/mcp';

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

interface McpJsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export class LennyMcpClient {
  private token: string;
  private requestId = 0;
  private sessionId: string | null = null;

  constructor(token: string) {
    this.token = token;
  }

  private async sendRequest(method: string, params: Record<string, unknown>): Promise<McpJsonRpcResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.token}`,
    };

    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
    }

    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers,
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

    // Store session ID from response
    const newSessionId = res.headers.get('mcp-session-id');
    if (newSessionId) {
      this.sessionId = newSessionId;
    }

    // Parse response — may be SSE or plain JSON
    const contentType = res.headers.get('content-type') ?? '';
    const text = await res.text();

    if (contentType.includes('text/event-stream')) {
      return parseSseResponse(text);
    }
    return JSON.parse(text) as McpJsonRpcResponse;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.sessionId) return;
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'lennys-avatar-bot', version: '0.1.0' },
    });
    // Send initialized notification (no response expected)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.token}`,
    };
    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
    }
    await fetch(MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
    });
  }

  private extractToolResultText(response: McpJsonRpcResponse): string {
    if (response.error) {
      throw new Error(`MCP error: ${response.error.message}`);
    }
    const result = response.result as { content?: Array<{ type: string; text: string }> } | undefined;
    const textContent = result?.content?.find((c) => c.type === 'text');
    return textContent?.text ?? '';
  }

  async searchContent(query: string, contentType = '', limit = 10): Promise<SearchResult[]> {
    await this.ensureInitialized();
    const response = await this.sendRequest('tools/call', {
      name: 'search_content',
      arguments: { query, content_type: contentType, limit },
    });
    console.log('[lenny] searchContent raw response:', JSON.stringify(response).slice(0, 500));
    const text = this.extractToolResultText(response);
    console.log('[lenny] searchContent extracted text:', text.slice(0, 300));
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      const results = parsed.results ?? parsed ?? [];
      console.log('[lenny] searchContent results count:', results.length);
      return results;
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
    await this.ensureInitialized();
    const response = await this.sendRequest('tools/call', {
      name: 'read_excerpt',
      arguments: { filename, query, match_index: matchIndex, radius },
    });
    const text = this.extractToolResultText(response);
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      // MCP returns error field when no excerpts match
      if (parsed.error || parsed.total_excerpts === 0) {
        return null;
      }
      return parsed as ExcerptResult;
    } catch {
      return null;
    }
  }
}

/**
 * Parse SSE response text to extract the JSON-RPC message.
 * Format: "event: message\ndata: {...}\n\n"
 */
function parseSseResponse(text: string): McpJsonRpcResponse {
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const json = line.slice(6);
      return JSON.parse(json) as McpJsonRpcResponse;
    }
  }
  throw new Error(`Could not parse SSE response: ${text.slice(0, 200)}`);
}

export class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}
