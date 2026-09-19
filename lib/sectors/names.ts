/** NSE's industry names (Nifty Total Market list), offered when setting a sector by hand. */
export const NSE_SECTORS = [
  "Automobile and Auto Components",
  "Capital Goods",
  "Chemicals",
  "Construction",
  "Construction Materials",
  "Consumer Durables",
  "Consumer Services",
  "Diversified",
  "Fast Moving Consumer Goods",
  "Financial Services",
  "Forest Materials",
  "Healthcare",
  "Information Technology",
  "Media Entertainment & Publication",
  "Metals & Mining",
  "Oil Gas & Consumable Fuels",
  "Power",
  "Realty",
  "Services",
  "Telecommunication",
  "Textiles",
  "Utilities",
] as const

/** Sovereign gold bonds have no NSE industry; they're grouped on their own. */
export const GOLD_BONDS_SECTOR = "Gold bonds"
