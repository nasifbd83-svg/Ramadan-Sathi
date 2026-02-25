/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { toHijri } from 'hijri-converter';

export const BENGALI_MONTHS = [
  'বৈশাখ', 'জ্যৈষ্ঠ', 'আষাঢ়', 'শ্রাবণ', 'ভাদ্র', 'আশ্বিন',
  'কার্তিক', 'অগ্রহায়ণ', 'পৌষ', 'মাঘ', 'ফাল্গুন', 'চৈত্র'
];

export const BENGALI_NUMBERS: Record<string, string> = {
  '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
};

export function toBengaliNumber(num: number | string): string {
  return num.toString().split('').map(d => BENGALI_NUMBERS[d] || d).join('');
}

/**
 * Simple Bengali Calendar Conversion (Approximate for UI)
 * Based on the revised Bengali Calendar used in Bangladesh.
 */
export function getBengaliDate(date: Date) {
  const day = date.getDate();
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();
  
  let bYear = year - 593;
  let bMonth = 0;
  let bDay = 0;

  // Simplified logic for the revised Bengali calendar
  // Apr 14 is Pohela Boishakh
  const pohelaBoishakh = new Date(year, 3, 14);
  
  if (date < pohelaBoishakh) {
    bYear -= 1;
    // Calculate from previous year's Pohela Boishakh
  }

  // This is a simplified approximation for the UI display
  // In a production app, a more robust library would be used.
  // For now, we'll use a mapping based on common offsets.
  const dayOfYear = Math.floor((date.getTime() - new Date(year, 0, 0).getTime()) / 86400000);
  
  // Boishakh starts on day 104 (Apr 14)
  let offset = dayOfYear - 103;
  if (offset <= 0) {
    const isLeap = (year - 1) % 4 === 0;
    offset += isLeap ? 366 : 365;
  }

  if (offset <= 31) { bMonth = 0; bDay = offset; }
  else if (offset <= 62) { bMonth = 1; bDay = offset - 31; }
  else if (offset <= 93) { bMonth = 2; bDay = offset - 62; }
  else if (offset <= 124) { bMonth = 3; bDay = offset - 93; }
  else if (offset <= 155) { bMonth = 4; bDay = offset - 124; }
  else if (offset <= 186) { bMonth = 5; bDay = offset - 155; }
  else if (offset <= 216) { bMonth = 6; bDay = offset - 186; }
  else if (offset <= 246) { bMonth = 7; bDay = offset - 216; }
  else if (offset <= 276) { bMonth = 8; bDay = offset - 246; }
  else if (offset <= 306) { bMonth = 9; bDay = offset - 276; }
  else if (offset <= 336) { bMonth = 10; bDay = offset - 306; }
  else { bMonth = 11; bDay = offset - 336; }

  return {
    day: toBengaliNumber(bDay),
    month: BENGALI_MONTHS[bMonth],
    year: toBengaliNumber(bYear)
  };
}

export function getHijriDate(date: Date) {
  const hijri = toHijri(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const months = [
    'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
    'Jumada al-Ula', 'Jumada al-Akhira', 'Rajab', 'Sha\'ban',
    'Ramadan', 'Shawwal', 'Dhu al-Qi\'dah', 'Dhu al-Hijjah'
  ];
  return {
    day: hijri.hd,
    month: months[hijri.hm - 1],
    year: hijri.hy
  };
}
