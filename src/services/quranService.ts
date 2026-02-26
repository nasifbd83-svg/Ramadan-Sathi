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
  try {
    const response = await fetch('https://api.alquran.cloud/v1/surah');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching surahs:', error);
    throw error;
  }
}

export async function fetchSurahDetail(number: number): Promise<{ ayahs: Ayah[], surah: Surah }> {
  try {
    // Fetch both Arabic and Bangla editions in a single request
    const response = await fetch(`https://api.alquran.cloud/v1/surah/${number}/editions/ar.alafasy,bn.bengali`);
    
    if (!response.ok) {
      throw new Error(`Quran API failed! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code !== 200 || !data.data || data.data.length < 2) {
      throw new Error('Invalid response from Quran API');
    }

    const arabicEdition = data.data[0];
    const banglaEdition = data.data[1];

    const ayahs = arabicEdition.ayahs.map((ayah: any, index: number) => ({
      ...ayah,
      translation: banglaEdition.ayahs[index].text,
    }));

    return { ayahs, surah: arabicEdition };
  } catch (error) {
    console.error(`Error fetching surah ${number} detail:`, error);
    throw error;
  }
}
