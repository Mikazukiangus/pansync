import { normalize } from './matching'
import type { Recipe } from '../types'

export type MealPriorityId =
  | 'high-protein'
  | 'vegetarian'
  | 'crustacean'
  | 'low-calorie'
  | 'no-carbs'

export interface MealPriorityOption {
  id: MealPriorityId
  label: string
  description: string
}

export const MEAL_PRIORITIES: readonly MealPriorityOption[] = [
  {
    id: 'high-protein',
    label: 'High protein',
    description: 'Rich in meats, seafood, eggs, legumes, or high-protein dairy',
  },
  {
    id: 'vegetarian',
    label: 'Vegetarian',
    description: 'No meat, poultry, fish, or shellfish',
  },
  {
    id: 'crustacean',
    label: 'Crustacean',
    description: 'Features prawns, shrimp, crab, lobster, or crayfish',
  },
  {
    id: 'low-calorie',
    label: 'Low calorie',
    description: 'Lighter meals without heavy creams, pastry, or rich batters',
  },
  {
    id: 'no-carbs',
    label: 'No carbs',
    description: 'Skips rice, pasta, bread, potatoes, noodles, and sugars',
  },
] as const

const NON_VEG_CATEGORIES = new Set([
  'beef',
  'chicken',
  'lamb',
  'pork',
  'goat',
  'seafood',
])

const PROTEIN_CATEGORIES = new Set([
  'beef',
  'chicken',
  'lamb',
  'pork',
  'goat',
  'seafood',
])

const CRUSTACEAN_TERMS = [
  'prawn',
  'prawns',
  'king prawn',
  'tiger prawn',
  'shrimp',
  'crab',
  'crabmeat',
  'lobster',
  'crayfish',
  'crawfish',
  'langoustine',
  'scampi',
  'krill',
]

const NON_VEG_TERMS = [
  'beef',
  'steak',
  'brisket',
  'veal',
  'mince',
  'ground beef',
  'pork',
  'bacon',
  'ham',
  'gammon',
  'prosciutto',
  'pancetta',
  'sausage',
  'chorizo',
  'salami',
  'pepperoni',
  'lard',
  'suet',
  'lamb',
  'mutton',
  'goat',
  'venison',
  'duck',
  'turkey',
  'chicken',
  'poultry',
  'goose',
  'pheasant',
  'rabbit',
  'meat',
  'meatball',
  'fish',
  'salmon',
  'tuna',
  'cod',
  'haddock',
  'halibut',
  'trout',
  'mackerel',
  'sardine',
  'anchovy',
  'anchovies',
  'herring',
  'sea bass',
  'tilapia',
  'snapper',
  'sole',
  'monkfish',
  'swordfish',
  'mussel',
  'clam',
  'oyster',
  'scallop',
  'squid',
  'calamari',
  'octopus',
  'seafood',
  'oyster sauce',
  'fish sauce',
  'worcestershire',
  'chicken stock',
  'beef stock',
  'duck fat',
  'gelatin',
  'gelatine',
  'bonito',
  'dashi',
  ...CRUSTACEAN_TERMS,
]

const HIGH_PROTEIN_PLANT_OR_DAIRY = [
  'egg',
  'tofu',
  'tempeh',
  'edamame',
  'seitan',
  'lentil',
  'red lentil',
  'green lentil',
  'chickpea',
  'black bean',
  'cannellini bean',
  'kidney bean',
  'pinto bean',
  'white bean',
  'butter bean',
  'haricot bean',
  'soybean',
  'paneer',
  'halloumi',
  'cottage cheese',
  'greek yogurt',
  'feta',
  'ricotta',
  'parmesan',
  'cheddar',
  'mozzarella',
  'peanut butter',
  'quinoa',
]

const CARB_INGREDIENT_TERMS = [
  'rice',
  'pasta',
  'spaghetti',
  'penne',
  'macaroni',
  'fettuccine',
  'linguine',
  'tagliatelle',
  'lasagne',
  'lasagna',
  'rigatoni',
  'fusilli',
  'orzo',
  'gnocchi',
  'noodle',
  'egg noodle',
  'ramen',
  'udon',
  'vermicelli',
  'couscous',
  'quinoa',
  'bulgur',
  'barley',
  'polenta',
  'oat',
  'oatmeal',
  'bread',
  'toast',
  'baguette',
  'brioche',
  'ciabatta',
  'focaccia',
  'sourdough',
  'bun',
  'tortilla',
  'wrap',
  'pita',
  'pitta',
  'naan',
  'flatbread',
  'chapati',
  'roti',
  'crouton',
  'breadcrumb',
  'panko',
  'flour',
  'cornflour',
  'cornstarch',
  'starch',
  'potato',
  'sweet potato',
  'yam',
  'fries',
  'pastry',
  'puff pastry',
  'shortcrust',
  'phyllo',
  'filo',
  'dough',
  'crust',
  'biscuit',
  'cracker',
  'taco',
  'sugar',
  'brown sugar',
  'caster sugar',
  'icing sugar',
  'powdered sugar',
  'honey',
  'maple syrup',
  'syrup',
  'molasses',
  'treacle',
  'jam',
  'marmalade',
  'chocolate',
  'cocoa',
  'sweetcorn',
  'corn',
  'lentil',
  'chickpea',
  'black bean',
  'cannellini bean',
  'kidney bean',
  'pinto bean',
  'butter bean',
  'baked bean',
  'haricot bean',
  'white bean',
  'banana',
  'apple',
  'mango',
  'pineapple',
  'raisin',
  'date',
  'dried fruit',
  'cranberry',
]

