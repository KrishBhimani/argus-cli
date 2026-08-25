import { render } from '@testing-library/react';
import { CalendarHeatmap } from './CalendarHeatmap';

it('renders one cell per day with a title', () => {
  const { container } = render(<CalendarHeatmap byDay={{ '2026-08-21': 5 }} days={14} end={new Date('2026-08-21T12:00:00')} />);
  expect(container.querySelectorAll('rect[data-day]').length).toBe(14);
  expect(container.querySelector('rect[data-day="2026-08-21"] title')?.textContent).toMatch(/2026-08-21/);
});
