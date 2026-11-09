const toSet = (symbols: string) => new Set(symbols.split(/\s+/).filter(Boolean));

export const MARKET_SECTORS = [
  {
    id: "tech",
    label: "Tech",
    symbols: toSet(`
      AAPL MSFT NVDA AVGO ORCL CRM ADBE AMD INTC CSCO QCOM TXN IBM NOW INTU
      AMAT MU LRCX KLAC ADI PANW SNPS CDNS ANET ACN FTNT HPQ DELL NXPI MCHP
      ON ROP MSI APH TEL GLW WDC STX NTAP JNPR KEYS FSLR ENPH SMCI PLTR
    `),
  },
  {
    id: "comm",
    label: "Comm",
    symbols: toSet(`
      GOOGL GOOG META NFLX DIS CMCSA T VZ TMUS CHTR EA TTWO WBD PARA FOX
      FOXA OMC IPG LYV MTCH
    `),
  },
  {
    id: "finance",
    label: "Finance",
    symbols: toSet(`
      JPM BAC WFC C GS MS BLK SCHW AXP V MA PYPL COF USB PNC TFC BK AFL MET
      PRU AIG TRV CB ALL PGR MMC AON SPGI MCO ICE CME BRK.B BRK-B FITB HBAN
      KEY RF CFG NTRS STT DFS SYF AJG MSCI NDAQ CBOE
    `),
  },
  {
    id: "health",
    label: "Health",
    symbols: toSet(`
      UNH JNJ LLY PFE MRK ABBV ABT TMO DHR BMY AMGN GILD CVS CI ELV HUM MDT
      ISRG SYK BSX VRTX REGN ZTS BDX A MRNA HCA IQV IDXX EW DXCM BIIB MCK
      CAH COR HOLX ZBH RMD WAT MTD
    `),
  },
  {
    id: "energy",
    label: "Energy",
    symbols: toSet(`
      XOM CVX COP EOG SLB OXY PSX MPC VLO WMB KMI OKE HAL BKR DVN FANG HES
      CTRA APA TRGP EQT
    `),
  },
  {
    id: "consumer",
    label: "Consumer",
    symbols: toSet(`
      AMZN TSLA HD MCD NKE SBUX LOW TGT COST WMT PG KO PEP PM MO MDLZ CL KMB
      BKNG MAR HLT ABNB GM F LULU TJX ROST ORLY AZO YUM CMG DG DLTR KHC GIS
      HSY STZ KDP EL KR SYY
    `),
  },
  {
    id: "industrials",
    label: "Industrials",
    symbols: toSet(`
      CAT DE BA HON GE RTX LMT NOC UPS FDX UNP CSX NSC MMM ETN EMR ITW WM GD
      PH CMI PCAR ROK FAST CTAS RSG LHX TDG URI DAL UAL LUV
    `),
  },
] as const;

export type MarketSectorLabel =
  | (typeof MARKET_SECTORS)[number]["label"]
  | "Other";

export function getMarketSector(symbol: string): MarketSectorLabel {
  return (
    MARKET_SECTORS.find((sector) => sector.symbols.has(symbol))?.label ?? "Other"
  );
}
