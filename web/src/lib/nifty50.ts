/**
 * Canonical Nifty 50 symbol list — kept in sync with api/main.py UNIVERSE.
 * Used for:
 *   • /signals/[symbol] generateStaticParams (ISR pre-render)
 *   • sitemap.ts stock entries
 *   • TrackRecordStats fallback list
 */
export const NIFTY50: { symbol: string; name: string }[] = [
  { symbol: "RELIANCE.NS",   name: "Reliance Industries" },
  { symbol: "TCS.NS",        name: "Tata Consultancy Services" },
  { symbol: "HDFCBANK.NS",   name: "HDFC Bank" },
  { symbol: "BHARTIARTL.NS", name: "Bharti Airtel" },
  { symbol: "ICICIBANK.NS",  name: "ICICI Bank" },
  { symbol: "INFY.NS",       name: "Infosys" },
  { symbol: "SBIN.NS",       name: "State Bank of India" },
  { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever" },
  { symbol: "ITC.NS",        name: "ITC Ltd" },
  { symbol: "LT.NS",         name: "Larsen & Toubro" },
  { symbol: "KOTAKBANK.NS",  name: "Kotak Mahindra Bank" },
  { symbol: "BAJFINANCE.NS", name: "Bajaj Finance" },
  { symbol: "HCLTECH.NS",    name: "HCL Technologies" },
  { symbol: "AXISBANK.NS",   name: "Axis Bank" },
  { symbol: "ASIANPAINT.NS", name: "Asian Paints" },
  { symbol: "MARUTI.NS",     name: "Maruti Suzuki India" },
  { symbol: "SUNPHARMA.NS",  name: "Sun Pharmaceutical" },
  { symbol: "TITAN.NS",      name: "Titan Company" },
  { symbol: "WIPRO.NS",      name: "Wipro" },
  { symbol: "ULTRACEMCO.NS", name: "UltraTech Cement" },
  { symbol: "NESTLEIND.NS",  name: "Nestlé India" },
  { symbol: "POWERGRID.NS",  name: "Power Grid Corp" },
  { symbol: "NTPC.NS",       name: "NTPC" },
  { symbol: "ONGC.NS",       name: "ONGC" },
  { symbol: "TMCV.NS",       name: "Tata Motors" },
  { symbol: "TATASTEEL.NS",  name: "Tata Steel" },
  { symbol: "JSWSTEEL.NS",   name: "JSW Steel" },
  { symbol: "ADANIPORTS.NS", name: "Adani Ports" },
  { symbol: "BAJAJFINSV.NS", name: "Bajaj Finserv" },
  { symbol: "HDFCLIFE.NS",   name: "HDFC Life Insurance" },
  { symbol: "SBILIFE.NS",    name: "SBI Life Insurance" },
  { symbol: "DIVISLAB.NS",   name: "Divi's Laboratories" },
  { symbol: "DRREDDY.NS",    name: "Dr. Reddy's Labs" },
  { symbol: "CIPLA.NS",      name: "Cipla" },
  { symbol: "EICHERMOT.NS",  name: "Eicher Motors" },
  { symbol: "HEROMOTOCO.NS", name: "Hero MotoCorp" },
  { symbol: "BAJAJ-AUTO.NS", name: "Bajaj Auto" },
  { symbol: "TECHM.NS",      name: "Tech Mahindra" },
  { symbol: "GRASIM.NS",     name: "Grasim Industries" },
  { symbol: "BRITANNIA.NS",  name: "Britannia Industries" },
  { symbol: "COALINDIA.NS",  name: "Coal India" },
  { symbol: "BPCL.NS",       name: "BPCL" },
  { symbol: "M&M.NS",        name: "Mahindra & Mahindra" },
  { symbol: "TATACONSUM.NS", name: "Tata Consumer Products" },
  { symbol: "APOLLOHOSP.NS", name: "Apollo Hospitals" },
  { symbol: "INDUSINDBK.NS", name: "IndusInd Bank" },
  { symbol: "ADANIENT.NS",   name: "Adani Enterprises" },
  { symbol: "SHRIRAMFIN.NS", name: "Shriram Finance" },
  { symbol: "IDFCFIRSTB.NS", name: "IDFC First Bank" },
];

/** Slug used in URLs: "RELIANCE.NS" → "RELIANCE" */
export function toSlug(symbol: string): string {
  return symbol.replace(".NS", "").replace(".BO", "").replace(/[^A-Z0-9&\-]/gi, "");
}

/** Reverse slug → full symbol: "RELIANCE" → "RELIANCE.NS" */
export function fromSlug(slug: string): string {
  const upper = slug.toUpperCase();
  const match = NIFTY50.find(
    (s) => s.symbol === upper || s.symbol === `${upper}.NS` || s.symbol === `${upper}.BO`
  );
  return match?.symbol ?? `${upper}.NS`;
}
