import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

// Simple JSON-file database — no native deps, works everywhere.
// Data is tiny: group configs + recent message cache.

interface DbData {
  groups: Record<string, GroupRow>;
  messages: MessageRow[];
}

let data: DbData = { groups: {}, messages: [] };

const MAX_MESSAGES = 1000; // Keep last N messages to prevent unbounded growth

export function initDb(): void {
  const dir = dirname(config.databasePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (existsSync(config.databasePath)) {
    try {
      const raw = readFileSync(config.databasePath, 'utf-8');
      data = JSON.parse(raw) as DbData;
    } catch {
      data = { groups: {}, messages: [] };
    }
  }
}

function save(): void {
  writeFileSync(config.databasePath, JSON.stringify(data, null, 2));
}

// ─── Groups ──────────────────────────────────────────────────────────

export interface GroupRow {
  chat_id: string;
  chat_name: string | null;
  admin_user_id: string;
  lenny_token: string | null;
  llm_key: string | null;
  llm_provider: string | null;
  created_at: string;
}

export function getGroup(chatId: string): GroupRow | undefined {
  return data.groups[chatId];
}

export function upsertGroup(
  chatId: string,
  chatName: string | null,
  adminUserId: string,
): void {
  const existing = data.groups[chatId];
  data.groups[chatId] = {
    chat_id: chatId,
    chat_name: chatName,
    admin_user_id: adminUserId,
    lenny_token: existing?.lenny_token ?? null,
    llm_key: existing?.llm_key ?? null,
    llm_provider: existing?.llm_provider ?? null,
    created_at: existing?.created_at ?? new Date().toISOString(),
  };
  save();
}

export function setGroupLennyToken(chatId: string, token: string): void {
  const group = data.groups[chatId];
  if (group) {
    group.lenny_token = token;
    save();
  }
}

export function setGroupLlmKey(chatId: string, key: string, provider: string): void {
  const group = data.groups[chatId];
  if (group) {
    group.llm_key = key;
    group.llm_provider = provider;
    save();
  }
}

export function clearGroupKeys(chatId: string): void {
  const group = data.groups[chatId];
  if (group) {
    group.lenny_token = null;
    group.llm_key = null;
    group.llm_provider = null;
    save();
  }
}

export function getGroupByAdmin(adminUserId: string): GroupRow | undefined {
  return Object.values(data.groups).find(
    (g) => g.admin_user_id === adminUserId && !g.lenny_token,
  );
}

export function getGroupPendingLlmKey(adminUserId: string): GroupRow | undefined {
  return Object.values(data.groups).find(
    (g) => g.admin_user_id === adminUserId && g.lenny_token && !g.llm_key,
  );
}

// ─── Messages (thread context) ──────────────────────────────────────

export interface MessageRow {
  id: number;
  chat_id: string;
  message_id: number;
  role: string;
  content: string;
  reply_to_message_id: number | null;
  created_at: string;
}

let nextMessageId = 1;

export function saveMessage(
  chatId: string,
  messageId: number,
  role: string,
  content: string,
  replyToMessageId: number | null,
): void {
  data.messages.push({
    id: nextMessageId++,
    chat_id: chatId,
    message_id: messageId,
    role,
    content,
    reply_to_message_id: replyToMessageId,
    created_at: new Date().toISOString(),
  });

  // Trim old messages
  if (data.messages.length > MAX_MESSAGES) {
    data.messages = data.messages.slice(-MAX_MESSAGES);
  }

  save();
}

export function getThreadContext(
  chatId: string,
  messageId: number,
  maxDepth = 5,
): MessageRow[] {
  const thread: MessageRow[] = [];
  let currentId: number | null = messageId;

  while (currentId && thread.length < maxDepth) {
    const msg = data.messages.find(
      (m) => m.chat_id === chatId && m.message_id === currentId,
    );
    if (!msg) break;
    thread.unshift(msg);
    currentId = msg.reply_to_message_id;
  }

  return thread;
}
