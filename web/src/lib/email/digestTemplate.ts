export interface DigestBuy {
  symbol: string;
  name: string;
  prob: number;
  prev_verdict?: string;
}

export interface DigestSell {
  symbol: string;
  name: string;
  prob: number;
  prev_verdict?: string;
}

export function buildDigestEmail(opts: {
  date: string;
  buys: DigestBuy[];
  sells: DigestSell[];
  totalChanges: number;
}): { subject: string; html: string; text: string } {
  const { date, buys, sells, totalChanges } = opts;

  const subject = `MarketMithra \u2014 ${totalChanges} signal change${totalChanges !== 1 ? "s" : ""} today (${date})`;

  // ── HTML helpers ────────────────────────────────────────────────────────────

  function pct(prob: number): string {
    return `${Math.round(prob * 100)}%`;
  }

  function buyRows(): string {
    if (buys.length === 0) return "";
    const rows = buys
      .map(
        (b) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #d1fae5;font-weight:600;color:#065f46;">${b.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #d1fae5;text-align:center;color:#059669;font-weight:700;">${pct(b.prob)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #d1fae5;text-align:center;color:#6b7280;font-size:13px;">was: ${b.prev_verdict ?? "—"}</td>
        </tr>`
      )
      .join("");

    return `
    <div style="margin-bottom:24px;">
      <div style="background:#059669;color:#fff;font-size:13px;font-weight:700;letter-spacing:0.05em;padding:8px 16px;border-radius:6px 6px 0 0;">
        BUY SIGNALS &nbsp;&#9650;
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f0fdf4;border:1px solid #d1fae5;border-top:none;border-radius:0 0 6px 6px;">
        <thead>
          <tr style="background:#dcfce7;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#065f46;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Stock</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#065f46;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Probability</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#065f46;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Change</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function sellRows(): string {
    if (sells.length === 0) return "";
    const rows = sells
      .map(
        (s) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #ffe4e6;font-weight:600;color:#9f1239;">${s.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #ffe4e6;text-align:center;color:#e11d48;font-weight:700;">${pct(s.prob)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #ffe4e6;text-align:center;color:#6b7280;font-size:13px;">was: ${s.prev_verdict ?? "—"}</td>
        </tr>`
      )
      .join("");

    return `
    <div style="margin-bottom:24px;">
      <div style="background:#e11d48;color:#fff;font-size:13px;font-weight:700;letter-spacing:0.05em;padding:8px 16px;border-radius:6px 6px 0 0;">
        SELL SIGNALS &nbsp;&#9660;
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff1f2;border:1px solid #ffe4e6;border-top:none;border-radius:0 0 6px 6px;">
        <thead>
          <tr style="background:#ffe4e6;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#9f1239;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Stock</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#9f1239;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Probability</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#9f1239;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Change</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  const noChanges =
    totalChanges === 0
      ? `<div style="background:#f3f4f6;border-radius:8px;padding:20px;text-align:center;color:#6b7280;margin-bottom:24px;">
          No verdict changes today \u2014 all signals stable.
        </div>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="width:44px;height:44px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#fff;text-align:center;line-height:44px;">M</div>
                  </td>
                  <td style="vertical-align:middle;padding-left:14px;">
                    <div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.02em;">MarketMithra</div>
                    <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:2px;">Daily Signal Digest &middot; ${date}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
                Here are today\u2019s Nifty 50 verdict changes, powered by six technical indicators fused into a single probability score.
              </p>

              ${noChanges}
              ${buyRows()}
              ${sellRows()}

              <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;text-align:center;">
                Signals update throughout the trading day.<br/>
                <a href="https://marketmithra.app" style="color:#f59e0b;text-decoration:none;font-weight:600;">Open MarketMithra</a> to see the full dashboard.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                You\u2019re receiving this because you subscribed at marketmithra.app &middot;
                <a href="https://marketmithra.app/unsubscribe?email={{email}}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ── Plain-text fallback ──────────────────────────────────────────────────────

  const buyText =
    buys.length > 0
      ? `\nBUY SIGNALS\n${"─".repeat(40)}\n` +
        buys.map((b) => `  ${b.name} (${b.symbol}) — ${pct(b.prob)}  [was: ${b.prev_verdict ?? "—"}]`).join("\n") +
        "\n"
      : "";

  const sellText =
    sells.length > 0
      ? `\nSELL SIGNALS\n${"─".repeat(40)}\n` +
        sells.map((s) => `  ${s.name} (${s.symbol}) — ${pct(s.prob)}  [was: ${s.prev_verdict ?? "—"}]`).join("\n") +
        "\n"
      : "";

  const noChangesText =
    totalChanges === 0 ? "\nNo verdict changes today — all signals stable.\n" : "";

  const text = [
    `MarketMithra — Daily Signal Digest`,
    `Date: ${date}`,
    `${"=".repeat(40)}`,
    noChangesText,
    buyText,
    sellText,
    `${"─".repeat(40)}`,
    `Open the dashboard: https://marketmithra.app`,
    `Unsubscribe: https://marketmithra.app/unsubscribe?email={{email}}`,
  ]
    .join("\n")
    .trim();

  return { subject, html, text };
}
