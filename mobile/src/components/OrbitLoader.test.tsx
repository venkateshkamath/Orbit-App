import React from 'react';
import renderer from 'react-test-renderer';
import { OrbitLoader } from './OrbitLoader';

declare const jest: { mock: (name: string, factory: () => unknown) => void };
declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => { toBeTruthy: () => void; toContain: (text: string) => void; not: { toContain: (text: string) => void } };

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

describe('OrbitLoader', () => {
  it('renders the default branded loader', () => {
    const tree = renderer.create(<OrbitLoader />).toJSON();
    expect(tree).toBeTruthy();
  });

  it('renders inline without the orbit word', () => {
    const tree = renderer.create(<OrbitLoader variant="inline" size="sm" />).toJSON();
    expect(JSON.stringify(tree)).not.toContain('orbit');
  });

  it('renders fullscreen overlay', () => {
    const tree = renderer.create(<OrbitLoader variant="fullscreen" size="lg" />).toJSON();
    expect(JSON.stringify(tree)).toContain('BlurView');
  });
});
