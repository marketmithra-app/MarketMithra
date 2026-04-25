/**
 * Static catalogue of common NSE tickers for the search typeahead.
 * Not exhaustive — just the heavily-traded large/mid caps + indices.
 * Users can still type any `.NS` / `.BO` suffix manually and the API will
 * resolve it via yfinance.
 */
export type TickerEntry = { symbol: string; name: string; sector?: string };

export const TICKERS: TickerEntry[] = [
  // Indices
  { symbol: "^NSEI", name: "Nifty 50", sector: "Index" },
  { symbol: "^BSESN", name: "Sensex", sector: "Index" },
  { symbol: "^CRSLDX", name: "Nifty 500", sector: "Index" },
  { symbol: "^NSEBANK", name: "Bank Nifty", sector: "Index" },

  // Top 50 heavyweights
  { symbol: "RELIANCE.NS", name: "Reliance Industries", sector: "Energy" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services", sector: "IT" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank", sector: "Bank" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank", sector: "Bank" },
  { symbol: "INFY.NS", name: "Infosys", sector: "IT" },
  { symbol: "BHARTIARTL.NS", name: "Bharti Airtel", sector: "Telecom" },
  { symbol: "SBIN.NS", name: "State Bank of India", sector: "Bank" },
  { symbol: "LT.NS", name: "Larsen & Toubro", sector: "Construction" },
  { symbol: "ITC.NS", name: "ITC", sector: "FMCG" },
  { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever", sector: "FMCG" },
  { symbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank", sector: "Bank" },
  { symbol: "AXISBANK.NS", name: "Axis Bank", sector: "Bank" },
  { symbol: "BAJFINANCE.NS", name: "Bajaj Finance", sector: "NBFC" },
  { symbol: "BAJAJFINSV.NS", name: "Bajaj Finserv", sector: "NBFC" },
  { symbol: "M&M.NS", name: "Mahindra & Mahindra", sector: "Auto" },
  { symbol: "MARUTI.NS", name: "Maruti Suzuki", sector: "Auto" },
  { symbol: "TMCV.NS", name: "Tata Motors", sector: "Auto" },
  { symbol: "TATASTEEL.NS", name: "Tata Steel", sector: "Metals" },
  { symbol: "JSWSTEEL.NS", name: "JSW Steel", sector: "Metals" },
  { symbol: "HINDALCO.NS", name: "Hindalco Industries", sector: "Metals" },
  { symbol: "COALINDIA.NS", name: "Coal India", sector: "Energy" },
  { symbol: "ONGC.NS", name: "Oil & Natural Gas", sector: "Energy" },
  { symbol: "NTPC.NS", name: "NTPC", sector: "Power" },
  { symbol: "POWERGRID.NS", name: "Power Grid", sector: "Power" },
  { symbol: "ADANIENT.NS", name: "Adani Enterprises", sector: "Conglomerate" },
  { symbol: "ADANIPORTS.NS", name: "Adani Ports", sector: "Infra" },
  { symbol: "ADANIGREEN.NS", name: "Adani Green Energy", sector: "Power" },
  { symbol: "ASIANPAINT.NS", name: "Asian Paints", sector: "Paints" },
  { symbol: "NESTLEIND.NS", name: "Nestle India", sector: "FMCG" },
  { symbol: "BRITANNIA.NS", name: "Britannia Industries", sector: "FMCG" },
  { symbol: "DABUR.NS", name: "Dabur India", sector: "FMCG" },
  { symbol: "GODREJCP.NS", name: "Godrej Consumer Products", sector: "FMCG" },
  { symbol: "TITAN.NS", name: "Titan Company", sector: "Consumer" },
  { symbol: "DMART.NS", name: "Avenue Supermarts (DMart)", sector: "Retail" },
  { symbol: "TRENT.NS", name: "Trent", sector: "Retail" },
  { symbol: "WIPRO.NS", name: "Wipro", sector: "IT" },
  { symbol: "HCLTECH.NS", name: "HCL Technologies", sector: "IT" },
  { symbol: "TECHM.NS", name: "Tech Mahindra", sector: "IT" },
  { symbol: "LTIM.NS", name: "LTIMindtree", sector: "IT" },
  { symbol: "PERSISTENT.NS", name: "Persistent Systems", sector: "IT" },
  { symbol: "COFORGE.NS", name: "Coforge", sector: "IT" },
  { symbol: "SUNPHARMA.NS", name: "Sun Pharmaceutical", sector: "Pharma" },
  { symbol: "DRREDDY.NS", name: "Dr. Reddy's Laboratories", sector: "Pharma" },
  { symbol: "CIPLA.NS", name: "Cipla", sector: "Pharma" },
  { symbol: "DIVISLAB.NS", name: "Divi's Laboratories", sector: "Pharma" },
  { symbol: "APOLLOHOSP.NS", name: "Apollo Hospitals", sector: "Healthcare" },
  { symbol: "MAXHEALTH.NS", name: "Max Healthcare Institute", sector: "Healthcare" },
  { symbol: "ULTRACEMCO.NS", name: "UltraTech Cement", sector: "Cement" },
  { symbol: "GRASIM.NS", name: "Grasim Industries", sector: "Cement" },
  { symbol: "SHREECEM.NS", name: "Shree Cement", sector: "Cement" },
  { symbol: "AMBUJACEM.NS", name: "Ambuja Cements", sector: "Cement" },
  { symbol: "HDFCLIFE.NS", name: "HDFC Life Insurance", sector: "Insurance" },
  { symbol: "SBILIFE.NS", name: "SBI Life Insurance", sector: "Insurance" },
  { symbol: "ICICIGI.NS", name: "ICICI Lombard General Insurance", sector: "Insurance" },
  { symbol: "ICICIPRULI.NS", name: "ICICI Prudential Life", sector: "Insurance" },
  { symbol: "INDUSINDBK.NS", name: "IndusInd Bank", sector: "Bank" },
  { symbol: "PNB.NS", name: "Punjab National Bank", sector: "Bank" },
  { symbol: "BANKBARODA.NS", name: "Bank of Baroda", sector: "Bank" },
  { symbol: "CANBK.NS", name: "Canara Bank", sector: "Bank" },
  { symbol: "IDFCFIRSTB.NS", name: "IDFC First Bank", sector: "Bank" },
  { symbol: "FEDERALBNK.NS", name: "Federal Bank", sector: "Bank" },
  { symbol: "CHOLAFIN.NS", name: "Cholamandalam Investment", sector: "NBFC" },
  { symbol: "SBICARD.NS", name: "SBI Cards", sector: "NBFC" },
  { symbol: "HEROMOTOCO.NS", name: "Hero MotoCorp", sector: "Auto" },
  { symbol: "BAJAJ-AUTO.NS", name: "Bajaj Auto", sector: "Auto" },
  { symbol: "EICHERMOT.NS", name: "Eicher Motors", sector: "Auto" },
  { symbol: "TVSMOTOR.NS", name: "TVS Motor", sector: "Auto" },
  { symbol: "ASHOKLEY.NS", name: "Ashok Leyland", sector: "Auto" },
  { symbol: "BOSCHLTD.NS", name: "Bosch", sector: "Auto" },
  { symbol: "MOTHERSON.NS", name: "Samvardhana Motherson", sector: "Auto" },
  { symbol: "IOC.NS", name: "Indian Oil Corporation", sector: "Energy" },
  { symbol: "BPCL.NS", name: "Bharat Petroleum", sector: "Energy" },
  { symbol: "GAIL.NS", name: "GAIL India", sector: "Energy" },
  { symbol: "VEDL.NS", name: "Vedanta", sector: "Metals" },
  { symbol: "HAL.NS", name: "Hindustan Aeronautics", sector: "Defence" },
  { symbol: "BEL.NS", name: "Bharat Electronics", sector: "Defence" },
  { symbol: "SIEMENS.NS", name: "Siemens", sector: "Engineering" },
  { symbol: "ABB.NS", name: "ABB India", sector: "Engineering" },
  { symbol: "HAVELLS.NS", name: "Havells India", sector: "Consumer Durables" },
  { symbol: "VOLTAS.NS", name: "Voltas", sector: "Consumer Durables" },
  { symbol: "DLF.NS", name: "DLF", sector: "Realty" },
  { symbol: "GODREJPROP.NS", name: "Godrej Properties", sector: "Realty" },
  { symbol: "OBEROIRLTY.NS", name: "Oberoi Realty", sector: "Realty" },
  { symbol: "ZOMATO.NS", name: "Zomato", sector: "Tech" },
  { symbol: "NYKAA.NS", name: "FSN E-Commerce (Nykaa)", sector: "Tech" },
  { symbol: "PAYTM.NS", name: "One 97 Communications (Paytm)", sector: "Fintech" },
  { symbol: "POLICYBZR.NS", name: "PB Fintech (PolicyBazaar)", sector: "Fintech" },
  { symbol: "IRCTC.NS", name: "Indian Railway Catering", sector: "Travel" },
  { symbol: "INDIGO.NS", name: "InterGlobe Aviation (IndiGo)", sector: "Airline" },
  { symbol: "PIDILITIND.NS", name: "Pidilite Industries", sector: "Chemicals" },
  { symbol: "SRF.NS", name: "SRF", sector: "Chemicals" },
  { symbol: "UPL.NS", name: "UPL", sector: "Agrochem" },
  { symbol: "PIIND.NS", name: "PI Industries", sector: "Agrochem" },
  { symbol: "LUPIN.NS", name: "Lupin", sector: "Pharma" },
  { symbol: "BIOCON.NS", name: "Biocon", sector: "Pharma" },
  { symbol: "AUROPHARMA.NS", name: "Aurobindo Pharma", sector: "Pharma" },
  { symbol: "TORNTPHARM.NS", name: "Torrent Pharmaceuticals", sector: "Pharma" },
];

/**
 * Fuzzy-ish filter: matches any token in the query against the start of
 * words in the symbol or name. Tolerant of casing and partial words.
 */
export function searchTickers(query: string, limit = 8): TickerEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);

  const scored = TICKERS.map((t) => {
    const hay = `${t.symbol} ${t.name} ${t.sector ?? ""}`.toLowerCase();
    const symLower = t.symbol.toLowerCase();
    const nameLower = t.name.toLowerCase();

    let score = 0;
    // Exact symbol match wins.
    if (symLower === q || symLower.replace(".ns", "") === q) score += 1000;
    // Symbol prefix.
    else if (symLower.startsWith(q)) score += 500;
    // Name prefix.
    else if (nameLower.startsWith(q)) score += 400;

    // All tokens must appear somewhere.
    if (tokens.every((tok) => hay.includes(tok))) score += 100;
    else return { t, score: 0 };

    // Bonus per token matching a word-start.
    for (const tok of tokens) {
      if (new RegExp(`\\b${escapeRegex(tok)}`).test(hay)) score += 10;
    }
    return { t, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.t);

  return scored;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
