import { describe, expect, it } from 'vitest';
import { toggleChannel } from './notifications';

describe('notification matrix', () => {
  it('ticks and unticks a channel; None clears the row', () => {
    expect(toggleChannel([], 'text_now')).toEqual(['text_now']);
    expect(toggleChannel(['text_now', 'email_daily'], 'text_now')).toEqual(['email_daily']);
    expect(toggleChannel(['text_now', 'email_daily'], 'none')).toEqual([]);
  });
});
