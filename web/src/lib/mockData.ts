import type { StockSnapshot } from "./types";

// Deterministic pseudo-random so server + client render the same numbers
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function makeSeries(rand: () => number, base: number, len = 240, vol = 0.02) {
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < len; i++) {
    v = v * (1 + (rand() - 0.5) * vol);
    out.push(+v.toFixed(2));
  }
  return out;
}

function ema(series: number[], p: number): number[] {
  if (!series.length) return [];
  const k = 2 / (p + 1);
  const out: number[] = [series[0]];
  for (let i = 1; i < series.length; i++) {
    out.push(series[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

function sma(series: number[], p: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < series.length; i++) {
    sum += series[i];
    if (i >= p) sum -= series[i - p];
    out.push(sum / Math.min(i + 1, p));
  }
  return out;
}

// Rolling VWAP with window p.  VWAP = Σ(price × vol) / Σ(vol) over last p bars.
function rollingVwap(price: number[], volume: number[], p: number): number[] {
  const out: number[] = [];
  let pvSum = 0;
  let vSum = 0;
  for (let i = 0; i < price.length; i++) {
    pvSum += price[i] * volume[i];
    vSum += volume[i];
    if (i >= p) {
      pvSum -= price[i - p] * volume[i - p];
      vSum -= volume[i - p];
    }
    out.push(vSum > 0 ? pvSum / vSum : price[i]);
  }
  return out;
}

const UNIVERSE: { symbol: string; name: string; basePrice: number }[] = [
  { symbol: "RELIANCE.NS", name: "Reliance Industries", basePrice: 2890 },
  { symbol: "TCS.NS", name: "Tata Consultancy Services", basePrice: 3970 },
  { symbol: "INFY.NS", name: "Infosys", basePrice: 1680 },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank", basePrice: 1520 },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank", basePrice: 1140 },
  { symbol: "SBIN.NS", name: "State Bank of India", basePrice: 815 },
  { symbol: "BHARTIARTL.NS", name: "Bharti Airtel", basePrice: 1490 },
  { symbol: "ITC.NS", name: "ITC Ltd", basePrice: 432 },
  { symbol: "LT.NS", name: "Larsen & Toubro", basePrice: 3680 },
  { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever", basePrice: 2380 },
  { symbol: "^NSEI", name: "Nifty 50", basePrice: 22640 },
  { symbol: "^BSESN", name: "Sensex", basePrice: 74560 },
];

const NIFTY500_SEED = 0xbadf00d;
function niftyBaseline(len: number): number[] {
  return makeSeries(seeded(NIFTY500_SEED), 21000, len, 0.012);
}

function hashSymbol(sym: string): number {
  let h = 2166136261;
  for (let i = 0; i < sym.length; i++) {
    h ^= sym.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(x: number, lo = -1, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

export function getMockSnapshot(symbol: string): StockSnapshot {
  const meta =
    UNIVERSE.find((u) => u.symbol === symbol.toUpperCase()) ?? UNIVERSE[0];
  const rand = seeded(hashSymbol(meta.symbol));

  const priceSeries = makeSeries(rand, meta.basePrice, 240, 0.022);
  const last = priceSeries[priceSeries.length - 1];

  // --- Volume series (mock) — correlate loosely with |price change| ---
  const baseVol = 1_000_000 + Math.floor(rand() * 4_000_000);
  const volumeSeries: number[] = priceSeries.map((p, i) => {
    const dp =
      i === 0 ? 0 : Math.abs((priceSeries[i] - priceSeries[i - 1]) / priceSeries[i - 1]);
    const noise = 0.5 + rand();
    return Math.round(baseVol * (1 + dp * 20) * noise);
  });

  // --- RS vs Nifty 500 ---
  const n500 = niftyBaseline(priceSeries.length);
  const ratioSeries = priceSeries.map((p, i) => +(p / n500[i]).toFixed(6));
  const rs1y =
    ratioSeries[ratioSeries.length - 1] /
    ratioSeries[Math.max(0, ratioSeries.length - 240)];
  const rs3m =
    ratioSeries[ratioSeries.length - 1] /
    ratioSeries[Math.max(0, ratioSeries.length - 60)];
  const blended = 0.6 * (rs1y - 1) + 0.4 * (rs3m - 1);
  const rsRating = Math.max(0, Math.min(100, Math.round(50 + blended * 180)));
  const rsScore = +(((rsRating - 50) / 50)).toFixed(2);

  // --- EMA 20 / 50 / 200 stack ---
  const ema20Series = ema(priceSeries, 20);
  const ema50Series = ema(priceSeries, 50);
  const ema200Series = ema(priceSeries, 200);
  const e20 = ema20Series[ema20Series.length - 1];
  const e50 = ema50Series[ema50Series.length - 1];
  const e200 = ema200Series[ema200Series.length - 1];
  const stackStatus: "bullish" | "bearish" | "mixed" =
    e20 > e50 && e50 > e200
      ? "bullish"
      : e20 < e50 && e50 < e200
      ? "bearish"
      : "mixed";
  const emaScore =
    stackStatus === "bullish" ? 1 : stackStatus === "bearish" ? -1 : 0;
  const emaLabel =
    stackStatus === "bullish"
      ? "20 > 50 > 200"
      : stackStatus === "bearish"
      ? "20 < 50 < 200"
      : "Mixed";

  // --- Delivery % (mock, seeded) ---
  // Typical NSE mid/large-caps: 35%..75%. Seeded per stock.
  const deliverySeries: number[] = Array.from({ length: 40 }, () =>
    +(35 + rand() * 40).toFixed(2)
  );
  const deliveryPct = deliverySeries[deliverySeries.length - 1];
  const d5 =
    deliverySeries.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const d20 =
    deliverySeries.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const regime = d5 / d20;
  const close5 =
    priceSeries.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const close20 =
    priceSeries.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const priceDelta = (close5 - close20) / close20;
  const deliveryScore = clamp(2 * (regime - 1) + 3 * priceDelta);
  const deliveryStatus: "accumulating" | "distributing" | "noise" =
    deliveryScore > 0.25
      ? "accumulating"
      : deliveryScore < -0.25
      ? "distributing"
      : "noise";

  // --- Momentum (20D % change) ---
  const momentumPct =
    ((last - priceSeries[Math.max(0, priceSeries.length - 20)]) /
      priceSeries[Math.max(0, priceSeries.length - 20)]) *
    100;
  const momScore = clamp(momentumPct / 10);

  // --- Volume trend + rolling VWAP(20) ---
  const vwapSeries = rollingVwap(priceSeries, volumeSeries, 20);
  const vwap = vwapSeries[vwapSeries.length - 1];
  const priceVsVwapPct = ((last - vwap) / vwap) * 100;
  const aboveVwap = last > vwap;
  const volSma5 = sma(volumeSeries, 5);
  const volSma20 = sma(volumeSeries, 20);
  const volRatio =
    volSma5[volSma5.length - 1] / volSma20[volSma20.length - 1];
  const volumeTrend: "rising" | "falling" | "flat" =
    volRatio > 1.1 ? "rising" : volRatio < 0.9 ? "falling" : "flat";
  // Combined score: half price-vs-VWAP, half volume direction polarity.
  const vwapSub = clamp(priceVsVwapPct / 5); // ±5% → ±1
  const volSub =
    volumeTrend === "rising" ? 0.6 : volumeTrend === "falling" ? -0.6 : 0;
  // Volume direction is only bullish if price > vwap; otherwise rising volume
  // on a falling/below-vwap stock is a bearish distribution.
  const volScore = clamp(0.5 * vwapSub + 0.5 * volSub * (aboveVwap ? 1 : -1));

  // --- Fusion (new weights after MACD → Delivery %) ---
  const weights = {
    rs: 0.22,
    delivery: 0.22,
    ema: 0.2,
    momentum: 0.18,
    volume: 0.18,
  };
  const weighted =
    rsScore * weights.rs +
    deliveryScore * weights.delivery +
    emaScore * weights.ema +
    momScore * weights.momentum +
    volScore * weights.volume;

  const probability = +(0.5 + weighted / 2).toFixed(2);
  const verdict =
    probability >= 0.6 ? "BUY" : probability <= 0.4 ? "SELL" : "HOLD";

  const tail = <T,>(arr: T[], n = 60): T[] => arr.slice(-n);

  return {
    symbol: meta.symbol,
    name: meta.name,
    price: last,
    currency: "INR",
    priceSeries: tail(priceSeries, 90),
    indicators: {
      rs: {
        rating: rsRating,
        ratio: ratioSeries[ratioSeries.length - 1],
        score: rsScore,
        ratioSeries: tail(ratioSeries, 90),
        label: `RS ${rsRating}`,
      },
      delivery: {
        deliveryPct: +deliveryPct.toFixed(1),
        deliveryPct5d: +d5.toFixed(1),
        deliveryPct20d: +d20.toFixed(1),
        regime: +regime.toFixed(2),
        priceDelta5v20: +(priceDelta * 100).toFixed(2),
        status: deliveryStatus,
        score: +deliveryScore.toFixed(2),
        series: deliverySeries,
        label: `${deliveryPct.toFixed(0)}% · ${deliveryStatus}`,
      },
      ema: {
        ema20: +e20.toFixed(2),
        ema50: +e50.toFixed(2),
        ema200: +e200.toFixed(2),
        status: stackStatus,
        score: emaScore,
        priceSeries: tail(priceSeries, 90),
        ema20Series: tail(ema20Series, 90),
        ema50Series: tail(ema50Series, 90),
        ema200Series: tail(ema200Series, 90),
        label: emaLabel,
      },
      momentum: {
        value: +momentumPct.toFixed(1),
        score: +momScore.toFixed(2),
        series: tail(priceSeries, 60),
        label: `${momentumPct > 0 ? "+" : ""}${momentumPct.toFixed(1)}%`,
      },
      volume: {
        volumeTrend,
        vwap20: +vwap.toFixed(2),
        priceVsVwapPct: +priceVsVwapPct.toFixed(2),
        aboveVwap,
        score: +volScore.toFixed(2),
        priceSeries: tail(priceSeries, 90),
        vwapSeries: tail(vwapSeries, 90),
        volumeSeries: tail(volumeSeries, 90),
        label: `${aboveVwap ? "↑" : "↓"} VWAP · vol ${volumeTrend}`,
      },
    },
    fusion: { probability, verdict, weights },
    asOf: "2026-04-06T15:30:00+05:30",
  };
}

export function getRankedUniverse(): StockSnapshot[] {
  return UNIVERSE.map((u) => getMockSnapshot(u.symbol)).sort(
    (a, b) => b.fusion.probability - a.fusion.probability
  );
}
