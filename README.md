This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Market data credentials

Set these server-side environment variables in `.env.local`:

- `FINNHUB_KEY` for US stock symbols, quotes, and news.
- `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY` for Alpaca IEX candles and Alpaca paper trading.

Keep API credentials out of client-side code and source control.
The trading routes always use Alpaca's paper endpoint and reject non-local hosts. Use paper-account credentials and keep this app private; it has no user sign-in.
Market pins sync with the dedicated `PaperTrade` watchlist in Alpaca. If it does not exist, the app creates it and seeds it with the browser's saved pins; subsequent pin changes are written to Alpaca and remote changes refresh while the app is open. The app's Binance USDT crypto symbols may be rejected if Alpaca does not support that pair in watchlists.
The navbar shows US market hours from Alpaca and checks paper orders every 30 seconds for fills. Filled orders trigger an in-app notification while the app is open; this is not a push notification when the browser is closed.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
