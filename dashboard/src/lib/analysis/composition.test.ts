import { composition } from './composition';
import { mk } from './testutil';

it('sums the four token kinds', () => {
  const c = composition([mk({ total_fresh_input_tokens: 1, total_cache_write_tokens: 2, total_cache_read_tokens: 3, total_output_tokens: 4 })]);
  expect(c).toEqual({ fresh: 1, cacheWrite: 2, cacheRead: 3, output: 4, total: 10 });
});
