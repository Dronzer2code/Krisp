import { describe, expect, it } from 'vitest';
import { validateWorkspace } from '../api/workspaces';
import { newWorkspace } from '../src/model/defaults';

describe('validateWorkspace', () => {
  it('accepts a new Workspace (id null)', () => {
    expect(validateWorkspace(newWorkspace())).toBeNull();
  });
  it('accepts a saved Workspace id', () => {
    expect(validateWorkspace({ ...newWorkspace(), id: '0bece7e6-65d1-43ac-8320-37b1e027846c' })).toBeNull();
  });
  it.each([
    ['not an object', null],
    ['bad id', { ...newWorkspace(), id: 'x; DROP TABLE' }],
    ['empty name', { ...newWorkspace(), name: '  ' }],
    ['long name', { ...newWorkspace(), name: 'x'.repeat(101) }],
    ['wrong version', { ...newWorkspace(), version: 2 }],
    ['missing beats', { ...newWorkspace(), beats: undefined }],
    ['missing mixer', { ...newWorkspace(), mixer: null }],
  ])('rejects %s', (_label, w) => {
    expect(validateWorkspace(w)).not.toBeNull();
  });
});
