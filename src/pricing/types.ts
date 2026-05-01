export interface ModelPricing {
  input: number;
  output: number;
  cache_write_5m?: number;
  cache_write_1h?: number;
  cache_read: number;
}

export interface PricingTable {
  version: string;
  models: Record<string, ModelPricing>;
}
