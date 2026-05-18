import type { RunEvent } from "../store";

/** Open an SSE connection for a run. Caller closes it on task_complete/error. */
export function streamRun(
  taskId: string,
  onEvent: (e: RunEvent) => void,
): EventSource {
  const es = new EventSource(`/api/run/${taskId}/events`);
  es.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data) as RunEvent);
    } catch {
      /* ignore keep-alive comments / malformed payloads */
    }
  };
  return es;
}
