# Wealth Simulator · India FY 2026–27

Fixed-income and provident-fund simulator for Indian investors. Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (Radix), Recharts and next-themes.

| Route | Calculator |
|---|---|
| `/` | Portfolio overview: every asset fed the same SIP and ranked by post-tax XIRR |
| `/ppf` | PPF: 5th-of-month interest, four deposit-timing modes, Form H extensions |
| `/epf` | EPF + VPF: ₹25k wage ceiling, ₹2,083 EPS cap, ₹2.5L taxable-interest bucket |
| `/auto-sweep` | ICICI Money Multiplier: ₹5k sweep units, LIFO reverse sweep, 1% break penalty, TDS |
| `/idfc-vs-sweep` | IDFC progressive slabs vs sweep, with the exact post-tax crossover balance |
| `/bonds` | Corporate bonds: monthly/quarterly coupons, post-tax liquid-FD reinvestment, bank FD benchmark (`/bonds-comparator` redirects here) |

The top bar holds the tax slab (0/10/20/30%), the regime (New/Old, which drives 80TTA), Nominal vs Real ₹, and the CPI assumption. These settings apply on every route. Every input is mirrored into the URL, so any scenario can be bookmarked or shared.

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
- **EPF** contributions are credited at month-end, so interest for month *m* runs on the balance at the close of month *m − 1*. Tax on the taxable bucket is paid out of pocket.
- **Sweep** moves money into an FD as soon as it is credited. A premature break pays the FD rate minus 1% on the broken portion for the period held. TDS changes only when tax leaves the account, not the total tax.
- **IDFC** interest uses actual days ÷ 365 on a constant within-month balance and is compounded monthly.
- **Bonds** are modelled as bullet bonds bought at par (coupon = YTM). Credit risk is not modelled.

Projections are illustrative. Rates and tax rules change, so verify before investing.
