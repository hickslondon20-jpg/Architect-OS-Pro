import { describe, expect, it } from 'vitest';

import { selectRecoverableAssistantMessage, type Message } from './virtualCsoApi';

/**
 * Defect 8 (04B-D2 SDK-M3, run 4). The SSE stream died while the backend finished normally: the
 * assistant answer was persisted with 33 citations 140ms before the run completed, and the founder was
 * shown "the turn was not saved" for a turn that had in fact succeeded. Recovery reads the record
 * instead of inferring loss from the absence of a `done` event.
 *
 * The failure mode to guard hardest is the opposite one — silently showing an OLD answer as if it were
 * the reply to the message just sent.
 */

const message = (role: Message['role'], createdAt: string, id = `${role}-${createdAt}`): Message => ({
  id,
  chatId: 'thread-1',
  role,
  content: `${role} content`,
  createdAt,
});

describe('selectRecoverableAssistantMessage', () => {
  it('recovers the assistant answer written after the user message', () => {
    const sent = message('user', '2026-07-22T17:31:05.000Z');
    const persisted = [sent, message('assistant', '2026-07-22T17:33:36.200Z')];

    const recovered = selectRecoverableAssistantMessage(persisted, sent);

    expect(recovered?.createdAt).toBe('2026-07-22T17:33:36.200Z');
  });

  it('refuses a stale answer from earlier in the thread', () => {
    const previousAnswer = message('assistant', '2026-07-22T17:10:00.000Z');
    const sent = message('user', '2026-07-22T17:31:05.000Z');

    // The backend never wrote a reply this turn: the newest assistant message predates the request.
    expect(selectRecoverableAssistantMessage([previousAnswer, sent], sent)).toBeNull();
  });

  it('recovers nothing when the stream died before the user message was known', () => {
    // Without the sent message there is no way to tell this turn's answer from the previous turn's.
    const persisted = [message('assistant', '2026-07-22T17:33:36.200Z')];

    expect(selectRecoverableAssistantMessage(persisted, null)).toBeNull();
  });

  it('recovers nothing from a thread with no assistant messages', () => {
    const sent = message('user', '2026-07-22T17:31:05.000Z');

    expect(selectRecoverableAssistantMessage([sent], sent)).toBeNull();
  });

  it('accepts an answer written in the same millisecond as the request', () => {
    const sent = message('user', '2026-07-22T17:31:05.000Z');
    const answer = message('assistant', '2026-07-22T17:31:05.000Z');

    expect(selectRecoverableAssistantMessage([sent, answer], sent)).toBe(answer);
  });

  it('ignores an unparseable timestamp rather than guessing', () => {
    const sent = message('user', 'not-a-date');
    const answer = message('assistant', '2026-07-22T17:33:36.200Z');

    expect(selectRecoverableAssistantMessage([sent, answer], sent)).toBeNull();
  });
});
