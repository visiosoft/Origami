import { describe, expect, it } from 'vitest';
import { dateFromText, parseInvite, timeFromText } from './meetingInvite';

const TODAY = '2026-10-28';

describe('parseInvite', () => {
  it('reads a Teams invite from the city', () => {
    const p = parseInvite(`Plan check comments — 123 Main St
When: Tuesday, November 4, 2026 10:00 AM-11:00 AM (UTC-08:00) Pacific Time
Organizer: Jane Ortiz <jortiz@lacity.org>
________________________________________________________________________________
Microsoft Teams meeting
Join on your computer, mobile app or room device
https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%7d
Meeting ID: 245 812 997 551
Passcode: Xk3Ps9
Or call in (audio only)
+1 213-621-0000,,412345678#`, TODAY);
    expect(p.platform).toBe('teams');
    expect(p.link).toMatch(/^https:\/\/teams\.microsoft\.com\/l\/meetup-join\//);
    expect(p.organizer).toBe('Jane Ortiz');
    expect(p.organizerEmail).toBe('jortiz@lacity.org');
    expect(p.organizerOrg).toBe('lacity.org');
    expect(p.meetingId).toBe('245 812 997 551');
    expect(p.passcode).toBe('Xk3Ps9');
    expect(p.date).toBe('2026-11-04');
    expect(p.time).toBe('10:00');
    expect(p.title).toBe('Plan check comments — 123 Main St');
    expect(p.phone).toContain('213-621-0000');
  });

  it('reads a Zoom invite', () => {
    const p = parseInvite(`Sam Lee is inviting you to a scheduled Zoom meeting.

Topic: Structural review
Time: Nov 12, 2026 02:30 PM Pacific Time (US and Canada)

Join Zoom Meeting
https://us02web.zoom.us/j/81234567890?pwd=abc123.

Meeting ID: 812 3456 7890
Passcode: 445566`, TODAY);
    expect(p.platform).toBe('zoom');
    expect(p.link).toBe('https://us02web.zoom.us/j/81234567890?pwd=abc123');
    expect(p.organizer).toBe('Sam Lee');
    expect(p.title).toBe('Structural review');
    expect(p.date).toBe('2026-11-12');
    expect(p.time).toBe('14:30');
  });

  it('reads a Google Calendar / Meet invite with no year', () => {
    const p = parseInvite(`Site coordination
Thursday, November 6 · 9:00 – 9:30am
Google Meet joining info
Video call link: https://meet.google.com/abc-defg-hij`, TODAY);
    expect(p.platform).toBe('meet');
    expect(p.link).toBe('https://meet.google.com/abc-defg-hij');
    expect(p.date).toBe('2026-11-06');
    expect(p.time).toBe('09:00');
    expect(p.title).toBe('Site coordination');
  });

  it('leaves out a free-mail domain as the organiser’s company', () => {
    expect(parseInvite('Organizer: bob@gmail.com', TODAY).organizerOrg).toBeUndefined();
  });

  it('calls a dial-in only invite a phone meeting', () => {
    expect(parseInvite('Dial +1 (310) 555-0100 at 3pm', TODAY).platform).toBe('phone');
  });
});

describe('dates and times', () => {
  it('reads common forms', () => {
    expect(dateFromText('11/4/2026', TODAY)).toBe('2026-11-04');
    expect(dateFromText('4 Dec 2026', TODAY)).toBe('2026-12-04');
    expect(dateFromText('Jan 8', TODAY)).toBe('2027-01-08');
    expect(timeFromText('10am')).toBe('10:00');
    expect(timeFromText('12:15 p.m.')).toBe('12:15');
    expect(timeFromText('12 AM')).toBe('00:00');
    expect(timeFromText('at 16:45')).toBe('16:45');
  });
});
