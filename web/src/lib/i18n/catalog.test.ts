import { describe, expect, it } from 'vitest';
import { messages } from './catalog';
describe('message catalog', () => { it('keeps locale keys identical', () => expect(Object.keys(messages.zh).sort()).toEqual(Object.keys(messages.en).sort())); });
