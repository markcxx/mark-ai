/** Empty failed/stopped assistant replies are UI history, not valid model context.
 * Keep partial answers and every user turn; never substitute an error for an answer.
 */
export function prepareRequestHistory<T extends { role: string; content: string }>(
  messages: T[],
): T[] {
  return messages.filter(
    (message) =>
      (message.role !== "model" && message.role !== "assistant") || Boolean(message.content.trim()),
  );
}
