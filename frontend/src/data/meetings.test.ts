import { describe, expect, it } from 'vitest';
import { isPlanned, locationTypeInfo, meetingStatus, meetingStatusInfo, needsReview } from './meetings';
import { isForRecord } from './tasks';

describe('meeting statuses', () => {
  it('reads older values as the new ones', () => {
    expect(meetingStatus('held')).toBe('occurred');
    expect(meetingStatus('Reviewed')).toBe('reviewed');
    expect(meetingStatus(undefined)).toBe('scheduled');
    expect(meetingStatusInfo('held').label).toBe('Occurred');
  });

  it('knows what still needs a review', () => {
    expect(needsReview({ status: 'occurred', date: '2026-10-01' }, '2026-10-10')).toBe(true);
    expect(needsReview({ status: 'scheduled', date: '2026-10-01' }, '2026-10-10')).toBe(true); // date passed, not marked
    expect(needsReview({ status: 'scheduled', date: '2026-10-20' }, '2026-10-10')).toBe(false);
    expect(needsReview({ status: 'reviewed', date: '2026-10-01' }, '2026-10-10')).toBe(false);
    expect(isPlanned('rescheduled')).toBe(true);
    expect(isPlanned('cancelled')).toBe(false);
  });

  it('names how a meeting is held, and what is FOR RECORD', () => {
    expect(locationTypeInfo('text')?.label).toBe('Text Meeting');
    expect(locationTypeInfo(null)).toBeUndefined();
    expect(isForRecord({ topicType: 'Decision' })).toBe(true);
    expect(isForRecord({ topicType: 'Task' })).toBe(false);
  });
});
