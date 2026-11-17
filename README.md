# Wealth Simulator · India FY 2026–27

Fixed-income and provident-fund simulator for Indian investors. Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (Radix), Recharts and next-themes.

| Route | Calculator |
|---|---|
| `/` | Portfolio overview: every asset fed the same SIP and ranked by post-tax XIRR |
| `/ppf` | PPF: yearly lump sum or monthly deposits, 5th-of-month interest, four deposit-timing modes, Form H extensions |
| `/epf` | EPF: month-by-month from your UAN start to age 58, ₹15k → ₹25k wage ceiling (17 Sep 2026), EPS cap, ₹2.5L taxable-interest bucket, EPS pension estimate |
| `/auto-sweep` | ICICI Money Multiplier: ₹5k sweep units, LIFO reverse sweep, 1% break penalty, TDS (₹50k threshold), target corpus (invest until a lump sum, then stop or continue), withdrawal-habit comparison, and a "Ways to cut tax" tab |
| `/idfc-vs-sweep` | IDFC progressive slabs vs sweep, with the exact post-tax crossover balance |

The top bar holds the tax slab (0/10/20/30%), the regime (New/Old, which drives 80TTA), Nominal vs Real ₹, and the CPI assumption. These settings apply on every route. Every input is mirrored into the URL, so any scenario can be bookmarked or shared. Every chart and ledger has an Expand button for a full-screen popup, and clicking a ledger row opens its month-by-month breakdown.

All calculators show actual rupees in every table and chart; Real view adds a today's-money figure (card hint and an extra ledger column) instead of replacing them. Slider values can be typed (`3,00,000`, `5L`, `1cr`, `7.1%`), results sit in tabs (Overview, Year-wise ledger, and on Auto-Sweep Withdrawal habits and Ways to cut tax), "Hide inputs" gives ledgers the full width, and "Copy link" shares the exact scenario.

## Setup from scratch

```bash
npx create-next-app@latest investment-calculator --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-react-compiler --yes
cd investment-calculator
npx shadcn@latest init -t next -b radix --no-monorepo --no-rtl -y sidebar card tabs slider switch select table badge tooltip chart button label dropdown-menu separator input
npm i next-themes
```

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build (all routes prerender statically)
npm run lint
```

## Modelling assumptions

- **Tax** is applied at the flat marginal slab you select. Cess and surcharge are not included, which matches the pre-tax-equivalent formula `rate / (1 − slab)`.
- **PPF** interest is rounded to the nearest rupee and credited on 31 March. In Form H mode, cumulative withdrawals per 5-year block are capped at 60% of the block-opening balance.
- **EPF** contributions are credited at month-end, so interest for month *m* runs on the balance at the close of month *m − 1*. Tax on the taxable bucket is paid out of pocket. The wage ceiling is ₹15,000 until 16 Sep 2026 and ₹25,000 from 17 Sep 2026 (September 2026 is blended 16/30 and 14/30). FY2025-26 uses the declared 8.25%; later years use your projected rate. Interest stops at age 58, when the account becomes inoperative. The EPS pension is an EPS-95 formula estimate (wage × service ÷ 70).
- **Sweep** moves money into an FD as soon as it is credited. A premature break pays the FD rate minus 1% on the broken portion for the period held. TDS changes only when tax leaves the account, not the total tax.
- **IDFC** interest uses actual days ÷ 365 on a constant within-month balance and is compounded monthly.

Projections are illustrative. Rates and tax rules change, so verify before investing.
