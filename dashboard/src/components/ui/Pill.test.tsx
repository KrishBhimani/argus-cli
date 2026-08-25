import { render, screen } from '@testing-library/react';
import { Pill } from './Pill';

it('status pills always carry an icon and a text label', () => {
  for (const kind of ['warn', 'crit', 'info', 'good'] as const) {
    const { unmount } = render(<Pill kind={kind}>LABEL</Pill>);
    const el = screen.getByText('LABEL').closest('span')!;
    expect(el.querySelector('svg')).not.toBeNull();
    unmount();
  }
});
