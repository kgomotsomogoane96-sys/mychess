export type ServerEvent = { type: string; message?: string; imported?: number; scanned?: number; complete?: boolean; cursor?: number; total?: number; [key: string]: unknown };

export async function readEventStream(response: Response, onEvent: (event: ServerEvent) => void) {
  if (!response.ok || !response.body) {
    let message = "The server couldn't start this job.";
    try { const json = await response.json(); if (json.error) message = json.error; } catch { /* keep fallback */ }
    throw new Error(message);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const line = event.split("\n").find(item => item.startsWith("data: "));
      if (!line) continue;
      try { onEvent(JSON.parse(line.slice(6)) as ServerEvent); } catch { /* ignore malformed event */ }
    }
  }
}
