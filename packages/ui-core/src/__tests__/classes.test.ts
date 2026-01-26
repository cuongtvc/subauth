import { describe, it, expect } from 'vitest';
import { cn, classNames } from '../utils/classes';

describe('cn (class name utility)', () => {
  it('should merge string class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle undefined and null values', () => {
    expect(cn('foo', undefined, 'bar', null)).toBe('foo bar');
  });

  it('should handle boolean conditions with objects', () => {
    expect(cn('foo', { bar: true, baz: false })).toBe('foo bar');
  });

  it('should handle arrays of class names', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('should handle nested arrays', () => {
    expect(cn('foo', ['bar', ['baz']])).toBe('foo bar baz');
  });

  it('should handle mixed inputs', () => {
    expect(
      cn('foo', { bar: true }, ['baz', { qux: false }], undefined, 'quux')
    ).toBe('foo bar baz quux');
  });

  it('should handle empty inputs', () => {
    expect(cn()).toBe('');
    expect(cn('')).toBe('');
    expect(cn(undefined)).toBe('');
  });

  it('should trim whitespace', () => {
    expect(cn('  foo  ', '  bar  ')).toBe('foo bar');
  });

  it('should handle false, 0, and empty string', () => {
    expect(cn('foo', false, 0, '', 'bar')).toBe('foo bar');
  });
});

describe('classNames (alias)', () => {
  it('should be an alias for cn', () => {
    expect(classNames('foo', 'bar')).toBe(cn('foo', 'bar'));
    expect(classNames({ foo: true, bar: false })).toBe(
      cn({ foo: true, bar: false })
    );
  });
});
