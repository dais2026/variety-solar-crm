import { publicProcedure, router } from "../_core/trpc";

const PRICE_CALC_API =
  "https://pricecalculator-varietysolar.manus.space/api/trpc/quotes.listCustomers?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%7D";

export const pricingRouter = router({
  listCustomers: publicProcedure.query(async () => {
    const response = await fetch(PRICE_CALC_API);
    if (!response.ok) {
      throw new Error(`Price Calculator API error: ${response.status}`);
    }
    const json = await response.json();
    const customers = json[0]?.result?.data?.json || [];
    return customers as Array<{
      id: number;
      customerName: string;
      referenceNumber: string;
      createdAt: string;
      updatedAt: string;
      quotes: Array<{
        id: number;
        totalPrice: number;
        items: Array<{ label: string; price: number }>;
        commission: number;
        solarSTCs: number;
        batterySTCs: number;
        stcPrice: number;
        rebates: Array<{ amount: number; id: string; label: string }>;
        savedAt: number;
      }>;
      quoteCount: number;
      lastQuoteAt: number;
    }>;
  }),
});
