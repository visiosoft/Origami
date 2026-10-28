import { describe, expect, it } from 'vitest';
import {
  composeLeadName, isEventSource, isOtherValue, isReferralSource, offersOther, optionsWith,
  preferredName, primaryContactMethod, splitLeadName,
} from './leads';

describe('lead names', () => {
  it('composes first and last, falling back when both are empty', () => {
    expect(composeLeadName(' Ana ', 'Diaz')).toBe('Ana Diaz');
    expect(composeLeadName('', '', ' Diaz Family ')).toBe('Diaz Family');
  });
  it('splits on the first word and keeps compound surnames', () => {
    expect(splitLeadName('Pieter van der Berg')).toEqual({ firstName: 'Pieter', lastName: 'van der Berg' });
    expect(splitLeadName('Cher')).toEqual({ firstName: 'Cher', lastName: '' });
    expect(splitLeadName('  ')).toEqual({ firstName: '', lastName: '' });
  });
  it('prefers the go-by name', () => {
    expect(preferredName({ goByName: 'Bobby', firstName: 'Robert', leadName: 'Robert Lee' })).toBe('Bobby');
    expect(preferredName({ firstName: '', leadName: 'Robert Lee' })).toBe('Robert Lee');
  });
});

describe('"Other" answers', () => {
  // Regression: these regexes once held a literal backspace instead of \b and never matched.
  it('recognises an Other answer', () => {
    expect(isOtherValue('Other')).toBe(true);
    expect(isOtherValue(' other (please specify) ')).toBe(true);
    expect(isOtherValue('Others')).toBe(false);
    expect(isOtherValue('Mother-in-law suite')).toBe(false);
    expect(isOtherValue(undefined)).toBe(false);
  });
  it('knows which drop-downs offer Other', () => {
    expect(offersOther('leadSource')).toBe(true);
    expect(offersOther('pronouns')).toBe(true);
    expect(offersOther('clientPersonality')).toBe(false);
    expect(offersOther(undefined)).toBe(false);
  });
});

describe('lead sources and options', () => {
  it('matches referral and event sources, including legacy wording', () => {
    expect(isReferralSource('Referral - Past Client')).toBe(true);
    expect(isEventSource('Home Show')).toBe(true);
    expect(isEventSource('Google')).toBe(false);
  });
  it('keeps a stored value that is no longer in the list', () => {
    expect(optionsWith(['Spouse', 'Partner'], 'Spouse / Partner')).toEqual(['Spouse / Partner', 'Spouse', 'Partner']);
    expect(optionsWith(['Spouse', 'Partner'], 'Spouse')).toEqual(['Spouse', 'Partner']);
  });
  it('picks primary contact methods, else secondary', () => {
    expect(primaryContactMethod(undefined)).toBe('');
    expect(primaryContactMethod({ 'Cell Phone Text': 'Secondary', 'Primary Email': 'No' })).toBe('Cell Phone Text');
    expect(primaryContactMethod({ 'Primary Email': 'Primary', 'Cell Phone Call': 'Primary', 'Video Call': 'Secondary' }))
      .toBe('Cell Phone Call, Primary Email');
  });
});