const HIGH_CALORIE_INGREDIENT_TERMS = [
  'heavy cream',
  'double cream',
  'whipping cream',
  'sour cream',
  'clotted cream',
  'creme fraiche',
  'condensed milk',
  'evaporated milk',
  'mascarpone',
  'cream cheese',
  'mayonnaise',
  'bacon',
  'sausage',
  'salami',
  'chorizo',
  'pancetta',
  'prosciutto',
  'pork belly',
  'duck',
  'lamb',
  'ghee',
  'lard',
  'suet',
  'peanut butter',
  'tahini',
  'coconut cream',
  'coconut milk',
  'puff pastry',
  'shortcrust',
  'pastry',
  'dough',
  'sugar',
  'brown sugar',
  'caster sugar',
  'icing sugar',
  'chocolate',
  'caramel',
  'cheddar',
  'mozzarella',
  'parmesan',
  'halloumi',
  'brie',
  'gruyere',
  'stilton',
  'bread',
  'tortilla',
  'noodle',
  'pasta',
]

const HIGH_CALORIE_NAME_TERMS = [
  'fried',
  'deep-fried',
  'crispy',
  'creamy',
  'cheesy',
  'cheese',
  'melt',
  'butter',
  'cake',
  'pie',
  'pudding',
  'tart',
  'brownie',
  'fudge',
  'lasagne',
  'lasagna',
  'macaroni',
  'alfredo',
  'carbonara',
  'pastry',
  'pancake',
  'quesadilla',
  'noodle',
]

function containsWholePhrase(haystack: string, phrase: string): boolean {
  if (!haystack || !phrase) return false
  if (haystack === phrase) return true
  const hWords = haystack.split(' ')
  const pWords = phrase.split(' ')
  if (pWords.length > hWords.length) return false
  for (let i = 0; i <= hWords.length - pWords.length; i++) {
    let all = true
    for (let j = 0; j < pWords.length; j++) {
      if (hWords[i + j] !== pWords[j]) {
        all = false
        break
      }
    }
    if (all) return true
  }
  return false
}

function hasAnyPhrase(texts: readonly string[], phrases: readonly string[]): boolean {
  for (const text of texts) {
    for (const phrase of phrases) {
      if (containsWholePhrase(text, normalize(phrase))) {
        return true
      }
    }
  }
  return false
}

/**
 * Derive meal priority categories for a recipe from its category, title, and ingredients.
 */
export function getRecipePriorities(recipe: Recipe): MealPriorityId[] {
  const category = recipe.category.trim().toLowerCase()
  const normTitle = normalize(recipe.name)
  const normIngredients = recipe.ingredients.map((i) => normalize(i.name)).filter(Boolean)
  const allTexts = [normTitle, ...normIngredients]

  const priorities: MealPriorityId[] = []

  const hasCrustacean = hasAnyPhrase(allTexts, CRUSTACEAN_TERMS)
  const hasAnimalProduct =
    NON_VEG_CATEGORIES.has(category) || hasAnyPhrase(allTexts, NON_VEG_TERMS)

  const isDessert = category === 'dessert'

  const hasHighProteinSource =
    !isDessert &&
    (PROTEIN_CATEGORIES.has(category) ||
      hasAnyPhrase(normIngredients, NON_VEG_TERMS) ||
      hasAnyPhrase(normIngredients, HIGH_PROTEIN_PLANT_OR_DAIRY))

  if (hasHighProteinSource) {
    priorities.push('high-protein')
  }

  if (!hasAnimalProduct) {
    priorities.push('vegetarian')
  }

  if (hasCrustacean) {
    priorities.push('crustacean')
  }

  const isHighCalorie =
    isDessert ||
    hasAnyPhrase(normIngredients, HIGH_CALORIE_INGREDIENT_TERMS) ||
    HIGH_CALORIE_NAME_TERMS.some((term) => normTitle.includes(term))

  if (!isHighCalorie && recipe.ingredients.length > 0) {
    priorities.push('low-calorie')
  }

  const hasCarbIngredient =
    isDessert ||
    category === 'pasta' ||
    hasAnyPhrase(normIngredients, CARB_INGREDIENT_TERMS) ||
    ['rice', 'pasta', 'noodle', 'bread', 'toast', 'potato', 'quesadilla', 'wrap', 'pancake'].some(
      (term) => normTitle.includes(term),
    )

  if (!hasCarbIngredient && recipe.ingredients.length > 0) {
    priorities.push('no-carbs')
  }

  return priorities
}

export function recipeMatchesPriorities(
  recipe: Recipe,
  selectedPriorities: readonly MealPriorityId[],
): boolean {
  if (selectedPriorities.length === 0) return true
  const tags = new Set(getRecipePriorities(recipe))
  return selectedPriorities.every((priority) => tags.has(priority))
}
