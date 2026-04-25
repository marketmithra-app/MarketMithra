# MarketMithra — Platform Knowledge Base
*For internal use by Mithra, the platform assistant. Updated manually as features ship.*

## What is MarketMithra?
MarketMithra is an educational stock research tool for Nifty 50 stocks. It does NOT give investment advice. It combines technical indicators into a transparent, ranked BUY/HOLD/SELL signal so retail traders can research stocks faster.

## How the Signal Works
Six indicators are computed for each stock. Each scores from -1 (fully bearish) to +1 (fully bullish). They are weighted and combined into a probability from 0% to 100%.
- Above 65% → BUY signal
- 35%–65% → HOLD signal
- Below 35% → SELL signal

### The Six Indicators
1. **Relative Strength (RS)** — How the stock performs vs the Nifty 500. A stock with RS above 75 is outperforming 75% of the market. High RS = institutions prefer this stock.
2. **NSE Delivery %** — Unique to Indian markets. From NSE bhavcopy data. High delivery % means buyers are taking delivery and holding — not short-term speculation. Consistently high delivery = institutional accumulation.
3. **EMA Stack (20/50/200)** — Exponential Moving Averages. When 20 EMA > 50 EMA > 200 EMA, the stock is in a full bullish trend. Any inversion is a warning sign.
4. **20-Day Momentum** — Raw price change over 20 trading days. Positive and rising = buying pressure. Stocks with strong momentum tend to stay strong (Newton's first law applied to markets).
5. **VWAP vs Volume** — Whether the stock is trading above its 20-day Volume Weighted Average Price with rising volume. Above VWAP + rising volume = institutional sponsorship.
6. **AI News Sentiment** — The latest 5 headlines for the stock are scored by AI from -1 (very negative) to +1 (very positive). Bad news in a good stock = opportunity. Good news in a weak stock = caution.

## Canvas (Visual Signal Flow)
The Canvas is the main product. It shows a node-graph where each indicator is a card. All cards wire into a "Probabilistic Fusion" node that outputs the final BUY/HOLD/SELL verdict. You can see exactly WHY a stock got a signal — no black box.

## Signals Page (/signals)
Browse all 49 Nifty 50 stocks ranked by signal strength. Filter by BUY/HOLD/SELL. Each card shows the verdict, probability, and key stats.

## Watchlist (/watchlist)
Save up to 20 stocks. No sign-up needed — stored privately on your device. Stocks sorted by signal strength. Subscribe to daily digest emails for verdict changes.

## Panic-O-Meter (/panic)
A composite fear/greed index for the Indian market. Score 0–100 where 0 = Extreme Greed, 100 = Extreme Panic. Built from: India VIX (35%), market breadth/% stocks above 200 EMA (30%), NSE delivery strength (20%), momentum breadth (15%). Updates every 30 minutes.

Zones: 0–20 Extreme Greed · 21–40 Greed · 41–60 Neutral · 61–80 Fear · 81–100 Extreme Panic.

Historically, Extreme Panic zones have been the best long-term buying opportunities (though past patterns don't guarantee future results).

## Stock DNA (/dna/[symbol])
A behavioral fingerprint for each stock — 3 years of data revealing personality and seasonality.
- **Beta**: How much the stock amplifies Nifty moves. Beta 0.7 = moves 70% of Nifty.
- **Volatility rank**: Low/Medium/High based on Average True Range.
- **Seasonality**: Which months historically see the stock rise or fall.
- **Personality types**: Defensive Compounder, Momentum Rocket, Steady Grinder, Volatile Wild Card, Macro Bet, Balanced Player.

## Sector Rotation (/sectors)
The Relative Rotation Graph shows all Nifty sectors plotted by RS-Ratio vs RS-Momentum. Four quadrants: Leading (strong + getting stronger), Weakening (strong but slowing), Lagging (weak + getting weaker), Improving (weak but recovering). Healthy rotation is clockwise.

## Track Record (/track-record)
Every signal is timestamped and public. No post-hoc edits are possible. The methodology is fully disclosed.

## Important Disclaimers
MarketMithra is an educational research tool. Nothing on the platform is investment advice. Always do your own research and consult a SEBI-registered advisor before investing. Past signals do not guarantee future performance.

## Common Questions

**Q: Is this advice?**
A: No. MarketMithra is an educational tool. The signals are based on quantitative technical indicators and are for research purposes only. Please consult a SEBI-registered advisor before investing.

**Q: How often do signals update?**
A: The ranked list updates approximately every 30 minutes. Individual stock signals update on each new analysis request.

**Q: Which stocks are covered?**
A: Currently the 49 active Nifty 50 constituent stocks on NSE.

**Q: Is it free?**
A: Yes — 5 analyses per day free. Pro plan removes the limit and adds advanced features.

**Q: Why is delivery % important?**
A: Delivery % is unique to NSE. When you buy a stock, you can either take delivery (you own it) or sell it the same day (intraday). High delivery % means real buyers are holding, not just day-traders. Consistently high delivery on rising prices = serious institutional accumulation — one of the strongest India-specific signals.
