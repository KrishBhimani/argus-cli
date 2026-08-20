import { cleanSnippet, splitMarks } from './cleanSnippet';

it('strips command wrappers and keeps stdout content', () => {
  expect(cleanSnippet('<command-name>/model</command-name>\n<command-message>model</command-message>\n<command-args></command-args>')).toBe('');
  expect(cleanSnippet('<local-command-stdout>Set model to X</local-command-stdout>')).toBe('Set model to X');
  expect(cleanSnippet('<local-command-caveat>Caveat: ignore</local-command-caveat> real text')).toBe('real text');
});

it('splitMarks yields plain and marked runs', () => {
  expect(splitMarks('a <mark>b</mark> c')).toEqual([{ t: 'a ', m: false }, { t: 'b', m: true }, { t: ' c', m: false }]);
});
