import { FoodItem } from "../types";

/**
 * Built-in food database — common foods with per-serving macros, so logging
 * is fast and fully offline (no external API). Values are reasonable rounded
 * averages; users can always adjust servings or add a custom item.
 */
export const FOODS: FoodItem[] = [
  // Protein
  { name: "Chicken breast", category: "Protein", servingLabel: "100 g", calories: 165, proteinG: 31, carbsG: 0, fatG: 4 },
  { name: "Salmon", category: "Protein", servingLabel: "100 g", calories: 208, proteinG: 20, carbsG: 0, fatG: 13 },
  { name: "Ground beef (85%)", category: "Protein", servingLabel: "100 g", calories: 250, proteinG: 26, carbsG: 0, fatG: 15 },
  { name: "Eggs", category: "Protein", servingLabel: "1 large", calories: 72, proteinG: 6, carbsG: 0, fatG: 5 },
  { name: "Egg whites", category: "Protein", servingLabel: "1 cup", calories: 126, proteinG: 26, carbsG: 2, fatG: 0 },
  { name: "Greek yogurt (nonfat)", category: "Protein", servingLabel: "170 g", calories: 100, proteinG: 17, carbsG: 6, fatG: 0 },
  { name: "Cottage cheese", category: "Protein", servingLabel: "1/2 cup", calories: 90, proteinG: 12, carbsG: 5, fatG: 2 },
  { name: "Tuna (canned)", category: "Protein", servingLabel: "100 g", calories: 116, proteinG: 26, carbsG: 0, fatG: 1 },
  { name: "Shrimp", category: "Protein", servingLabel: "100 g", calories: 99, proteinG: 24, carbsG: 0, fatG: 0 },
  { name: "Turkey breast", category: "Protein", servingLabel: "100 g", calories: 135, proteinG: 30, carbsG: 0, fatG: 1 },
  { name: "Tofu (firm)", category: "Protein", servingLabel: "100 g", calories: 144, proteinG: 17, carbsG: 3, fatG: 9 },
  { name: "Tempeh", category: "Protein", servingLabel: "100 g", calories: 192, proteinG: 20, carbsG: 8, fatG: 11 },
  { name: "Whey protein", category: "Protein", servingLabel: "1 scoop", calories: 120, proteinG: 25, carbsG: 3, fatG: 1 },
  { name: "Pork tenderloin", category: "Protein", servingLabel: "100 g", calories: 143, proteinG: 26, carbsG: 0, fatG: 4 },

  // Carbs
  { name: "White rice (cooked)", category: "Carbs", servingLabel: "1 cup", calories: 205, proteinG: 4, carbsG: 45, fatG: 0 },
  { name: "Brown rice (cooked)", category: "Carbs", servingLabel: "1 cup", calories: 216, proteinG: 5, carbsG: 45, fatG: 2 },
  { name: "Oats (dry)", category: "Carbs", servingLabel: "1/2 cup", calories: 150, proteinG: 5, carbsG: 27, fatG: 3 },
  { name: "Sweet potato", category: "Carbs", servingLabel: "1 medium", calories: 112, proteinG: 2, carbsG: 26, fatG: 0 },
  { name: "Potato", category: "Carbs", servingLabel: "1 medium", calories: 163, proteinG: 4, carbsG: 37, fatG: 0 },
  { name: "Whole wheat bread", category: "Carbs", servingLabel: "1 slice", calories: 80, proteinG: 4, carbsG: 14, fatG: 1 },
  { name: "Bagel", category: "Carbs", servingLabel: "1 medium", calories: 245, proteinG: 10, carbsG: 48, fatG: 2 },
  { name: "Pasta (cooked)", category: "Carbs", servingLabel: "1 cup", calories: 220, proteinG: 8, carbsG: 43, fatG: 1 },
  { name: "Quinoa (cooked)", category: "Carbs", servingLabel: "1 cup", calories: 222, proteinG: 8, carbsG: 39, fatG: 4 },
  { name: "Banana", category: "Carbs", servingLabel: "1 medium", calories: 105, proteinG: 1, carbsG: 27, fatG: 0 },
  { name: "Apple", category: "Carbs", servingLabel: "1 medium", calories: 95, proteinG: 0, carbsG: 25, fatG: 0 },
  { name: "Blueberries", category: "Carbs", servingLabel: "1 cup", calories: 84, proteinG: 1, carbsG: 21, fatG: 0 },
  { name: "Tortilla (flour)", category: "Carbs", servingLabel: "1 medium", calories: 140, proteinG: 4, carbsG: 24, fatG: 4 },
  { name: "Cereal", category: "Carbs", servingLabel: "1 cup", calories: 150, proteinG: 3, carbsG: 33, fatG: 2 },

  // Vegetables
  { name: "Broccoli", category: "Vegetables", servingLabel: "1 cup", calories: 31, proteinG: 3, carbsG: 6, fatG: 0 },
  { name: "Spinach", category: "Vegetables", servingLabel: "1 cup", calories: 7, proteinG: 1, carbsG: 1, fatG: 0 },
  { name: "Mixed salad", category: "Vegetables", servingLabel: "2 cups", calories: 20, proteinG: 2, carbsG: 4, fatG: 0 },
  { name: "Avocado", category: "Vegetables", servingLabel: "1/2 medium", calories: 160, proteinG: 2, carbsG: 9, fatG: 15 },
  { name: "Bell pepper", category: "Vegetables", servingLabel: "1 medium", calories: 31, proteinG: 1, carbsG: 7, fatG: 0 },
  { name: "Carrots", category: "Vegetables", servingLabel: "1 cup", calories: 52, proteinG: 1, carbsG: 12, fatG: 0 },

  // Fats & nuts
  { name: "Almonds", category: "Fats & nuts", servingLabel: "28 g", calories: 164, proteinG: 6, carbsG: 6, fatG: 14 },
  { name: "Peanut butter", category: "Fats & nuts", servingLabel: "2 tbsp", calories: 188, proteinG: 8, carbsG: 6, fatG: 16 },
  { name: "Olive oil", category: "Fats & nuts", servingLabel: "1 tbsp", calories: 119, proteinG: 0, carbsG: 0, fatG: 14 },
  { name: "Cheddar cheese", category: "Fats & nuts", servingLabel: "28 g", calories: 113, proteinG: 7, carbsG: 0, fatG: 9 },
  { name: "Walnuts", category: "Fats & nuts", servingLabel: "28 g", calories: 185, proteinG: 4, carbsG: 4, fatG: 18 },
  { name: "Chia seeds", category: "Fats & nuts", servingLabel: "1 tbsp", calories: 58, proteinG: 2, carbsG: 5, fatG: 4 },

  // Meals & snacks
  { name: "Protein bar", category: "Snacks", servingLabel: "1 bar", calories: 210, proteinG: 20, carbsG: 22, fatG: 7 },
  { name: "Protein shake", category: "Snacks", servingLabel: "1 shake", calories: 160, proteinG: 30, carbsG: 6, fatG: 3 },
  { name: "Chicken burrito", category: "Meals", servingLabel: "1 burrito", calories: 650, proteinG: 34, carbsG: 78, fatG: 22 },
  { name: "Cheeseburger", category: "Meals", servingLabel: "1 burger", calories: 550, proteinG: 30, carbsG: 40, fatG: 30 },
  { name: "Pizza slice", category: "Meals", servingLabel: "1 slice", calories: 285, proteinG: 12, carbsG: 36, fatG: 10 },
  { name: "Caesar salad w/ chicken", category: "Meals", servingLabel: "1 bowl", calories: 470, proteinG: 34, carbsG: 12, fatG: 32 },
  { name: "Sushi roll", category: "Meals", servingLabel: "8 pcs", calories: 350, proteinG: 12, carbsG: 60, fatG: 7 },
  { name: "Oatmeal w/ berries", category: "Meals", servingLabel: "1 bowl", calories: 290, proteinG: 8, carbsG: 52, fatG: 6 },
  { name: "Chicken & rice bowl", category: "Meals", servingLabel: "1 bowl", calories: 520, proteinG: 40, carbsG: 55, fatG: 14 },

  // Drinks
  { name: "Milk (2%)", category: "Drinks", servingLabel: "1 cup", calories: 122, proteinG: 8, carbsG: 12, fatG: 5 },
  { name: "Almond milk (unsweet)", category: "Drinks", servingLabel: "1 cup", calories: 30, proteinG: 1, carbsG: 1, fatG: 3 },
  { name: "Orange juice", category: "Drinks", servingLabel: "1 cup", calories: 112, proteinG: 2, carbsG: 26, fatG: 0 },
  { name: "Beer", category: "Drinks", servingLabel: "1 can", calories: 153, proteinG: 2, carbsG: 13, fatG: 0 },
  { name: "Coffee (black)", category: "Drinks", servingLabel: "1 cup", calories: 2, proteinG: 0, carbsG: 0, fatG: 0 },
  { name: "Latte", category: "Drinks", servingLabel: "1 medium", calories: 190, proteinG: 12, carbsG: 19, fatG: 7 },
];

export function searchFoods(query: string, limit = 8): FoodItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return FOODS.slice(0, limit);
  const starts = FOODS.filter((f) => f.name.toLowerCase().startsWith(q));
  const contains = FOODS.filter(
    (f) => !f.name.toLowerCase().startsWith(q) && (f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q))
  );
  return [...starts, ...contains].slice(0, limit);
}
