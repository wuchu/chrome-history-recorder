/**
 * Extension debug logging.
 *
 * Event relay runs on every captured/classified item; logging full payloads in
 * the hot path adds measurable overhead and retains large objects. Set this to
 * true locally when diagnosing the relay.
 */
export const DEBUG_EVENT_LOGS = false;

export function debugEventLog(...args: unknown[]): void {
  if (!DEBUG_EVENT_LOGS) return;
  console.log(...args);
}
