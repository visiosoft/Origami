import { describe, expect, it } from 'vitest';
import { tagSuggestions } from './tagBank';

describe('tagSuggestions', () => {
  it('leaves out tags already on the item, de-duplicates, and puts prefix matches first', () => {
    expect(tagSuggestions(['Kitchen', 'Roof', 'kitchen', 'Punch list'], ['roof'], '')).toEqual(['Kitchen', 'Punch list']);
    expect(tagSuggestions(['Backsplash', 'Kitchen', 'Kitchen sink'], [], 'kit')).toEqual(['Kitchen', 'Kitchen sink']);
    expect(tagSuggestions(['Backsplash', 'Kitchen'], [], 'sp')).toEqual(['Backsplash']);
  });
});
