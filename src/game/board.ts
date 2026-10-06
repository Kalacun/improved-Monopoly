export type TileKind =
  | "go"
  | "property"
  | "railroad"
  | "utility"
  | "chance"
  | "chest"
  | "tax"
  | "jail"
  | "parking"
  | "goToJail";
export type Tile = {
  id: number;
  name: string;
  short?: string;
  kind: TileKind;
  group?: string;
  color?: string;
  price?: number;
  rent?: number[];
  build?: number;
  tax?: number;
};
const p = (
  id: number,
  name: string,
  group: string,
  color: string,
  price: number,
  rent: number[],
  build: number,
): Tile => ({ id, name, kind: "property", group, color, price, rent, build });
const r = (id: number, name: string): Tile => ({
  id,
  name,
  kind: "railroad",
  price: 200,
});
const t = (id: number, name: string, kind: TileKind, tax?: number): Tile => ({
  id,
  name,
  kind,
  tax,
});
export const BOARD: Tile[] = [
  t(0, "GO", "go"),
  p(
    1,
    "Mediterranean Avenue",
    "brown",
    "#865947",
    60,
    [2, 10, 30, 90, 160, 250],
    50,
  ),
  t(2, "Community Chest", "chest"),
  p(3, "Baltic Avenue", "brown", "#865947", 60, [4, 20, 60, 180, 320, 450], 50),
  t(4, "Income Tax", "tax", 200),
  r(5, "Reading Railroad"),
  p(
    6,
    "Oriental Avenue",
    "sky",
    "#93c9d6",
    100,
    [6, 30, 90, 270, 400, 550],
    50,
  ),
  t(7, "Chance", "chance"),
  p(8, "Vermont Avenue", "sky", "#93c9d6", 100, [6, 30, 90, 270, 400, 550], 50),
  p(
    9,
    "Connecticut Avenue",
    "sky",
    "#93c9d6",
    120,
    [8, 40, 100, 300, 450, 600],
    50,
  ),
  t(10, "Jail / Just Visiting", "jail"),
  p(
    11,
    "St. Charles Place",
    "pink",
    "#c97eab",
    140,
    [10, 50, 150, 450, 625, 750],
    100,
  ),
  { id: 12, name: "Electric Company", kind: "utility", price: 150 },
  p(
    13,
    "States Avenue",
    "pink",
    "#c97eab",
    140,
    [10, 50, 150, 450, 625, 750],
    100,
  ),
  p(
    14,
    "Virginia Avenue",
    "pink",
    "#c97eab",
    160,
    [12, 60, 180, 500, 700, 900],
    100,
  ),
  r(15, "Pennsylvania Railroad"),
  p(
    16,
    "St. James Place",
    "orange",
    "#e6a153",
    180,
    [14, 70, 200, 550, 750, 950],
    100,
  ),
  t(17, "Community Chest", "chest"),
  p(
    18,
    "Tennessee Avenue",
    "orange",
    "#e6a153",
    180,
    [14, 70, 200, 550, 750, 950],
    100,
  ),
  p(
    19,
    "New York Avenue",
    "orange",
    "#e6a153",
    200,
    [16, 80, 220, 600, 800, 1000],
    100,
  ),
  t(20, "Free Parking", "parking"),
  p(
    21,
    "Kentucky Avenue",
    "red",
    "#d87069",
    220,
    [18, 90, 250, 700, 875, 1050],
    150,
  ),
  t(22, "Chance", "chance"),
  p(
    23,
    "Indiana Avenue",
    "red",
    "#d87069",
    220,
    [18, 90, 250, 700, 875, 1050],
    150,
  ),
  p(
    24,
    "Illinois Avenue",
    "red",
    "#d87069",
    240,
    [20, 100, 300, 750, 925, 1100],
    150,
  ),
  r(25, "B. & O. Railroad"),
  p(
    26,
    "Atlantic Avenue",
    "yellow",
    "#dec168",
    260,
    [22, 110, 330, 800, 975, 1150],
    150,
  ),
  p(
    27,
    "Ventnor Avenue",
    "yellow",
    "#dec168",
    260,
    [22, 110, 330, 800, 975, 1150],
    150,
  ),
  { id: 28, name: "Water Works", kind: "utility", price: 150 },
  p(
    29,
    "Marvin Gardens",
    "yellow",
    "#dec168",
    280,
    [24, 120, 360, 850, 1025, 1200],
    150,
  ),
  t(30, "Go to Jail", "goToJail"),
  p(
    31,
    "Pacific Avenue",
    "green",
    "#6b9d85",
    300,
    [26, 130, 390, 900, 1100, 1275],
    200,
  ),
  p(
    32,
    "North Carolina Avenue",
    "green",
    "#6b9d85",
    300,
    [26, 130, 390, 900, 1100, 1275],
    200,
  ),
  t(33, "Community Chest", "chest"),
  p(
    34,
    "Pennsylvania Avenue",
    "green",
    "#6b9d85",
    320,
    [28, 150, 450, 1000, 1200, 1400],
    200,
  ),
  r(35, "Short Line"),
  t(36, "Chance", "chance"),
  p(
    37,
    "Park Place",
    "blue",
    "#597aa2",
    350,
    [35, 175, 500, 1100, 1300, 1500],
    200,
  ),
  t(38, "Luxury Tax", "tax", 100),
  p(
    39,
    "Boardwalk",
    "blue",
    "#597aa2",
    400,
    [50, 200, 600, 1400, 1700, 2000],
    200,
  ),
];
export const PURCHASABLE = BOARD.filter((t) => t.price);
export const GROUPS = [
  ...new Set(BOARD.flatMap((t) => (t.group ? [t.group] : []))),
];
export const COLORS = [
  "#d9a34e",
  "#72b4ca",
  "#c784a7",
  "#8cba88",
  "#c17c64",
  "#a397c7",
];
export const TOKENS = [
  "Drone",
  "Lighthouse",
  "Fox",
  "Comet",
  "Crystal",
  "Robot",
];
export type Card = {
  text: string;
  type:
    | "move"
    | "nearestRail"
    | "nearestUtility"
    | "back"
    | "cash"
    | "each"
    | "jail"
    | "free"
    | "repairs";
  value?: number;
  hotel?: number;
};
// Classic US Chance and Community Chest effects, described in original wording.
// Stable indices preserve saved deck order in existing tables.
// Keep this order stable: saved decks store these indices.
export const CHANCE: Card[] = [
  {
    text: "Go directly to GO and collect $200.",
    type: "move",
    value: 0,
  },
  {
    text: "Advance to Illinois Avenue. Collect $200 if you pass GO.",
    type: "move",
    value: 24,
  },
  {
    text: "Advance to St. Charles Place. Collect $200 if you pass GO.",
    type: "move",
    value: 11,
  },
  {
    text: "Advance to the next railroad. Buy it if unowned; otherwise pay twice its usual rent.",
    type: "nearestRail",
  },
  {
    text: "Advance to the next railroad. Buy it if unowned; otherwise pay twice its usual rent.",
    type: "nearestRail",
  },
  {
    text: "Advance to the next utility. Buy it if unowned; otherwise roll the dice and pay ten times the total.",
    type: "nearestUtility",
  },
  {
    text: "The bank pays you a $50 dividend.",
    type: "cash",
    value: 50,
  },
  {
    text: "Keep this card. Use it to leave Jail, or trade it to another player.",
    type: "free",
  },
  {
    text: "Go back three spaces.",
    type: "back",
    value: 3,
  },
  {
    text: "Go directly to Jail. Do not pass GO or collect $200.",
    type: "jail",
  },
  {
    text: "Pay for repairs: $25 for each house and $100 for each hotel.",
    type: "repairs",
    value: 25,
    hotel: 100,
  },
  { text: "Pay a speeding fine of $15.", type: "cash", value: -15 },
  {
    text: "Advance to Reading Railroad. Collect $200 if you pass GO.",
    type: "move",
    value: 5,
  },
  {
    text: "Advance to Boardwalk.",
    type: "move",
    value: 39,
  },
  {
    text: "You are elected chairman of the board. Pay each other player $50.",
    type: "each",
    value: -50,
  },
  {
    text: "Your building loan matures. Collect $150.",
    type: "cash",
    value: 150,
  },
];
export const CHEST: Card[] = [
  {
    text: "Advance to GO and collect $200.",
    type: "move",
    value: 0,
  },
  {
    text: "A bank error is in your favor. Collect $200.",
    type: "cash",
    value: 200,
  },
  {
    text: "Pay a doctor's fee of $50.",
    type: "cash",
    value: -50,
  },
  {
    text: "You receive $50 from the sale of stock.",
    type: "cash",
    value: 50,
  },
  {
    text: "Keep this card. Use it to leave Jail, or trade it to another player.",
    type: "free",
  },
  {
    text: "Go directly to Jail. Do not pass GO or collect $200.",
    type: "jail",
  },
  {
    text: "Your holiday fund matures. Collect $100.",
    type: "cash",
    value: 100,
  },
  {
    text: "You receive a $20 income tax refund.",
    type: "cash",
    value: 20,
  },
  {
    text: "It is your birthday. Collect $10 from every other player.",
    type: "each",
    value: 10,
  },
  {
    text: "Your life insurance matures. Collect $100.",
    type: "cash",
    value: 100,
  },
  {
    text: "Pay hospital fees of $100.",
    type: "cash",
    value: -100,
  },
  {
    text: "Pay school fees of $50.",
    type: "cash",
    value: -50,
  },
  {
    text: "Receive a consultancy fee of $25.",
    type: "cash",
    value: 25,
  },
  {
    text: "Pay street repairs: $40 for each house and $115 for each hotel.",
    type: "repairs",
    value: 40,
    hotel: 115,
  },
  {
    text: "You win second prize in a beauty contest. Collect $10.",
    type: "cash",
    value: 10,
  },
  {
    text: "You inherit $100.",
    type: "cash",
    value: 100,
  },
];
