import { NutritionFood } from "./types";

/**
 * Built-in food database (values are per the stated serving, not per 100 g).
 *
 * This curated list is the instant, offline-first layer — it leads with Indian
 * home-cooked staples (which packaged-food APIs cover poorly) plus everyday
 * whole foods. For anything not here — branded and packaged products, regional
 * dishes — the Log-food search also queries Open Food Facts server-side
 * (see /api/nutrition/search) and merges those results in. Meals embed the full
 * food object, so a food from either source is self-contained once logged.
 */
export const FOOD_DB: NutritionFood[] = [
  // ---- Indian breads ----
  { id: "in-roti", name: "Roti / Chapati", serving: "1 (40 g)", kcal: 120, protein: 3, carbs: 18, fat: 3, fiber: 3, sugar: 0, sodium: 90 },
  { id: "in-phulka", name: "Phulka (no oil)", serving: "1", kcal: 80, protein: 3, carbs: 16, fat: 0, fiber: 2, sugar: 0, sodium: 60 },
  { id: "in-paratha", name: "Plain paratha", serving: "1", kcal: 210, protein: 4, carbs: 28, fat: 9, fiber: 3, sugar: 0, sodium: 220 },
  { id: "in-aloo-paratha", name: "Aloo paratha", serving: "1", kcal: 260, protein: 5, carbs: 36, fat: 10, fiber: 4, sugar: 1, sodium: 330 },
  { id: "in-naan", name: "Naan", serving: "1", kcal: 260, protein: 9, carbs: 45, fat: 5, fiber: 2, sugar: 3, sodium: 420 },
  { id: "in-butter-naan", name: "Butter naan", serving: "1", kcal: 320, protein: 9, carbs: 46, fat: 12, fiber: 2, sugar: 3, sodium: 460 },
  { id: "in-bhatura", name: "Bhatura", serving: "1", kcal: 280, protein: 6, carbs: 40, fat: 11, fiber: 2, sugar: 1, sodium: 350 },
  { id: "in-puri", name: "Puri", serving: "2", kcal: 210, protein: 4, carbs: 26, fat: 10, fiber: 2, sugar: 0, sodium: 180 },
  { id: "in-bajra-roti", name: "Bajra roti", serving: "1", kcal: 130, protein: 4, carbs: 24, fat: 2, fiber: 4, sugar: 0, sodium: 80 },

  // ---- Rice & grains ----
  { id: "f-rice", name: "White rice (cooked)", serving: "1 cup", kcal: 205, protein: 4, carbs: 45, fat: 0, fiber: 1, sugar: 0, sodium: 2 },
  { id: "in-brown-rice", name: "Brown rice (cooked)", serving: "1 cup", kcal: 216, protein: 5, carbs: 45, fat: 2, fiber: 4, sugar: 0, sodium: 10 },
  { id: "in-jeera-rice", name: "Jeera rice", serving: "1 cup", kcal: 240, protein: 4, carbs: 45, fat: 5, fiber: 1, sugar: 0, sodium: 300 },
  { id: "in-curd-rice", name: "Curd rice", serving: "1 bowl", kcal: 250, protein: 7, carbs: 40, fat: 7, fiber: 1, sugar: 4, sodium: 320 },
  { id: "in-lemon-rice", name: "Lemon rice", serving: "1 bowl", kcal: 280, protein: 6, carbs: 45, fat: 9, fiber: 2, sugar: 1, sodium: 350 },
  { id: "in-khichdi", name: "Khichdi", serving: "1 bowl", kcal: 250, protein: 9, carbs: 42, fat: 5, fiber: 4, sugar: 1, sodium: 400 },
  { id: "in-veg-biryani", name: "Veg biryani", serving: "1 plate", kcal: 400, protein: 10, carbs: 60, fat: 14, fiber: 5, sugar: 3, sodium: 700 },
  { id: "in-chicken-biryani", name: "Chicken biryani", serving: "1 plate", kcal: 500, protein: 24, carbs: 60, fat: 18, fiber: 4, sugar: 3, sodium: 850 },
  { id: "in-quinoa", name: "Quinoa (cooked)", serving: "1 cup", kcal: 222, protein: 8, carbs: 39, fat: 4, fiber: 5, sugar: 2, sodium: 13 },

  // ---- Dals & legumes ----
  { id: "in-dal", name: "Dal (toor / moong)", serving: "1 bowl", kcal: 150, protein: 9, carbs: 20, fat: 4, fiber: 4, sugar: 2, sodium: 400 },
  { id: "in-dal-makhani", name: "Dal makhani", serving: "1 bowl", kcal: 330, protein: 12, carbs: 30, fat: 18, fiber: 8, sugar: 3, sodium: 550 },
  { id: "in-rajma", name: "Rajma", serving: "1 bowl", kcal: 230, protein: 12, carbs: 32, fat: 6, fiber: 9, sugar: 3, sodium: 500 },
  { id: "in-chole", name: "Chole / Chana masala", serving: "1 bowl", kcal: 270, protein: 12, carbs: 38, fat: 8, fiber: 10, sugar: 5, sodium: 600 },
  { id: "in-sambar", name: "Sambar", serving: "1 bowl", kcal: 120, protein: 6, carbs: 18, fat: 3, fiber: 5, sugar: 3, sodium: 480 },
  { id: "in-kadhi", name: "Kadhi", serving: "1 bowl", kcal: 200, protein: 7, carbs: 18, fat: 11, fiber: 1, sugar: 5, sodium: 520 },
  { id: "in-chickpeas", name: "Chickpeas (boiled)", serving: "1 cup", kcal: 269, protein: 15, carbs: 45, fat: 4, fiber: 13, sugar: 8, sodium: 11 },
  { id: "in-lentils", name: "Lentils (boiled)", serving: "1 cup", kcal: 230, protein: 18, carbs: 40, fat: 1, fiber: 16, sugar: 4, sodium: 4 },

  // ---- Paneer / tofu / veg dishes ----
  { id: "in-paneer", name: "Paneer (raw)", serving: "100 g", kcal: 265, protein: 18, carbs: 3, fat: 21, fiber: 0, sugar: 3, sodium: 22 },
  { id: "in-paneer-butter", name: "Paneer butter masala", serving: "1 bowl", kcal: 350, protein: 14, carbs: 16, fat: 26, fiber: 2, sugar: 6, sodium: 600 },
  { id: "in-palak-paneer", name: "Palak paneer", serving: "1 bowl", kcal: 280, protein: 14, carbs: 12, fat: 20, fiber: 4, sugar: 3, sodium: 550 },
  { id: "in-paneer-tikka", name: "Paneer tikka", serving: "100 g", kcal: 270, protein: 18, carbs: 8, fat: 18, fiber: 1, sugar: 4, sodium: 480 },
  { id: "in-tofu", name: "Tofu", serving: "100 g", kcal: 144, protein: 15, carbs: 3, fat: 9, fiber: 1, sugar: 1, sodium: 14 },
  { id: "in-aloo-gobi", name: "Aloo gobi", serving: "1 bowl", kcal: 180, protein: 5, carbs: 20, fat: 10, fiber: 5, sugar: 4, sodium: 400 },
  { id: "in-bhindi", name: "Bhindi masala", serving: "1 bowl", kcal: 160, protein: 4, carbs: 14, fat: 10, fiber: 5, sugar: 4, sodium: 380 },
  { id: "in-mixed-veg", name: "Mixed veg curry", serving: "1 bowl", kcal: 180, protein: 5, carbs: 18, fat: 10, fiber: 5, sugar: 5, sodium: 420 },
  { id: "in-raita", name: "Raita", serving: "1 bowl", kcal: 120, protein: 5, carbs: 10, fat: 6, fiber: 1, sugar: 6, sodium: 300 },

  // ---- South Indian ----
  { id: "in-idli", name: "Idli", serving: "2", kcal: 140, protein: 4, carbs: 30, fat: 1, fiber: 2, sugar: 0, sodium: 200 },
  { id: "in-dosa", name: "Plain dosa", serving: "1", kcal: 170, protein: 4, carbs: 30, fat: 4, fiber: 2, sugar: 0, sodium: 220 },
  { id: "in-masala-dosa", name: "Masala dosa", serving: "1", kcal: 290, protein: 6, carbs: 44, fat: 10, fiber: 3, sugar: 1, sodium: 420 },
  { id: "in-uttapam", name: "Uttapam", serving: "1", kcal: 200, protein: 5, carbs: 34, fat: 5, fiber: 2, sugar: 2, sodium: 300 },
  { id: "in-vada", name: "Medu vada", serving: "1", kcal: 130, protein: 4, carbs: 16, fat: 6, fiber: 2, sugar: 0, sodium: 220 },
  { id: "in-upma", name: "Upma", serving: "1 bowl", kcal: 250, protein: 6, carbs: 40, fat: 8, fiber: 3, sugar: 1, sodium: 400 },
  { id: "in-poha", name: "Poha", serving: "1 bowl", kcal: 270, protein: 5, carbs: 45, fat: 8, fiber: 3, sugar: 2, sodium: 380 },
  { id: "in-dhokla", name: "Dhokla", serving: "100 g", kcal: 160, protein: 6, carbs: 24, fat: 4, fiber: 2, sugar: 5, sodium: 350 },
  { id: "in-besan-chilla", name: "Besan chilla", serving: "2", kcal: 200, protein: 10, carbs: 20, fat: 8, fiber: 4, sugar: 2, sodium: 300 },

  // ---- Non-veg mains ----
  { id: "in-butter-chicken", name: "Butter chicken", serving: "1 bowl", kcal: 430, protein: 30, carbs: 12, fat: 28, fiber: 1, sugar: 6, sodium: 700 },
  { id: "in-chicken-curry", name: "Chicken curry", serving: "1 bowl", kcal: 300, protein: 26, carbs: 8, fat: 18, fiber: 1, sugar: 3, sodium: 600 },
  { id: "in-tandoori-chicken", name: "Tandoori chicken", serving: "2 pieces", kcal: 300, protein: 38, carbs: 4, fat: 14, fiber: 0, sugar: 2, sodium: 550 },
  { id: "in-egg-curry", name: "Egg curry (2 eggs)", serving: "1 bowl", kcal: 280, protein: 16, carbs: 10, fat: 20, fiber: 1, sugar: 3, sodium: 500 },
  { id: "in-fish-curry", name: "Fish curry", serving: "1 bowl", kcal: 250, protein: 24, carbs: 8, fat: 13, fiber: 1, sugar: 3, sodium: 550 },
  { id: "f-chicken", name: "Chicken breast", serving: "150 g", kcal: 248, protein: 46, carbs: 0, fat: 6, fiber: 0, sugar: 0, sodium: 110 },
  { id: "f-salmon", name: "Salmon", serving: "150 g", kcal: 312, protein: 30, carbs: 0, fat: 20, fiber: 0, sugar: 0, sodium: 90 },
  { id: "f-steak", name: "Steak", serving: "200 g", kcal: 460, protein: 46, carbs: 0, fat: 30, fiber: 0, sugar: 0, sodium: 130 },

  // ---- Street food & snacks ----
  { id: "in-samosa", name: "Samosa", serving: "1", kcal: 260, protein: 5, carbs: 30, fat: 13, fiber: 3, sugar: 1, sodium: 400 },
  { id: "in-pakora", name: "Pakora", serving: "100 g", kcal: 320, protein: 8, carbs: 30, fat: 18, fiber: 4, sugar: 1, sodium: 450 },
  { id: "in-vada-pav", name: "Vada pav", serving: "1", kcal: 290, protein: 7, carbs: 40, fat: 12, fiber: 3, sugar: 3, sodium: 550 },
  { id: "in-pav-bhaji", name: "Pav bhaji", serving: "1 plate", kcal: 400, protein: 10, carbs: 50, fat: 18, fiber: 6, sugar: 6, sodium: 900 },
  { id: "in-chole-bhature", name: "Chole bhature", serving: "1 plate", kcal: 450, protein: 12, carbs: 55, fat: 20, fiber: 8, sugar: 5, sodium: 800 },
  { id: "in-dhokla-snack", name: "Kachori", serving: "1", kcal: 230, protein: 5, carbs: 26, fat: 12, fiber: 2, sugar: 1, sodium: 300 },

  // ---- Sweets & drinks ----
  { id: "in-gulab-jamun", name: "Gulab jamun", serving: "2", kcal: 300, protein: 4, carbs: 45, fat: 12, fiber: 0, sugar: 40, sodium: 60 },
  { id: "in-jalebi", name: "Jalebi", serving: "100 g", kcal: 380, protein: 3, carbs: 60, fat: 15, fiber: 0, sugar: 45, sodium: 40 },
  { id: "in-rasgulla", name: "Rasgulla", serving: "2", kcal: 250, protein: 6, carbs: 45, fat: 5, fiber: 0, sugar: 42, sodium: 50 },
  { id: "in-kheer", name: "Kheer", serving: "1 bowl", kcal: 250, protein: 7, carbs: 40, fat: 8, fiber: 1, sugar: 32, sodium: 90 },
  { id: "in-lassi", name: "Sweet lassi", serving: "1 glass", kcal: 220, protein: 8, carbs: 30, fat: 7, fiber: 0, sugar: 28, sodium: 90 },
  { id: "in-chai", name: "Masala chai", serving: "1 cup", kcal: 90, protein: 3, carbs: 12, fat: 3, fiber: 0, sugar: 10, sodium: 30 },
  { id: "in-dahi", name: "Curd / Dahi", serving: "1 cup (150 g)", kcal: 100, protein: 6, carbs: 8, fat: 5, fiber: 0, sugar: 8, sodium: 60 },

  // ---- Everyday breakfast / dairy / eggs ----
  { id: "f-oats", name: "Oatmeal", serving: "1 bowl", kcal: 290, protein: 8, carbs: 52, fat: 6, fiber: 8, sugar: 12, sodium: 120 },
  { id: "f-eggs", name: "Scrambled eggs", serving: "2 eggs", kcal: 180, protein: 12, carbs: 2, fat: 13, fiber: 0, sugar: 1, sodium: 340 },
  { id: "in-boiled-egg", name: "Boiled egg", serving: "1", kcal: 78, protein: 6, carbs: 1, fat: 5, fiber: 0, sugar: 0, sodium: 62 },
  { id: "in-omelette", name: "Omelette (2 egg)", serving: "1", kcal: 220, protein: 14, carbs: 2, fat: 17, fiber: 0, sugar: 1, sodium: 380 },
  { id: "f-yogurt", name: "Greek yogurt", serving: "170 g", kcal: 100, protein: 17, carbs: 6, fat: 0, fiber: 0, sugar: 5, sodium: 60 },
  { id: "f-milk", name: "Milk", serving: "1 cup", kcal: 122, protein: 8, carbs: 12, fat: 5, fiber: 0, sugar: 12, sodium: 100 },
  { id: "f-toast", name: "Toast w/ butter", serving: "2 slices", kcal: 220, protein: 6, carbs: 30, fat: 9, fiber: 3, sugar: 3, sodium: 320 },
  { id: "in-peanut-butter", name: "Peanut butter", serving: "2 tbsp", kcal: 190, protein: 8, carbs: 6, fat: 16, fiber: 2, sugar: 3, sodium: 140 },
  { id: "f-shake", name: "Protein shake", serving: "1 scoop", kcal: 160, protein: 30, carbs: 6, fat: 3, fiber: 1, sugar: 3, sodium: 90 },
  { id: "f-coffee", name: "Coffee w/ milk", serving: "1 cup", kcal: 40, protein: 2, carbs: 4, fat: 2, fiber: 0, sugar: 3, sodium: 30 },

  // ---- Fruits & veg ----
  { id: "f-banana", name: "Banana", serving: "1 medium", kcal: 105, protein: 1, carbs: 27, fat: 0, fiber: 3, sugar: 14, sodium: 1 },
  { id: "f-apple", name: "Apple", serving: "1 medium", kcal: 95, protein: 0, carbs: 25, fat: 0, fiber: 4, sugar: 19, sodium: 2 },
  { id: "in-mango", name: "Mango", serving: "1 cup", kcal: 99, protein: 1, carbs: 25, fat: 1, fiber: 3, sugar: 23, sodium: 2 },
  { id: "in-orange", name: "Orange", serving: "1 medium", kcal: 62, protein: 1, carbs: 15, fat: 0, fiber: 3, sugar: 12, sodium: 0 },
  { id: "in-grapes", name: "Grapes", serving: "1 cup", kcal: 104, protein: 1, carbs: 27, fat: 0, fiber: 1, sugar: 23, sodium: 3 },
  { id: "in-blueberries", name: "Blueberries", serving: "1 cup", kcal: 84, protein: 1, carbs: 21, fat: 0, fiber: 4, sugar: 15, sodium: 1 },
  { id: "in-avocado", name: "Avocado", serving: "1/2", kcal: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, sugar: 1, sodium: 7 },
  { id: "f-broccoli", name: "Broccoli", serving: "1 cup", kcal: 31, protein: 3, carbs: 6, fat: 0, fiber: 2, sugar: 2, sodium: 30 },
  { id: "in-potato", name: "Potato (boiled)", serving: "1 medium", kcal: 130, protein: 3, carbs: 30, fat: 0, fiber: 3, sugar: 1, sodium: 10 },
  { id: "in-sweet-potato", name: "Sweet potato", serving: "1 medium", kcal: 112, protein: 2, carbs: 26, fat: 0, fiber: 4, sugar: 5, sodium: 72 },

  // ---- Nuts & fats ----
  { id: "f-almonds", name: "Almonds", serving: "28 g", kcal: 164, protein: 6, carbs: 6, fat: 14, fiber: 4, sugar: 1, sodium: 0 },
  { id: "in-cashews", name: "Cashews", serving: "28 g", kcal: 157, protein: 5, carbs: 9, fat: 12, fiber: 1, sugar: 2, sodium: 3 },
  { id: "in-peanuts", name: "Peanuts", serving: "28 g", kcal: 161, protein: 7, carbs: 6, fat: 14, fiber: 2, sugar: 1, sodium: 5 },
  { id: "in-walnuts", name: "Walnuts", serving: "28 g", kcal: 185, protein: 4, carbs: 4, fat: 18, fiber: 2, sugar: 1, sodium: 1 },
  { id: "in-ghee", name: "Ghee", serving: "1 tbsp", kcal: 112, protein: 0, carbs: 0, fat: 13, fiber: 0, sugar: 0, sodium: 0 },
  { id: "in-butter", name: "Butter", serving: "1 tbsp", kcal: 102, protein: 0, carbs: 0, fat: 12, fiber: 0, sugar: 0, sodium: 90 },
  { id: "in-olive-oil", name: "Olive oil", serving: "1 tbsp", kcal: 119, protein: 0, carbs: 0, fat: 14, fiber: 0, sugar: 0, sodium: 0 },

  // ---- Western meals & extras ----
  { id: "f-pasta", name: "Pasta w/ sauce", serving: "1 plate", kcal: 430, protein: 14, carbs: 68, fat: 11, fiber: 5, sugar: 9, sodium: 620 },
  { id: "f-pizza", name: "Pizza", serving: "2 slices", kcal: 570, protein: 24, carbs: 72, fat: 20, fiber: 4, sugar: 8, sodium: 1180 },
  { id: "f-burrito", name: "Chicken burrito", serving: "1 burrito", kcal: 650, protein: 34, carbs: 78, fat: 22, fiber: 9, sugar: 4, sodium: 1200 },
  { id: "f-salad", name: "Chicken salad", serving: "1 bowl", kcal: 380, protein: 30, carbs: 14, fat: 22, fiber: 5, sugar: 6, sodium: 540 },
  { id: "f-tuna", name: "Tuna sandwich", serving: "1", kcal: 340, protein: 24, carbs: 34, fat: 12, fiber: 4, sugar: 5, sodium: 700 },
  { id: "f-soup", name: "Vegetable soup", serving: "1 bowl", kcal: 160, protein: 6, carbs: 24, fat: 4, fiber: 6, sugar: 8, sodium: 780 },
  { id: "f-fries", name: "Fries", serving: "1 medium", kcal: 365, protein: 4, carbs: 48, fat: 17, fiber: 4, sugar: 0, sodium: 250 },
  { id: "f-choc", name: "Dark chocolate", serving: "30 g", kcal: 170, protein: 2, carbs: 13, fat: 12, fiber: 3, sugar: 7, sodium: 6 },
  { id: "f-beer", name: "Beer", serving: "1 can", kcal: 153, protein: 2, carbs: 13, fat: 0, fiber: 0, sugar: 0, sodium: 14 },
  { id: "in-coke", name: "Cola", serving: "1 can", kcal: 140, protein: 0, carbs: 39, fat: 0, fiber: 0, sugar: 39, sodium: 45 },
  { id: "in-orange-juice", name: "Orange juice", serving: "1 cup", kcal: 112, protein: 2, carbs: 26, fat: 0, fiber: 0, sugar: 21, sodium: 2 },
  { id: "in-green-tea", name: "Green tea", serving: "1 cup", kcal: 2, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 2 },
];

export function food(id: string): NutritionFood {
  return FOOD_DB.find((f) => f.id === id) ?? FOOD_DB[0];
}

/** Rank curated foods for a query: prefix/word-start matches first, then substring. */
export function searchFoods(query: string, limit = 8): NutritionFood[] {
  const q = query.trim().toLowerCase();
  if (!q) return FOOD_DB.slice(0, 6);
  const scored: { f: NutritionFood; score: number }[] = [];
  for (const f of FOOD_DB) {
    const name = f.name.toLowerCase();
    const idx = name.indexOf(q);
    if (idx < 0) continue;
    // Whole-word start beats mid-word; earlier match beats later.
    const wordStart = idx === 0 || name[idx - 1] === " " || name[idx - 1] === "/";
    scored.push({ f, score: (wordStart ? 0 : 100) + idx });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.f);
}
