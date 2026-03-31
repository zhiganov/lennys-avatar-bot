import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

let db: Database.Database;

export function initDb(): void {
  const dir = dirname(config.databasePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(config.databasePath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      chat_id TEXT PRIMARY KEY,
      chat_name TEXT,
      admin_user_id TEXT NOT NULL,
      lenny_token TEXT,
      anthropic_key TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      message_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      reply_to_message_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_reply
      ON messages(chat_id, reply_to_message_id);
  `);
}

function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized — call initDb() first');
  return db;
}

export interface GroupRow {
  chat_id: string;
  chat_name: string | null;
  admin_user_id: string;
  lenny_token: string | null;
  anthropic_key: string | null;
  created_at: string;
}

export function getGroup(chatId: string): GroupRow | undefined {
  return getDb()
    .prepare('SELECT * FROM groups WHERE chat_id = ?')
    .get(chatId) as GroupRow | undefined;
}

export function upsertGroup(
  chatId: string,
  chatName: string | null,
  adminUserId: string,
): void {
  getDb()
    .prepare(
      `INSERT INTO groups (chat_id, chat_name, admin_user_id)
       VALUES (?, ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET
         chat_name = excluded.chat_name,
         admin_user_id = excluded.admin_user_id`,
    )
    .run(chatId, chatName, adminUserId);
}

export function setGroupLennyToken(chatId: string, token: string): void {
  getDb()
    .prepare('UPDATE groups SET lenny_token = ? WHERE chat_id = ?')
    .run(token, chatId);
}

export function setGroupAnthropicKey(chatId: string, key: string): void {
  getDb()
    .prepare('UPDATE groups SET anthropic_key = ? WHERE chat_id = ?')
    .run(key, chatId);
}

export function clearGroupKeys(chatId: string): void {
  getDb()
    .prepare('UPDATE groups SET lenny_token = NULL, anthropic_key = NULL WHERE chat_id = ?')
    .run(chatId);
}

export function getGroupByAdmin(adminUserId: string): GroupRow | undefined {
  return getDb()
    .prepare(
      `SELECT * FROM groups
       WHERE admin_user_id = ? AND lenny_token IS NULL
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(adminUserId) as GroupRow | undefined;
}

export function getGroupPendingAnthropicKey(adminUserId: string): GroupRow | undefined {
  return getDb()
    .prepare(
      `SELECT * FROM groups
       WHERE admin_user_id = ? AND lenny_token IS NOT NULL AND anthropic_key IS NULL
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(adminUserId) as GroupRow | undefined;
}

export interface MessageRow {
  id: number;
  chat_id: string;
  message_id: number;
  role: string;
  content: string;
  reply_to_message_id: number | null;
  created_at: string;
}

export function saveMessage(
  chatId: string,
  messageId: number,
  role: string,
  content: string,
  replyToMessageId: number | null,
): void {
  getDb()
    .prepare(
      `INSERT INTO messages (chat_id, message_id, role, content, reply_to_message_id)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(chatId, messageId, role, content, replyToMessageId);
}

export function getThreadContext(
  chatId: string,
  messageId: number,
  maxDepth = 5,
): MessageRow[] {
  const thread: MessageRow[] = [];
  let currentId: number | null = messageId;

  while (currentId && thread.length < maxDepth) {
    const msg = getDb()
      .prepare('SELECT * FROM messages WHERE chat_id = ? AND message_id = ?')
      .get(chatId, currentId) as MessageRow | undefined;

    if (!msg) break;
    thread.unshift(msg);
    currentId = msg.reply_to_message_id;
  }

  return thread;
}
