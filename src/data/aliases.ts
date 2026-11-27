/**
 * Canonical ingredient alias map.
 * Both sides of UK/US and leftover/fresh variants map to a single canonical form
 * so matching works symmetrically in either direction.
 */
export const INGREDIENT_ALIASES: Record<string, string> = {
  // Leftover / cooked staples -> canonical base
  'cooked rice': 'rice',
  'leftover rice': 'rice',
  'steamed rice': 'rice',
  'cold rice': 'rice',
  'white rice': 'rice',
  'cooked chicken': 'chicken',
  'leftover chicken': 'chicken',
  'roast chicken': 'chicken',
  'rotisserie chicken': 'chicken',
  'shredded chicken': 'chicken',
  'cooked pasta': 'pasta',
  'leftover pasta': 'pasta',
  'cooked potato': 'potato',
  'leftover potato': 'potato',
  'boiled potato': 'potato',
  'mashed potato': 'potato',
  'cooked beef': 'beef',
  'roast beef': 'beef',
  'leftover beef': 'beef',
  'cooked pork': 'pork',
  'roast pork': 'pork',

  // Alliums & aromatics
  scallion: 'spring onion',
  'green onion': 'spring onion',
  'salad onion': 'spring onion',
  'garlic clove': 'garlic',
  'clove of garlic': 'garlic',
  'minced garlic': 'garlic',

  // UK <-> US vegetables & herbs
  aubergine: 'eggplant',
  'egg plant': 'eggplant',
  courgette: 'zucchini',
  capsicum: 'bell pepper',
  'sweet pepper': 'bell pepper',
  'red capsicum': 'red pepper',
  'green capsicum': 'green pepper',
  'yellow capsicum': 'yellow pepper',
  'red bell pepper': 'red pepper',
  'green bell pepper': 'green pepper',
  'yellow bell pepper': 'yellow pepper',
  cilantro: 'coriander',
  'fresh cilantro': 'coriander',
  'fresh coriander': 'coriander',
  'coriander leaf': 'coriander',
  rocket: 'arugula',
  swede: 'rutabaga',
  mangetout: 'snow pea',
  'pak choi': 'bok choy',
  'pak choy': 'bok choy',
  'cos lettuce': 'romaine lettuce',
  'garbanzo bean': 'chickpea',
  garbanzo: 'chickpea',
  'broad bean': 'fava bean',
  chilli: 'chili',
  'red chilli': 'red chili',
  'green chilli': 'green chili',
  'chilli powder': 'chili powder',
  'chilli flake': 'chili flake',
  'tinned tomato': 'canned tomato',

  // Meats & seafood
  'minced beef': 'ground beef',
  'beef mince': 'ground beef',
  'lean minced beef': 'ground beef',
  'minced pork': 'ground pork',
  'pork mince': 'ground pork',
  'minced lamb': 'ground lamb',
  'lamb mince': 'ground lamb',
  'minced turkey': 'ground turkey',
  'turkey mince': 'ground turkey',
  prawn: 'shrimp',
  'king prawn': 'shrimp',
  'tiger prawn': 'shrimp',
  'raw prawn': 'shrimp',
  'streaky bacon': 'bacon',
  'back bacon': 'bacon',
  gammon: 'ham',

  // Dairy & baking
  'double cream': 'heavy cream',
  'whipping cream': 'heavy cream',
  'single cream': 'light cream',
  'caster sugar': 'sugar',
  'granulated sugar': 'sugar',
  'white sugar': 'sugar',
  'icing sugar': 'powdered sugar',
  'confectioners sugar': 'powdered sugar',
  'plain flour': 'flour',
  'all purpose flour': 'flour',
  cornflour: 'cornstarch',
  'corn flour': 'cornstarch',
  'bicarbonate of soda': 'baking soda',
  'rapeseed oil': 'canola oil',
  'groundnut oil': 'peanut oil',
  'soya sauce': 'soy sauce',
}

/** Word-level swaps applied inside multi-word ingredients as well */
export const WORD_SYNONYMS: Record<string, string> = {
  scallion: 'spring onion',
  aubergine: 'eggplant',
  courgette: 'zucchini',
  chilli: 'chili',
  prawn: 'shrimp',
  cilantro: 'coriander',
}

export const DEFAULT_STAPLES: readonly string[] = ['salt', 'pepper', 'oil', 'water']

/**
 * Specific culinary variants recognized for the four core pantry staples so
 * "Black Pepper" or "Olive Oil" count as staples, while vegetables like
 * "Red Pepper" or "Coconut Water" never falsely match as staples.
 */
export const CORE_STAPLE_VARIANTS: Record<string, readonly string[]> = {
  salt: [
    'salt',
    'sea salt',
    'kosher salt',
    'table salt',
    'fine salt',
    'coarse salt',
    'flaky salt',
    'rock salt',
    'pinch of salt',
  ],
  pepper: [
    'pepper',
    'black pepper',
    'white pepper',
    'ground pepper',
    'ground black pepper',
    'cracked black pepper',
    'freshly ground pepper',
    'freshly ground black pepper',
    'peppercorn',
    'black peppercorn',
  ],
  oil: [
    'oil',
    'olive oil',
    'extra virgin olive oil',
    'vegetable oil',
    'sunflower oil',
    'canola oil',
    'cooking oil',
    'neutral oil',
    'frying oil',
  ],
  water: [
    'water',
    'boiling water',
    'hot water',
    'warm water',
    'cold water',
    'ice water',
    'tap water',
  ],
}

/**
 * Culinary false-friends where a base ingredient appears as a modifier before
 * a completely different pantry product (e.g. "rice" != "rice vinegar",
 * "butter" != "peanut butter", "egg" != "egg noodles").
 */
export const FALSE_COMPOUND_MATCHES: Record<string, readonly string[]> = {
  egg: ['egg noodle', 'egg roll', 'egg wrapper'],
  rice: [
    'rice vinegar',
    'rice wine',
    'rice noodle',
    'rice vermicelli',
    'rice paper',
    'rice flour',
    'rice syrup',
  ],
  butter: [
    'peanut butter',
    'almond butter',
    'cashew butter',
    'butter bean',
    'cocoa butter',
    'apple butter',
  ],
  milk: ['coconut milk', 'condensed milk', 'evaporated milk'],
  cream: ['cream cheese', 'ice cream', 'cream of tartar', 'creamed corn'],
  chicken: ['chicken stock', 'chicken broth', 'chicken bouillon', 'chicken cube'],
  beef: ['beef stock', 'beef broth', 'beef bouillon', 'beef cube'],
  vegetable: ['vegetable oil', 'vegetable stock', 'vegetable broth'],
  onion: ['onion powder', 'onion salt', 'onion granule'],
  garlic: ['garlic powder', 'garlic salt', 'garlic granule'],
}
