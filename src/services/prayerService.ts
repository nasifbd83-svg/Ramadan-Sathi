/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  Imsak: string;
  Midnight: string;
}

export async function fetchPrayerTimes(lat: number, lng: number): Promise<PrayerTimes> {
  const date = new Date();
  const timestamp = Math.floor(date.getTime() / 1000);
  
  // Method 1: University of Islamic Sciences, Karachi
  const response = await fetch(`https://api.aladhan.com/v1/timings/${timestamp}?latitude=${lat}&longitude=${lng}&method=1`);
  const data = await response.json();
  
  if (data.code === 200) {
    return data.data.timings;
  }
  throw new Error('Failed to fetch prayer times');
}
