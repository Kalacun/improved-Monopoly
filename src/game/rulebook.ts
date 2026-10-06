import type { Rules } from "./types";

export const SPECIAL_RULES = [
  {
    key: "planning",
    title: "Planning credits",
    description:
      "Start with 2. Spend 1 after a normal roll to move one space less or more. Earn 1 every 2 personal laps; hold at most 3.",
    why: "A scarce choice helps you recover from an unlucky near miss while keeping dice meaningful.",
  },
  {
    key: "cycles",
    title: "Predictable economic cycles",
    description:
      "A public five-year cycle changes building costs, rents, and mortgage terms. Each year requires a lap from every surviving player.",
    why: "Visible booms and recessions reward saving and investment timing instead of adding surprise penalties.",
  },
  {
    key: "wealthTax",
    title: "Progressive real-estate tax",
    description:
      "At GO, pay 4% of property value above the table median plus an indexed $500 allowance.",
    why: "Slows runaway property empires while leaving smaller portfolios untaxed.",
  },
  {
    key: "assistance",
    title: "Recovery grants",
    description:
      "At GO, receive an indexed $75 if your net worth is below 75% of the surviving players’ median.",
    why: "Gives trailing players money to bid or negotiate without wiping out the leader’s advantage.",
  },
  {
    key: "royalties",
    title: "Rent royalties",
    description:
      "A seller keeps an agreed percentage of future rent. Royalties do not share resale proceeds.",
    why: "Lets a cash-poor player sell a title while keeping a future income stream.",
  },
  {
    key: "equity",
    title: "Equity and portfolio stakes",
    description:
      "Split rent and future title-sale proceeds. Sell stakes in several properties while retaining their titles. Combined rent claims are capped at 80%.",
    why: "Raises development money and lets investors diversify beyond the spaces they happen to land on.",
  },
  {
    key: "sellOn",
    title: "Sell-on payments",
    description:
      "A fixed payment to the original seller on every later voluntary resale, including gifts and swaps.",
    why: "Bridges disagreements about future value, but the fixed fee can make later trades harder.",
  },
  {
    key: "vetoes",
    title: "Resale vetoes",
    description:
      "Name players who cannot buy the title while the clause holder remains in the game.",
    why: "Makes it easier to sell without immediately handing a rival a monopoly. Disable it if your group dislikes trade restrictions.",
  },
  {
    key: "options",
    title: "Fixed-price purchase options",
    description:
      "Pay for the right to buy later at a fixed price. No expiry; the reserved title cannot be resold, mortgaged, or developed until released or exercised.",
    why: "Lets players plan future sets and negotiate inflation exposure. The reservation and an upfront premium balance this powerful right.",
  },
  {
    key: "loans",
    title: "Investor loans",
    description:
      "Lend at 0–25% fixed interest, repay after 1–5 borrower laps. No compounding; early repayment is allowed at the same total.",
    why: "Adds player-funded rescue and development financing, with a visible debt and repayment date.",
  },
] as const satisfies ReadonlyArray<{
  key: keyof Rules;
  title: string;
  description: string;
  why: string;
}>;

export const INFLATION_DESCRIPTION =
  "Prices, rents, GO salary, and ordinary costs rise after every surviving player completes another lap. Existing cash and fixed-price contracts stay nominal.";
export const INFLATION_WHY =
  "Makes holding cash versus assets a choice. The default 10% is deliberately strong; try 2–5% for a gentler economy.";
