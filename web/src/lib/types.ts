export type Verdict = "BUY" | "HOLD" | "SELL";

export interface IndicatorResult {
  value: number;
  score: number;
  series: number[];
  label: string;
}

// EMA stack: 20 / 50 / 200 alignment gives a very fast read of trend.
export interface EmaStackResult {
  ema20: number;
  ema50: number;
  ema200: number;
  status: "bullish" | "bearish" | "mixed";
  score: number;
  priceSeries: number[];
  ema20Series: number[];
  ema50Series: number[];
  ema200Series: number[];
  label: string;
}

// Mansfield/IBD-style Relative Strength vs Nifty 500.
export interface RelativeStrengthResult {
  rating: number;         // 0..100
  ratio: number;
  score: number;
  ratioSeries: number[];
  label: string;
}

// Delivery % — uniquely Indian signal. Ratio of delivery-backed shares
// to total traded, compared to its own rolling baseline.
// regime > 1 AND rising price → accumulation.
export interface DeliveryResult {
  deliveryPct: number;        // today's delivery %
  deliveryPct5d: number;      // 5-day average
  deliveryPct20d: number;     // 20-day average (baseline)
  regime: number;             // 5d / 20d
  priceDelta5v20: number;     // (5d avg close - 20d avg close) / 20d avg close
  status: "accumulating" | "distributing" | "noise";
  score: number;              // -1..1
  series: number[];           // daily delivery % history for sparkline
  label: string;              // e.g. "58% · accumulating"
}

// Volume trend + rolling VWAP(20).
// status combines volume direction with price-vs-VWAP position.
export interface VolumeVwapResult {
  volumeTrend: "rising" | "falling" | "flat";
  vwap20: number;                 // rolling 20-day VWAP
  priceVsVwapPct: number;         // (price - vwap) / vwap * 100
  aboveVwap: boolean;
  score: number;                  // -1..1 combined
  priceSeries: number[];
  vwapSeries: number[];
  volumeSeries: number[];         // for the bar-band visual
  label: string;
}

// AI-powered news sentiment via Claude claude-haiku-4-5.
export interface AiNewsResult {
  score: number;          // -1..1
  label: string;          // "Very Bullish" | "Bullish" | "Neutral" | "Bearish" | "Very Bearish"
  summary: string;        // one-sentence digest
  headlines: string[];    // top 5 raw headlines for the tooltip
  source: "claude-haiku" | "fallback";
}

// AI synthesis — Claude's plain-English explanation of the fusion verdict.
export interface AiSynthesisResult {
  verdict: string;   // 2-3 sentence analysis
  bull: string;      // strongest bull case
  bear: string;      // strongest bear case
  risk: string;      // primary risk factor
  // Claude-suggested price levels (grounded in EMA/VWAP data fed to the prompt)
  target?: number;   // nearest upside resistance in INR
  stop?: number;     // nearest downside support in INR
  source: "claude-haiku" | "fallback";
  reason?: string;   // fallback reason, only when source === "fallback"
}

// Algorithmically-derived support/resistance — always present, used as
// fallback when synthesis is unavailable.
export interface PriceLevels {
  target: number;       // nearest resistance (INR)
  stop: number;         // nearest support (INR)
  targetLabel: string;  // e.g. "EMA50" | "VWAP" | "est"
  stopLabel: string;
}

/** A stock whose fusion probability changed meaningfully since the last compute cycle. */
export interface MoverResult {
  symbol:           string;
  name:             string;
  price:            number;
  verdict:          Verdict;
  prev_verdict:     Verdict;
  probability:      number;
  prev_probability: number;
  prob_delta:       number;      // signed, 0–1 scale
  prob_delta_pct:   number;      // signed percentage points, e.g. +12.5
  direction:        "up" | "down";
  verdict_changed:  boolean;
}

/** Lightweight stock shape returned by /screener — no price series. */
export interface SlimStock {
  symbol: string;
  name: string;
  price: number;
  verdict: Verdict;
  probability: number;
}

export interface TallyResult {
  symbol: string;
  verdict: string | null;
  agree_count: number;
  disagree_count: number;
  total: number;
}

export interface StockSnapshot {
  symbol: string;
  name: string;
  price: number;
  currency: "INR";
  priceSeries: number[];
  indicators: {
    rs: RelativeStrengthResult;
    delivery: DeliveryResult;
    ema: EmaStackResult;
    momentum: IndicatorResult;
    volume: VolumeVwapResult;
    aiNews?: AiNewsResult;
  };
  fusion: {
    probability: number;
    verdict: Verdict;
    weights: Record<string, number>;
    synthesis?: AiSynthesisResult;
    priceLevels?: PriceLevels;
  };
  asOf: string;
}
