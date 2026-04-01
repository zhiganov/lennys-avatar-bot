import { PostHog } from 'posthog-node';
import { config } from './config.js';

let posthog: PostHog | null = null;

export function initAnalytics(): void {
  if (!config.posthogKey) {
    console.log('No POSTHOG_API_KEY set, analytics disabled');
    return;
  }
  posthog = new PostHog(config.posthogKey, { host: config.posthogHost });
}

export function shutdownAnalytics(): Promise<void> {
  return posthog?.shutdown() ?? Promise.resolve();
}

// Use group chat_id as the distinct_id — we track group-level usage, not individual users
export function track(
  event: string,
  chatId: string,
  properties?: Record<string, unknown>,
): void {
  if (!posthog) return;
  posthog.capture({
    distinctId: `tg_group_${chatId}`,
    event,
    properties: {
      chat_id: chatId,
      ...properties,
    },
  });
}
