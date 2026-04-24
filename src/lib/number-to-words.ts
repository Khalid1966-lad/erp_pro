// French number-to-words converter (montant en lettres)
// Handles amounts from 0 to 999,999,999,999.99

const UNITS_1_TO_19: string[] = [
  '',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'dix-sept',
  'dix-huit',
  'dix-neuf',
];

const TENS_20_TO_60: string[] = [
  '',
  '',
  'vingt',
  'trente',
  'quarante',
  'cinquante',
  'soixante',
];

/**
 * Convert a number from 0 to 19 to French words.
 * Returns 'zéro' for 0, empty string for anything else < 1 or > 19.
 */
function convert0to19(n: number): string {
  if (n === 0) return 'zéro';
  return UNITS_1_TO_19[n];
}

/**
 * Convert a number from 0 to 99 to French words.
 *
 * French rules applied:
 * - 21, 31, 41, 51, 61: use "et un" (e.g. "vingt et un")
 * - 71: "soixante et onze"
 * - 70-79: soixante-dix, soixante-douze, …, soixante-dix-neuf
 * - 80: "quatre-vingts" (with s)
 * - 81-99: "quatre-vingt-un", …, "quatre-vingt-dix-neuf" (no s, no "et")
 */
function convert0to99(n: number): string {
  if (n <= 19) return convert0to19(n);

  // 20-69
  if (n < 70) {
    const tens = Math.floor(n / 10);
    const unit = n % 10;
    const tensWord = TENS_20_TO_60[tens];

    if (unit === 0) return tensWord;
    if (unit === 1) return `${tensWord} et un`;
    return `${tensWord}-${UNITS_1_TO_19[unit]}`;
  }

  // 70-79: soixante + (10…19)
  if (n < 80) {
    const remainder = n - 60; // 10-19
    if (remainder === 10) return 'soixante-dix';
    if (remainder === 11) return 'soixante et onze';
    return `soixante-${UNITS_1_TO_19[remainder]}`;
  }

  // Exactly 80
  if (n === 80) return 'quatre-vingts';

  // 81-89: quatre-vingt + (1…9)
  if (n < 90) {
    const unit = n - 80;
    return `quatre-vingt-${UNITS_1_TO_19[unit]}`;
  }

  // 90-99: quatre-vingt + (10…19)
  const remainder = n - 80; // 10-19
  return `quatre-vingt-${UNITS_1_TO_19[remainder]}`;
}

/**
 * Convert a number from 0 to 999 to French words.
 *
 * Rules:
 * - 100 = "cent" (not "un cent")
 * - 200 = "deux cents" (s when nothing follows)
 * - 201 = "deux cent un"  (no s when followed)
 */
function convert0to999(n: number): string {
  if (n < 100) return convert0to99(n);

  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  let result: string;

  if (hundreds === 1) {
    // "cent" not "un cent"
    result = 'cent';
  } else {
    result = `${UNITS_1_TO_19[hundreds]} cent`;
    // Plural 's' only when nothing follows
    if (rest === 0) result += 's';
  }

  if (rest > 0) {
    result += ` ${convert0to99(rest)}`;
  }

  return result;
}

/**
 * Convert a non-negative integer (up to 999 999 999 999) to French words.
 *
 * Rules:
 * - 1 000 = "mille" (not "un mille")
 * - "mille" is invariable (never takes s)
 * - 1 000 000 = "un million", 2 000 000 = "deux millions"
 * - 1 000 000 000 = "un milliard", 2 000 000 000 = "deux milliards"
 */
function convertInteger(n: number): string {
  if (n === 0) return 'zéro';

  const parts: string[] = [];

  // Milliards (10^9)
  if (n >= 1_000_000_000) {
    const milliards = Math.floor(n / 1_000_000_000);
    n %= 1_000_000_000;
    if (milliards === 1) {
      parts.push('un milliard');
    } else {
      parts.push(`${convert0to999(milliards)} milliards`);
    }
  }

  // Millions (10^6)
  if (n >= 1_000_000) {
    const millions = Math.floor(n / 1_000_000);
    n %= 1_000_000;
    if (millions === 1) {
      parts.push('un million');
    } else {
      parts.push(`${convert0to999(millions)} millions`);
    }
  }

  // Milliers (10^3)
  if (n >= 1_000) {
    const milliers = Math.floor(n / 1_000);
    n %= 1_000;
    if (milliers === 1) {
      // "mille" not "un mille"
      parts.push('mille');
    } else {
      // "mille" is invariable
      parts.push(`${convert0to999(milliers)} mille`);
    }
  }

  // Remainder (0-999)
  if (n > 0) {
    parts.push(convert0to999(n));
  }

  return parts.join(' ');
}

/**
 * Convert a number to French words (montant en lettres).
 *
 * Handles amounts from 0 to 999 999 999 999.99.
 * If the amount has a decimal part, appends " et X centimes".
 *
 * @param amount - The numeric amount to convert
 * @returns The amount written out in French words
 *
 * @example
 * numberToFrenchWords(0)                          // "zéro"
 * numberToFrenchWords(1)                          // "un"
 * numberToFrenchWords(21)                         // "vingt et un"
 * numberToFrenchWords(71)                         // "soixante et onze"
 * numberToFrenchWords(80)                         // "quatre-vingts"
 * numberToFrenchWords(81)                         // "quatre-vingt-un"
 * numberToFrenchWords(100)                        // "cent"
 * numberToFrenchWords(200)                        // "deux cents"
 * numberToFrenchWords(201)                        // "deux cent un"
 * numberToFrenchWords(1000)                       // "mille"
 * numberToFrenchWords(2000)                       // "deux mille"
 * numberToFrenchWords(1000000)                    // "un million"
 * numberToFrenchWords(2000000)                    // "deux millions"
 * numberToFrenchWords(150.50)                     // "cent cinquante et 50 centimes"
 * numberToFrenchWords(123456789.99)               // "cent vingt-trois millions quatre cent cinquante-six mille sept cent quatre-vingt-dix-neuf et 99 centimes"
 */
export function numberToFrenchWords(amount: number): string {
  // Work in cents to avoid floating-point issues
  const totalCents = Math.round(amount * 100);
  const intPart = Math.trunc(totalCents / 100);
  const decimalPart = totalCents % 100;

  let result = convertInteger(intPart);

  if (decimalPart > 0) {
    result += ` et ${decimalPart} centimes`;
  }

  return result;
}
