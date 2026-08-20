import { Overview, SessionList, Timeline, ToolsOverview, TrendsResponse, AlertList } from './schemas';
import overview from './__fixtures__/overview.json';
import sessions from './__fixtures__/sessions.json';
import timeline from './__fixtures__/timeline.json';
import tools from './__fixtures__/tools-overview.json';
import trends from './__fixtures__/trends.json';
import alerts from './__fixtures__/alerts.json';
import { toServerWindow } from './client';

it('schemas accept recorded server responses', () => {
  expect(Overview.parse(overview).total_tokens).toBeTypeOf('number');
  expect(SessionList.parse(sessions).sessions.length).toBeGreaterThan(0);
  expect(Timeline.parse(timeline).turns[0].tool_calls).toBeInstanceOf(Array);
  expect(ToolsOverview.parse(tools).tool_leaderboard[0].error_rate).toBeTypeOf('number');
  expect(TrendsResponse.parse(trends).points[0].groups).toBeTypeOf('object');
  expect(AlertList.parse(alerts).alerts).toBeInstanceOf(Array);
});

it('schemas reject a drifted shape loudly', () => {
  expect(() => Overview.parse({ ...overview, total_tokens: 'lots' })).toThrow();
});

it('maps the UI window names to the server names', () => {
  expect(toServerWindow('24h')).toBe('today');
  expect(toServerWindow('7d')).toBe('7d');
});
