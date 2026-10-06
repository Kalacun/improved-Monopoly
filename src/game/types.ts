export type Rules = {
  preset: "classic" | "economy";
  inflation: number;
  cycles: boolean;
  wealthTax: boolean;
  planning: boolean;
  planningStart: number;
  planningEvery: number;
  planningCap: number;
  taxRate: number;
  recoveryGrant: number;
  contracts: boolean;
  royalties: boolean;
  equity: boolean;
  sellOn: boolean;
  vetoes: boolean;
  options: boolean;
  loans: boolean;
  assistance: boolean;
};
export const ECONOMY: Rules = {
  preset: "economy",
  inflation: 0.1,
  cycles: true,
  wealthTax: true,
  planning: true,
  planningStart: 2,
  planningEvery: 2,
  planningCap: 3,
  taxRate: 0.04,
  recoveryGrant: 75,
  contracts: true,
  royalties: true,
  equity: true,
  sellOn: true,
  vetoes: true,
  options: true,
  loans: true,
  assistance: true,
};
export const CLASSIC: Rules = {
  preset: "classic",
  inflation: 0,
  cycles: false,
  wealthTax: false,
  planning: false,
  planningStart: 2,
  planningEvery: 2,
  planningCap: 3,
  taxRate: 0.04,
  recoveryGrant: 75,
  contracts: false,
  royalties: false,
  equity: false,
  sellOn: false,
  vetoes: false,
  options: false,
  loans: false,
  assistance: false,
};
export type Player = {
  id: string;
  name: string;
  color: string;
  token: string;
  cash: number;
  position: number;
  laps: number;
  jailed: boolean;
  jailTurns: number;
  bankrupt: boolean;
  planning: number;
  freeCards: ("chance" | "chest")[];
  bot: boolean;
  lastOfferTurn?: number;
};
export type Claim = {
  holder: string;
  percent: number;
  kind: "royalty" | "equity";
};
export type Deed = {
  owner: string | null;
  houses: number;
  mortgage: number;
  claims: Claim[];
  sellOn: { holder: string; amount: number }[];
  vetoes: { holder: string; blocked: string[] }[];
  option?: { holder: string; strike: number };
};
export type Deal = {
  id: string;
  from: string;
  to: string;
  give: number[];
  take: number[];
  cash: number;
  receiveCash: number;
  giveJailCards?: number;
  takeJailCards?: number;
  royalty: number;
  equity: number;
  sellOn: number;
  veto: string[];
  option?: { property: number; strike: number };
  loan?: { principal: number; interest: number; laps: number };
  note: string;
  retainTitle: boolean;
};
export type Loan = {
  id: string;
  lender: string;
  borrower: string;
  principal: number;
  due: number;
  dueLap: number;
};
export type Payment = {
  player: string;
  amount: number;
  recipients: { id: string | null; amount: number }[];
  reason: string;
  creditor: string | null;
};
export type Phase =
  "roll" | "move" | "purchase" | "auction" | "end" | "debt" | "over";
export type Auction = {
  property: number;
  high: number;
  leader: string | null;
  remaining: string[];
  actor: string;
  queue: number[];
  kind?: "property" | "house" | "hotel";
  targets?: Record<string, number[]>;
  winningTarget?: number;
  resume?: Phase;
};
export type Game = {
  version: 1;
  id: string;
  rules: Rules;
  players: Player[];
  deeds: Record<number, Deed>;
  turn: number;
  turnNumber: number;
  phase: Phase;
  dice: [number, number];
  doubles: number;
  rolledInJail: boolean;
  afterMove: Phase;
  pendingMove: number | null;
  payments: Payment[];
  resumePhase: Phase;
  auction: Auction | null;
  offers: Deal[];
  loans: Loan[];
  index: number;
  cycle: number;
  epoch: number;
  chance: number[];
  chest: number[];
  rng: number;
  logs: { id: number; text: string; kind: string }[];
  lastCard: { text: string; deck: string } | null;
  cardDraws?: CardDraw[];
  winner: string | null;
  revision: number;
};
export type CardDraw = {
  turnNumber?: number;
  id: number;
  deck: "chance" | "chest";
  text: string;
  player: string;
  index: number;
};
export type Action = { type: string; [key: string]: unknown };
export type Seat = {
  id: string;
  name: string;
  color: string;
  token: string;
  bot: boolean;
  connected: boolean;
  model?: string;
};
export type RoomView = {
  invite?: string;
  rules?: Rules;
  code: string;
  host: string;
  mode: "local" | "lan" | "party";
  seats: Seat[];
  game: Game | null;
};
