/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Ayah {
  number: number;
  audio: string;
  audioSecondary: string[];
  text: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean;
  translation?: string;
  transliteration?: string;
}

export async function fetchSurahs(): Promise<Surah[]> {
  const response = await fetch('https://api.alquran.cloud/v1/surah');
  const data = await response.json();
  return data.data;
}

export async function fetchSurahDetail(number: number): Promise<{ ayahs: Ayah[], surah: Surah }> {
  // Fetch Arabic text
  const arabicRes = await fetch(`https://api.alquran.cloud/v1/surah/${number}/ar.alafasy`);
  const arabicData = await arabicRes.json();
  
  // Fetch Bangla translation
  const banglaRes = await fetch(`https://api.alquran.cloud/v1/surah/${number}/bn.bengali`);
  const banglaData = await banglaRes.json();

  const ayahs = arabicData.data.ayahs.map((ayah: any, index: number) => ({
    ...ayah,
    translation: banglaData.data.ayahs[index].text,
  }));

  return { ayahs, surah: arabicData.data };
}
