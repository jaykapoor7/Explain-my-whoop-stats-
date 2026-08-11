import { NutritionFood } from "../types";

/** Small built-in food database (per serving). Architecture is API-ready:
 *  a future FoodProvider can replace this list with search/barcode results. */
export const FOOD_DB: NutritionFood[] = [
  { id: "f-oats", name: "Oatmeal", serving: "1 bowl", kcal: 290, protein: 8, carbs: 52, fat: 6, fiber: 8, sugar: 12, sodium: 120 },
  { id: "f-eggs", name: "Scrambled eggs", serving: "2 eggs", kcal: 180, protein: 12, carbs: 2, fat: 13, fiber: 0, sugar: 1, sodium: 340 },
  { id: "f-yogurt", name: "Greek yogurt", serving: "170 g", kcal: 100, protein: 17, carbs: 6, fat: 0, fiber: 0, sugar: 5, sodium: 60 },
  { id: "f-banana", name: "Banana", serving: "1 medium", kcal: 105, protein: 1, carbs: 27, fat: 0, fiber: 3, sugar: 14, sodium: 1 },
  { id: "f-coffee", name: "Coffee w/ milk", serving: "1 cup", kcal: 40, protein: 2, carbs: 4, fat: 2, fiber: 0, sugar: 3, sodium: 30 },
  { id: "f-chicken", name: "Chicken breast", serving: "150 g", kcal: 248, protein: 46, carbs: 0, fat: 6, fiber: 0, sugar: 0, sodium: 110 },
  { id: "f-rice", name: "White rice", serving: "1 cup", kcal: 205, protein: 4, carbs: 45, fat: 0, fiber: 1, sugar: 0, sodium: 2 },
  { id: "f-broccoli", name: "Broccoli", serving: "1 cup", kcal: 31, protein: 3, carbs: 6, fat: 0, fiber: 2, sugar: 2, sodium: 30 },
  { id: "f-salmon", name: "Salmon", serving: "150 g", kcal: 312, protein: 30, carbs: 0, fat: 20, fiber: 0, sugar: 0, sodium: 90 },
  { id: "f-pasta", name: "Pasta w/ sauce", serving: "1 plate", kcal: 430, protein: 14, carbs: 68, fat: 11, fiber: 5, sugar: 9, sodium: 620 },
  { id: "f-burrito", name: "Chicken burrito", serving: "1 burrito", kcal: 650, protein: 34, carbs: 78, fat: 22, fiber: 9, sugar: 4, sodium: 1200 },
  { id: "f-salad", name: "Chicken salad", serving: "1 bowl", kcal: 380, protein: 30, carbs: 14, fat: 22, fiber: 5, sugar: 6, sodium: 540 },
  { id: "f-shake", name: "Protein shake", serving: "1 scoop", kcal: 160, protein: 30, carbs: 6, fat: 3, fiber: 1, sugar: 3, sodium: 90 },
  { id: "f-almonds", name: "Almonds", serving: "28 g", kcal: 164, protein: 6, carbs: 6, fat: 14, fiber: 4, sugar: 1, sodium: 0 },
  { id: "f-apple", name: "Apple", serving: "1 medium", kcal: 95, protein: 0, carbs: 25, fat: 0, fiber: 4, sugar: 19, sodium: 2 },
  { id: "f-toast", name: "Toast w/ butter", serving: "2 slices", kcal: 220, protein: 6, carbs: 30, fat: 9, fiber: 3, sugar: 3, sodium: 320 },
  { id: "f-pizza", name: "Pizza", serving: "2 slices", kcal: 570, protein: 24, carbs: 72, fat: 20, fiber: 4, sugar: 8, sodium: 1180 },
  { id: "f-beer", name: "Beer", serving: "1 can", kcal: 153, protein: 2, carbs: 13, fat: 0, fiber: 0, sugar: 0, sodium: 14 },
  { id: "f-choc", name: "Dark chocolate", serving: "30 g", kcal: 170, protein: 2, carbs: 13, fat: 12, fiber: 3, sugar: 7, sodium: 6 },
  { id: "f-milk", name: "Milk", serving: "1 cup", kcal: 122, protein: 8, carbs: 12, fat: 5, fiber: 0, sugar: 12, sodium: 100 },
  { id: "f-tuna", name: "Tuna sandwich", serving: "1", kcal: 340, protein: 24, carbs: 34, fat: 12, fiber: 4, sugar: 5, sodium: 700 },
  { id: "f-soup", name: "Vegetable soup", serving: "1 bowl", kcal: 160, protein: 6, carbs: 24, fat: 4, fiber: 6, sugar: 8, sodium: 780 },
  { id: "f-steak", name: "Steak", serving: "200 g", kcal: 460, protein: 46, carbs: 0, fat: 30, fiber: 0, sugar: 0, sodium: 130 },
  { id: "f-fries", name: "Fries", serving: "1 medium", kcal: 365, protein: 4, carbs: 48, fat: 17, fiber: 4, sugar: 0, sodium: 250 },
];

export function food(id: string): NutritionFood {
  return FOOD_DB.find((f) => f.id === id) ?? FOOD_DB[0];
}
