import { channelsFor, channelWarnings, cleanMatrix } from './matrix';

describe('notification matrix', () => {
  it('keeps known events and channels only; [] means no notification', () => {
    expect(cleanMatrix({ lead_new: ['text_now', 'bogus', 'text_now'], nope: ['email_now'], past_due: [] })).toEqual({ lead_new: ['text_now'], past_due: [] });
  });
  it('uses what someone chose, else the defaults', () => {
    expect(channelsFor({ notificationMatrix: null }, 'lead_status')).toEqual(['email_daily']);
    expect(channelsFor({ notificationMatrix: { lead_status: ['text_daily'] } }, 'lead_status')).toEqual(['text_daily']);
    expect(channelsFor({ notificationMatrix: { lead_status: [] } }, 'lead_status')).toEqual([]);
  });
  it('the old "no assignment emails" switch still holds until they choose', () => {
    expect(channelsFor({ notificationMatrix: null, notifyOnAssignment: false }, 'task_assigned')).toEqual([]);
    expect(channelsFor({ notificationMatrix: { task_assigned: ['email_now'] }, notifyOnAssignment: false }, 'task_assigned')).toEqual(['email_now']);
  });
  it('warns when texts are chosen without a phone number', () => {
    expect(channelWarnings({ lead_new: ['text_now'] }, { phone: false, email: true, smsReady: true })[0]).toMatch(/no phone number/);
    expect(channelWarnings({ lead_new: ['text_now'] }, { phone: true, email: true, smsReady: false })[0]).toMatch(/aren’t set up/);
    expect(channelWarnings(null, { phone: false, email: true, smsReady: false })).toEqual([]);
  });
});
