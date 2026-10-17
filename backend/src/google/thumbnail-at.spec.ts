import { thumbnailAt } from './google.service';

describe('Drive thumbnail size', () => {
  it('asks for a larger preview', () => {
    expect(thumbnailAt('https://lh3.googleusercontent.com/abc=s220', 1600)).toBe('https://lh3.googleusercontent.com/abc=s1600');
    expect(thumbnailAt('https://x/abc=s220-c', 5000)).toBe('https://x/abc=s2000');
    expect(thumbnailAt('https://x/abc', 800)).toBe('https://x/abc=s800');
    expect(thumbnailAt('https://x/abc=s220')).toBe('https://x/abc=s220');
  });
});
