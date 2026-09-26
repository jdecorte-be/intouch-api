import type { User } from '@prisma/client';

import {
  formatRelativeTime,
  getAvatarAccent,
  getDefaultAvatarUrl,
  getUserInitials,
  serializeSessionUser,
} from './format.util';

describe('format.util', () => {
  describe('getDefaultAvatarUrl', () => {
    const original = process.env.APP_BASE_URL;
    afterEach(() => {
      if (original === undefined) delete process.env.APP_BASE_URL;
      else process.env.APP_BASE_URL = original;
    });

    it('falls back to localhost when APP_BASE_URL is unset', () => {
      delete process.env.APP_BASE_URL;
      expect(getDefaultAvatarUrl('abc')).toBe(
        'http://localhost:4000/avatars/beam/abc',
      );
    });

    it('strips a trailing slash and encodes the seed', () => {
      process.env.APP_BASE_URL = 'https://api.example.com/';
      expect(getDefaultAvatarUrl('a b/c')).toBe(
        'https://api.example.com/avatars/beam/a%20b%2Fc',
      );
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-10T12:00:00Z'));
    });
    afterEach(() => jest.useRealTimers());

    it.each([
      [30_000, 'Just now'],
      [5 * 60_000, '5m ago'],
      [3 * 3_600_000, '3h ago'],
      [2 * 86_400_000, '2d ago'],
    ])('formats %ims ago as "%s"', (ms, expected) => {
      expect(formatRelativeTime(new Date(Date.now() - ms))).toBe(expected);
    });
  });

  describe('getUserInitials', () => {
    it.each([
      ['Jane Doe', 'JD'],
      ['Jane Mary Doe', 'JD'],
      ['madonna', 'MA'],
      ['jane@example.com', 'JA'],
      ['', 'U'],
      ['@example.com', 'U'],
    ])('%j -> %s', (input, expected) => {
      expect(getUserInitials(input)).toBe(expected);
    });
  });

  describe('getAvatarAccent', () => {
    it('is deterministic for a label', () => {
      expect(getAvatarAccent('jane')).toBe(getAvatarAccent('jane'));
    });

    it('returns a bg and text class', () => {
      expect(getAvatarAccent('x')).toEqual({
        bg: expect.any(String),
        text: expect.any(String),
      });
    });
  });

  describe('serializeSessionUser', () => {
    const base = {
      id: 'u1',
      name: 'Jane',
      email: null,
      image: null,
      photos: [],
      age: 30,
      gender: null,
      languagesSpoken: ['en'],
      role: 'USER',
      homeNeighborhood: null,
      homeLongitude: null,
      homeLatitude: null,
      eventInterests: [],
      eventGoals: [],
      createdAt: new Date('2025-03-15T10:00:00Z'),
      onboardingCompletedAt: null,
    } as unknown as User;

    it('normalises nulls and formats dates', () => {
      const result = serializeSessionUser(base);
      expect(result.email).toBe('');
      expect(result.homeCoordinates).toBeNull();
      expect(result.onboardingCompletedAt).toBeNull();
      expect(result.createdAt).toBe('2025-03-15T10:00:00.000Z');
      expect(result.memberSince).toMatch(/2025/);
    });

    it('returns coordinates as [longitude, latitude]', () => {
      const done = new Date('2025-04-01T00:00:00Z');
      const result = serializeSessionUser({
        ...base,
        homeLongitude: 4.35,
        homeLatitude: 50.85,
        onboardingCompletedAt: done,
      });
      expect(result.homeCoordinates).toEqual([4.35, 50.85]);
      expect(result.onboardingCompletedAt).toBe(done.toISOString());
    });
  });
});
