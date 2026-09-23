/** Prices and original photographs transcribed from the supplied menu screenshots.
 * Screenshots stay intact; the UI crops them with CSS, preserving the actual photos.
 * Frikandel and Kipkorn include one free portion per paid portion.
 */
export const CATEGORIES = ["Frieten", "Burgers", "Snacks", "Sauzen"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Photo = {
  source: string;
  size: [number, number];
  crop: [number, number, number, number];
};
export type Product = {
  id: string;
  name: string;
  category: Category;
  cents: number;
  photo: Photo | null;
  description?: string;
  promotion?: "1+1";
};
const photo = (
  source: string,
  size: [number, number],
  crop: [number, number, number, number],
): Photo => ({ source: `/menu/${source}.png`, size, crop });
const fries = (x: number, y: number, w = 220, h = 220) =>
  photo("frieten", [1556, 1328], [x, y, w, h]);
const burgers = (x: number, y: number, w = 176, h = 176) =>
  photo("burgers", [1312, 1884], [x, y, w, h]);
const snack1 = (x: number, y: number, w = 193, h = 193) =>
  photo("snacks-1", [1344, 1823], [x, y, w, h]);
const snack2 = (x: number, y: number, w = 211, h = 211) =>
  photo("snacks-2", [1455, 1696], [x, y, w, h]);
const snack3 = (x: number, y: number, w = 195, h = 195) =>
  photo("snacks-3", [1365, 1823], [x, y, w, h]);
function products(
  category: Category,
  rows: [string, string, number, Photo | null, string?][],
): Product[] {
  return rows.map(([id, name, cents, photo, description]) => ({
    id,
    name,
    cents,
    photo,
    category,
    ...(["frikandel", "kipkorn"].includes(id)
      ? { promotion: "1+1" as const }
      : {}),
    ...(description ? { description } : {}),
  }));
}
export const MENU: Product[] = [
  ...products("Frieten", [
    ["kleine-puntzak", "Kleine puntzak", 400, fries(464, 76)],
    ["grote-puntzak", "Grote puntzak", 490, fries(464, 76)],
    ["familie-puntzak", "Familie puntzak", 600, fries(464, 76)],
    ["friet-julientje", "Friet Julientje", 1000, fries(1211, 407)],
    ["friet-rombautje", "Friet Rombautje", 1020, fries(465, 742)],
    ["bicky-frietje", "Bicky Frietje", 1000, fries(1211, 742, 220, 163)],
    ["friet-stoverij", "Friet Stoverij", 1000, fries(465, 1077, 220, 161)],
  ]),
  ...products("Burgers", [
    ["bicky-burger", "Bicky burger", 480, burgers(389, 28)],
    ["bicky-spicy", "Bicky spicy burger", 500, burgers(1018, 28)],
    ["bicky-cheese", "Bicky cheese burger", 500, burgers(389, 304)],
    ["bicky-spicy-cheese", "Bicky spicy cheese", 520, burgers(1018, 304)],
    ["bicky-chicken", "Bicky chicken burger", 500, burgers(388, 583, 180, 137)],
    [
      "bicky-spicy-chicken",
      "Bicky spicy chicken",
      520,
      burgers(1019, 583, 180, 137),
    ],
    ["bicky-rib", "Bicky rib burger", 550, burgers(387, 870)],
    ["fishburger", "Fishburger", 520, burgers(1018, 870)],
    ["vegiburger", "Vegiburger", 480, burgers(388, 1155)],
    ["dubbele-bicky", "Dubbele bicky burger", 680, burgers(1018, 1155)],
    [
      "dubbele-chicken",
      "Dubbele bicky chicken",
      760,
      burgers(388, 1436, 180, 133),
    ],
    ["dubbele-vegi", "Dubbele vegiburger", 680, burgers(1018, 1440)],
    ["bicky-orange", "Bicky orange", 700, burgers(388, 1720, 180, 154)],
  ]),
  ...products("Snacks", [
    ["cheese-crack", "Cheese Crack", 320, snack1(400, 32, 193, 132)],
    ["gehaktbal", "Gehaktbal", 360, snack1(1080, 32, 193, 132)],
    ["frikandel", "Frikandel", 310, snack1(400, 291)],
    ["frikandel-special", "Frikandel special", 380, snack1(1080, 291)],
    ["frikandel-xxl", "Frikandel XXL", 550, snack1(400, 625)],
    [
      "frikandel-xxl-special",
      "Frikandel XXL special",
      660,
      snack1(1080, 625, 193, 144),
    ],
    ["viandel-special", "Viandel special", 420, snack1(400, 931)],
    ["viandel", "Viandel", 370, snack1(1080, 931)],
    ["kipkorn", "Kipkorn", 400, snack1(400, 1237)],
    [
      "gehaktbal-special",
      "Gehaktbal special",
      410,
      snack1(1080, 1237, 193, 145),
    ],
    ["lookworst", "Lookworst", 420, snack1(400, 1571)],
    [
      "lookworst-special",
      "Lookworst special",
      470,
      snack1(1080, 1571, 193, 143),
    ],
    ["chixfingers", "Chixfingers (6 stuks)", 410, snack2(445, 76)],
    ["kippets", "Kippets (5 stuks)", 410, snack2(1175, 76)],
    ["sito-gold", "Sito Gold", 420, snack2(445, 405)],
    ["loempia-kip", "Loempia Kip", 440, snack2(1175, 405, 211, 158)],
    [
      "mini-loempias",
      "Mini loempia’s met saus (6 stuks)",
      450,
      snack2(445, 734),
    ],
    ["bamischijf", "Bamischijf", 420, snack2(1175, 734)],
    ["drumsticks", "Drumsticks", 470, snack2(445, 1109)],
    ["kaaskroket", "Kaaskroket", 330, snack2(1175, 1109)],
    ["garnaalkroket", "Garnaalkroket", 400, snack2(445, 1437)],
    ["vleeskroket", "Vleeskroket", 400, snack2(1175, 1437)],
    ["bitterballen", "Bitterballen (5 stuks)", 380, snack3(423, 60)],
    ["sate-rund", "Saté rund", 450, snack3(1107, 60)],
    ["sate-kip", "Saté kip", 450, snack3(423, 368)],
    ["ardeense-sate", "Ardeense saté", 430, snack3(1107, 368)],
    ["mozzarellasticks", "Mozzarellasticks (5 stuks)", 410, snack3(423, 677)],
    ["goulashkroket", "Goulashkroket", 420, snack3(1107, 677)],
    ["zigeunerstick", "Zigeunerstick", 380, snack3(423, 986)],
    ["zeestick", "Zeestick", 410, snack3(1107, 986)],
    ["mini-lucifer", "Mini Lucifer (4 stuks)", 430, snack3(423, 1293)],
    ["taco", "Taco", 400, snack3(1107, 1293)],
    [
      "vegi-bitterballen",
      "Vegetarische bitterballen (5 stuks)",
      430,
      snack3(423, 1602),
    ],
    ["kip-kaaspunt", "Kip Kaaspunt", 440, snack3(1107, 1602)],
  ]),
  ...products("Sauzen", [
    [
      "mayonaise",
      "Mayonaise",
      120,
      photo("sauzen-1", [1432, 1760], [440, 85, 190, 180]),
      "Potje",
    ],
    [
      "ketchup",
      "Ketchup",
      120,
      photo("sauzen-1", [1432, 1760], [1100, 85, 190, 180]),
      "Potje",
    ],
    [
      "curry-ketchup",
      "Curry ketchup",
      120,
      photo("sauzen-1", [1432, 1760], [440, 383, 190, 180]),
      "Potje",
    ],
    [
      "americain",
      "Americain",
      120,
      photo("sauzen-1", [1432, 1760], [1100, 383, 190, 180]),
      "Potje",
    ],
    [
      "bearnaise",
      "Bearnaise",
      120,
      photo("sauzen-1", [1432, 1760], [440, 681, 190, 180]),
      "Potje",
    ],
    [
      "frietsaus",
      "Frietsaus",
      120,
      photo("sauzen-1", [1432, 1760], [1100, 681, 190, 180]),
      "Potje",
    ],
    [
      "tartaar",
      "Tartaar",
      120,
      photo("sauzen-1", [1432, 1760], [440, 979, 190, 180]),
      "Potje",
    ],
    [
      "andalouse",
      "Andalouse",
      120,
      photo("sauzen-1", [1432, 1760], [1100, 979, 190, 180]),
      "Potje",
    ],
    [
      "cocktail",
      "Cocktail",
      120,
      photo("sauzen-1", [1432, 1760], [440, 1277, 190, 180]),
      "Potje",
    ],
    [
      "samurai",
      "Samurai",
      120,
      photo("sauzen-1", [1432, 1760], [1100, 1277, 190, 180]),
      "Potje",
    ],
    [
      "look",
      "Look",
      120,
      photo("sauzen-1", [1432, 1760], [440, 1575, 190, 180]),
      "Potje",
    ],
    [
      "joppie",
      "Joppie",
      120,
      photo("sauzen-1", [1432, 1760], [1100, 1575, 190, 180]),
      "Potje",
    ],
    [
      "peper",
      "Peper",
      120,
      photo("sauzen-2", [1526, 1472], [467, 100, 210, 190]),
      "Potje",
    ],
    [
      "pili-pili",
      "Pili-pili",
      120,
      photo("sauzen-2", [1526, 1472], [1210, 100, 210, 190]),
      "Potje",
    ],
    [
      "brasil",
      "Brasil",
      120,
      photo("sauzen-2", [1526, 1472], [467, 436, 210, 190]),
      "Potje",
    ],
    [
      "mosterd",
      "Mosterd",
      120,
      photo("sauzen-2", [1526, 1472], [1210, 436, 210, 190]),
      "Potje",
    ],
    ["bicky-ui", "Bicky ui", 120, null, "Potje"],
    ["verse-ui", "verse ui", 120, null, "Potje"],
    ["gele-bicky-saus", "Gele Bicky saus", 120, null, "Potje"],
    [
      "speciaal-curryketchup",
      "Speciaal Curryketchup",
      220,
      null,
      "Mayonaise en curryketchup en verse ui",
    ],
    [
      "speciaal-tomatenketchup",
      "Speciaal Tomatenketchup",
      220,
      null,
      "Mayonaise en tomatenketchup en verse ui",
    ],
  ]),
];
export type CartItem = { productId: string; quantity: number };
export type OrderLine = CartItem & {
  name: string;
  unitCents: number;
  freeQuantity?: number;
};
export const ORDER_FEE_CENTS = 100;
export function priceCart(cart: CartItem[]) {
  if (!Array.isArray(cart) || cart.length < 1 || cart.length > MENU.length)
    throw new Error("Kies minstens één product.");
  const seen = new Set<string>();
  const lines: OrderLine[] = cart.map(({ productId, quantity }) => {
    const product = MENU.find((p) => p.id === productId);
    if (
      !product ||
      seen.has(productId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    )
      throw new Error("Ongeldig product of aantal.");
    seen.add(productId);
    return {
      productId,
      quantity,
      name: product.name,
      unitCents: product.cents,
      ...(product.promotion === "1+1" ? { freeQuantity: quantity } : {}),
    };
  });
  if (lines.reduce((sum, l) => sum + l.quantity, 0) > 50)
    throw new Error("Maximaal 50 producten per bestelling.");
  const subtotalCents = lines.reduce(
    (sum, l) => sum + l.quantity * l.unitCents,
    0,
  );
  return {
    lines,
    subtotalCents,
    feeCents: ORDER_FEE_CENTS,
    totalCents: subtotalCents + ORDER_FEE_CENTS,
  };
}
export const euro = (cents: number) =>
  new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
