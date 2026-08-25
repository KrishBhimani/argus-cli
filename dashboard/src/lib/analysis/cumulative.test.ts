import { cumulative } from './cumulative';

it('cumulative', () => expect(cumulative([1, 2, 3])).toEqual([1, 3, 6]));
