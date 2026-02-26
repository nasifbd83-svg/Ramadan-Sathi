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
  
  const fetchWithRetry = async (url: string, retries = 3): Promise<any> => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url);
        if (response.ok) return await response.json();
        if (response.status === 429) { // Rate limited
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
          continue;
        }
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  };

  try {
    // Try primary API
    const data = await fetchWithRetry(`https://api.aladhan.com/v1/timings/${timestamp}?latitude=${lat}&longitude=${lng}&method=1`);
    
    if (data && data.code === 200) {
      return data.data.timings;
    }
    throw new Error('Invalid response from prayer API');
  } catch (error) {
    console.error('Error fetching prayer times:', error);
    
    // Fallback to a secondary API or mock data if critical
    // For now, we'll try one more endpoint as a last resort
    try {
      const fallbackData = await fetchWithRetry(`https://api.aladhan.com/v1/timingsByCity?city=Dhaka&country=Bangladesh&method=1`);
      if (fallbackData && fallbackData.code === 200) {
        return fallbackData.data.timings;
      }
    } catch (fallbackError) {
      console.error('Fallback prayer fetch failed:', fallbackError);
    }
    
    throw error;
  }
}
