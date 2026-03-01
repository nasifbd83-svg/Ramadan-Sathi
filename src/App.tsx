/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Moon, Sun, Clock, BookOpen, Fingerprint, Settings, 
  ChevronRight, RefreshCw, MapPin, Timer, Heart, 
  Calendar, Calculator, Info, Play, Pause, SkipBack, 
  SkipForward, Bookmark, Share2, Mail, Star, MessageSquare,
  Bell, ListChecks, FileText, Search, Volume2, VolumeX,
  RotateCcw, Target, Music
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, addDays, differenceInSeconds } from 'date-fns';
import { Howl } from 'howler';

import { getBengaliDate, getHijriDate, toBengaliNumber } from './utils/calendar';
import { fetchPrayerTimes, type PrayerTimes } from './services/prayerService';
import { fetchSurahs, fetchSurahDetail, type Surah, type Ayah } from './services/quranService';
import { BD_DISTRICTS, getDistrictFromCoords } from './services/locationService';
import { 
  ESSENTIAL_DUAS, ESSENTIAL_SURAHS, DAILY_HADITH, 
  DAILY_ESSENTIAL_DUAS, KALIMAS, IMPORTANT_AMALS, ALLAH_NAMES,
  RAMADAN_TIMETABLE, type Dua, type AllahName, type RamadanDay 
} from './constants/content';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatTime12h(timeStr: string) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  let h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${toBengaliNumber(h.toString().padStart(2, '0'))}:${toBengaliNumber(minutes)} ${ampm === 'AM' ? 'AM' : 'PM'}`;
}

// --- Components ---

const GlassCard = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn(
      "glass rounded-3xl overflow-hidden shadow-xl transition-all duration-300",
      onClick && "active:scale-95 cursor-pointer",
      className
    )}
  >
    {children}
  </div>
);

const Button = ({ children, className, onClick, variant = 'primary' }: { children: React.ReactNode; className?: string; onClick?: () => void; variant?: 'primary' | 'gold' | 'outline' }) => (
  <button 
    onClick={onClick}
    className={cn(
      "px-6 py-3 rounded-2xl font-bold transition-all duration-300 active:scale-95 flex items-center justify-center space-x-2",
      variant === 'primary' && "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20",
      variant === 'gold' && "bg-gold-500 hover:bg-gold-400 text-emerald-950 shadow-lg shadow-gold-500/20",
      variant === 'outline' && "border border-white/20 hover:bg-white/5 text-white",
      className
    )}
  >
    {children}
  </button>
);

// --- Main App ---

type Screen = 'home' | 'quran' | 'duas' | 'tools' | 'tracker' | 'profile' | 'surah-detail' | 'tasbeeh' | 'allah-names';

export default function App() {
  const [isSplash, setIsSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<Screen>('home');
  const [prevTab, setPrevTab] = useState<Screen>('home');

  const navigateToTab = (tab: Screen, subState?: any) => {
    if (tab === activeTab && !subState) return;
    setPrevTab(activeTab);
    setActiveTab(tab);
    if (tab !== 'duas') setActiveDuaCategory(null);
    window.history.pushState({ tab, ...subState }, '', `#${tab}${subState?.category ? '-' + subState.category : ''}`);
  };

  const openDuaCategory = (categoryId: string) => {
    setActiveDuaCategory(categoryId);
    window.history.pushState({ tab: 'duas', category: categoryId }, '', `#duas-${categoryId}`);
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
        if (event.state.tab === 'duas') {
          setActiveDuaCategory(event.state.category || null);
        } else {
          setActiveDuaCategory(null);
        }
      } else {
        const hash = window.location.hash.replace('#', '') as string;
        const validTabs: Screen[] = ['home', 'quran', 'duas', 'tools', 'tracker', 'profile', 'surah-detail', 'tasbeeh', 'allah-names'];
        
        if (hash.startsWith('duas-')) {
          const catId = hash.replace('duas-', '');
          setActiveTab('duas');
          setActiveDuaCategory(catId);
        } else if (validTabs.includes(hash as Screen)) {
          setActiveTab(hash as Screen);
          setActiveDuaCategory(null);
        } else {
          setActiveTab('home');
          setActiveDuaCategory(null);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Initial state setup
    const hash = window.location.hash.replace('#', '') as string;
    const validTabs: Screen[] = ['home', 'quran', 'duas', 'tools', 'tracker', 'profile', 'surah-detail', 'tasbeeh', 'allah-names'];
    
    if (hash.startsWith('duas-')) {
      const catId = hash.replace('duas-', '');
      setActiveTab('duas');
      setActiveDuaCategory(catId);
      window.history.replaceState({ tab: 'duas', category: catId }, '', `#duas-${catId}`);
    } else if (validTabs.includes(hash as Screen)) {
      setActiveTab(hash as Screen);
      window.history.replaceState({ tab: hash }, '', `#${hash}`);
    } else {
      window.history.replaceState({ tab: 'home' }, '', '#home');
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [district, setDistrict] = useState<string>(() => localStorage.getItem('district') || 'Dhaka');
  const [loading, setLoading] = useState(true);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [selectedDua, setSelectedDua] = useState<Dua | null>(null);
  const [zakatData, setZakatData] = useState({ gold: '', cash: '', business: '' });
  const [zakatResult, setZakatResult] = useState<number | null>(null);
  const [showZakatCalc, setShowZakatCalc] = useState(false);
  const [showRamadanCalendar, setShowRamadanCalendar] = useState(false);
  const [showDownloadGuide, setShowDownloadGuide] = useState(false);
  const [countdown, setCountdown] = useState('০০:০০:০০');
  const [countdownLabel, setCountdownLabel] = useState('সেহরি শেষ হতে বাকি');
  const [currentRoza, setCurrentRoza] = useState<RamadanDay | null>(null);
  const [nextPrayer, setNextPrayer] = useState<{name: string, time: Date} | null>(null);
  const [tasbeehTarget, setTasbeehTarget] = useState<number>(33);
  const [activeDuaCategory, setActiveDuaCategory] = useState<string | null>(null);

  const calculateZakat = () => {
    const total = (parseFloat(zakatData.gold) || 0) + (parseFloat(zakatData.cash) || 0) + (parseFloat(zakatData.business) || 0);
    setZakatResult(total * 0.025);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const todayStr = format(now, 'dd MMM yyyy');
      const todayRoza = RAMADAN_TIMETABLE.find(d => d.date === todayStr);
      
      if (!todayRoza) {
        // Check if Ramadan has started or ended
        const firstDay = new Date(RAMADAN_TIMETABLE[0].date);
        const lastDay = new Date(RAMADAN_TIMETABLE[RAMADAN_TIMETABLE.length - 1].date);
        
        if (now < firstDay) {
          setCountdownLabel('রমজান শুরু হতে বাকি');
          const diff = differenceInSeconds(firstDay, now);
          updateCountdown(diff);
        } else if (now > lastDay) {
          setCountdownLabel('রমজান সমাপ্ত হয়েছে 🌙');
          setCountdown('০০:০০:০০');
        }
        setCurrentRoza(null);
        return;
      }

      setCurrentRoza(todayRoza);
      
      const sehriTime = new Date(`${todayRoza.date} ${todayRoza.sehri}`);
      const iftarTime = new Date(`${todayRoza.date} ${todayRoza.iftar}`);
      
      if (now < sehriTime) {
        setCountdownLabel('সেহরি শেষ হতে বাকি');
        const diff = differenceInSeconds(sehriTime, now);
        updateCountdown(diff);
      } else if (now < iftarTime) {
        setCountdownLabel('ইফতার পর্যন্ত বাকি');
        const diff = differenceInSeconds(iftarTime, now);
        updateCountdown(diff);
      } else {
        // After Iftar, show tomorrow's Sehri
        const tomorrow = addDays(now, 1);
        const tomorrowStr = format(tomorrow, 'dd MMM yyyy');
        const tomorrowRoza = RAMADAN_TIMETABLE.find(d => d.date === tomorrowStr);
        
        if (tomorrowRoza) {
          setCountdownLabel('আগামীকালের সেহরি বাকি');
          const nextSehri = new Date(`${tomorrowRoza.date} ${tomorrowRoza.sehri}`);
          const diff = differenceInSeconds(nextSehri, now);
          updateCountdown(diff);
        } else {
          setCountdownLabel('রমজান সমাপ্ত হয়েছে 🌙');
          setCountdown('০০:০০:০০');
        }
      }
    }, 1000);

    const updateCountdown = (diff: number) => {
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setCountdown(`${toBengaliNumber(h.toString().padStart(2, '0'))}:${toBengaliNumber(m.toString().padStart(2, '0'))}:${toBengaliNumber(s.toString().padStart(2, '0'))}`);
    };
    
    return () => clearInterval(interval);
  }, []);

  const [surahDetail, setSurahDetail] = useState<{ ayahs: Ayah[], surah: Surah } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [audioPlayer, setAudioPlayer] = useState<Howl | null>(null);
  const [tasbeehCount, setTasbeehCount] = useState(() => parseInt(localStorage.getItem('tasbeehCount') || '0', 10));
  const [isDarkMode, setIsDarkMode] = useState(true);

  // --- Initialization ---

  useEffect(() => {
    const timer = setTimeout(() => setIsSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetchSurahs()
      .then(setSurahs)
      .catch(err => {
        console.error('Initial surah fetch failed, using fallback:', err);
        // Fallback with some common surahs if API fails
        setSurahs([
          { number: 1, name: "سُورَةُ ٱلْفَاتِحَةِ", englishName: "Al-Faatiha", englishNameTranslation: "The Opening", numberOfAyahs: 7, revelationType: "Meccan" },
          { number: 36, name: "سُورَةُ يسٓ", englishName: "Ya-Seen", englishNameTranslation: "Ya Seen", numberOfAyahs: 83, revelationType: "Meccan" },
          { number: 67, name: "سُورَةُ ٱلْمُلْكِ", englishName: "Al-Mulk", englishNameTranslation: "The Sovereignty", numberOfAyahs: 30, revelationType: "Meccan" },
          { number: 112, name: "سُورَةُ ٱلْإِخْلَاصِ", englishName: "Al-Ikhlaas", englishNameTranslation: "Sincerity", numberOfAyahs: 4, revelationType: "Meccan" },
          { number: 113, name: "سُورَةُ ٱلْفَلَقِ", englishName: "Al-Falaq", englishNameTranslation: "The Daybreak", numberOfAyahs: 5, revelationType: "Meccan" },
          { number: 114, name: "سُورَةُ ٱلنَّاسِ", englishName: "An-Naas", englishNameTranslation: "Mankind", numberOfAyahs: 6, revelationType: "Meccan" }
        ]);
      });
    refreshPrayerTimes();
  }, [district]);

  const refreshPrayerTimes = async () => {
    setLoading(true);
    try {
      // In a real app, we'd use a district-to-coords mapping
      // For now, we'll use Dhaka coords or mock based on district
      const res = await fetchPrayerTimes(23.8103, 90.4125);
      setPrayerTimes(res);
    } catch (e) {
      console.error('Prayer fetch failed, using mock fallback:', e);
      // Mock fallback for Dhaka
      setPrayerTimes({
        Fajr: '05:12',
        Sunrise: '06:28',
        Dhuhr: '12:10',
        Asr: '15:30',
        Maghrib: '18:02',
        Isha: '19:15',
        Imsak: '05:02',
        Midnight: '00:10'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLocationDetection = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const detected = await getDistrictFromCoords(pos.coords.latitude, pos.coords.longitude);
        setDistrict(detected);
        localStorage.setItem('district', detected);
      });
    }
  };

  // --- Quran Audio Logic ---

  const playSurah = (detail: { ayahs: Ayah[] }) => {
    if (audioPlayer) {
      audioPlayer.stop();
      audioPlayer.unload();
    }
    
    const playNext = (index: number) => {
      if (index >= detail.ayahs.length) {
        setIsPlaying(false);
        setCurrentAyahIndex(0);
        return;
      }
      
      setCurrentAyahIndex(index);
      const sound = new Howl({
        src: [detail.ayahs[index].audio],
        html5: true,
        onend: () => playNext(index + 1),
        onplay: () => setIsPlaying(true),
        onpause: () => setIsPlaying(false),
        onstop: () => setIsPlaying(false)
      });
      setAudioPlayer(sound);
      sound.play();
    };

    playNext(0);
  };

  const toggleAudio = () => {
    if (audioPlayer) {
      if (isPlaying) audioPlayer.pause();
      else audioPlayer.play();
    } else if (surahDetail) {
      playSurah(surahDetail);
    }
  };

  // --- Renderers ---

  const renderSplashScreen = () => (
    <motion.div 
      className="fixed inset-0 z-[100] bg-[#020D0A] flex flex-col items-center justify-center"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="relative"
      >
        <div className="w-32 h-32 bg-emerald-600 rounded-full blur-3xl opacity-20 absolute inset-0 animate-pulse" />
        <Moon size={80} className="text-gold-500 relative z-10" />
      </motion.div>
      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-4xl font-bold text-white tracking-widest font-bangla"
      >
        রমজান সাথী
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-4 text-emerald-400/60 uppercase tracking-[0.4em] text-xs font-bold"
      >
        Premium Islamic Companion
      </motion.p>
    </motion.div>
  );

  const renderHome = () => {
    const now = new Date();
    const bDate = getBengaliDate(now);

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 pb-24"
      >
        {/* Header Section */}
        <div className="relative pt-12 px-6">
          <div className="flex items-start justify-between mb-8">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold text-white font-bangla">আসসালামু আলাইকুম</h2>
              <p className="text-emerald-400 font-medium">রাজশাহী বিভাগ, বাংলাদেশ</p>
            </div>
            <div className="flex flex-col items-end space-y-3">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="w-10 h-10 rounded-xl glass flex items-center justify-center text-gold-500"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <div className="flex items-center space-x-1 px-3 py-1.5 rounded-lg glass text-[10px] font-bold text-emerald-400 border-emerald-500/30">
                <MapPin size={12} />
                <span>রাজশাহী</span>
              </div>
            </div>
          </div>

          <GlassCard className="p-6 bg-gradient-to-br from-emerald-900/60 to-emerald-800/20 border-emerald-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Moon size={120} className="text-gold-500" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-white/10 relative z-10">
              <div className="text-left">
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">আজকের তারিখ</p>
                <p className="text-sm font-bold">{bDate.day} {bDate.month}, {toBengaliNumber(format(now, 'yyyy'))}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">আজ রোজা</p>
                <p className="text-sm font-bold text-gold-500">{currentRoza ? toBengaliNumber(currentRoza.roza.toString()) : '---'}</p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center space-y-4 relative z-10">
              <div className="text-center">
                <motion.p 
                  key={countdownLabel}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2"
                >
                  {countdownLabel}
                </motion.p>
                <motion.p 
                  className="text-5xl font-black text-white tracking-tighter gold-glow-text animate-pulse-slow"
                  style={{ textShadow: '0 0 20px rgba(245, 158, 11, 0.3)' }}
                >
                  {countdown}
                </motion.p>
              </div>
              
              <div className="flex items-center space-x-8 pt-4">
                <div className="text-center">
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">সেহরি শেষ</p>
                  <p className="text-sm font-mono font-bold text-gold-500">{currentRoza ? toBengaliNumber(currentRoza.sehri.replace(' AM', '')) : '--:--'}</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">ইফতার শুরু</p>
                  <p className="text-sm font-mono font-bold text-emerald-400">{currentRoza ? toBengaliNumber(currentRoza.iftar.replace(' PM', '')) : '--:--'}</p>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Daily Hadith */}
        <div className="px-6">
          <GlassCard className="p-6 bg-gradient-to-br from-emerald-900/40 to-emerald-800/20 border-gold-500/10">
            <div className="flex items-center space-x-2 mb-3">
              <MessageSquare size={16} className="text-gold-500" />
              <span className="text-[10px] text-gold-500 font-bold uppercase tracking-widest">আজকের হাদিস</span>
            </div>
            <p className="text-sm text-white/90 leading-relaxed font-medium">
              “{DAILY_HADITH[0].text}”
            </p>
            <p className="text-[10px] text-white/40 mt-3 text-right">— {DAILY_HADITH[0].source}</p>
          </GlassCard>
        </div>

        {/* Quick Links */}
        <div className="px-6 grid grid-cols-2 gap-4">
          <GlassCard 
            className="p-4 flex flex-col items-center space-y-2 bg-white/5 border-white/10"
            onClick={() => navigateToTab('quran')}
          >
            <BookOpen size={24} className="text-emerald-400" />
            <span className="text-sm font-bold">আল কুরআন</span>
          </GlassCard>
          <GlassCard 
            className="p-4 flex flex-col items-center space-y-2 bg-white/5 border-white/10"
            onClick={() => navigateToTab('duas')}
          >
            <Heart size={24} className="text-gold-500" />
            <span className="text-sm font-bold">দোয়া ও সুরা</span>
          </GlassCard>
        </div>

        {/* Prayer Times */}
        <div className="px-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold font-bangla">নামাজের সময়সূচী</h3>
            <RefreshCw size={16} className="text-white/20 cursor-pointer" onClick={refreshPrayerTimes} />
          </div>
          <div className="grid grid-cols-1 gap-3">
            {loading ? (
              <div className="py-12 text-center text-white/20 animate-pulse">লোড হচ্ছে...</div>
            ) : prayerTimes && (
              ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map((p) => (
                <div key={p} className={cn(
                  "flex items-center justify-between p-4 rounded-2xl glass transition-all",
                  p === 'Maghrib' && "bg-emerald-500/20 border-emerald-500/50 emerald-glow"
                )}>
                  <div className="flex items-center space-x-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      p === 'Maghrib' ? "bg-emerald-500 text-white" : "bg-white/10 text-white/60"
                    )}>
                      {p === 'Fajr' || p === 'Isha' || p === 'Maghrib' ? <Moon size={18} /> : <Sun size={18} />}
                    </div>
                    <span className="font-bold text-white/80">
                      {p === 'Fajr' ? 'ফজর (সেহরি শেষ)' : p === 'Sunrise' ? 'সূর্যোদয়' : p === 'Dhuhr' ? 'যোহর' : p === 'Asr' ? 'আসর' : p === 'Maghrib' ? 'মাগরিব (ইফতার)' : 'এশা'}
                    </span>
                  </div>
                  <span className="font-mono text-lg font-bold text-gold-500">{formatTime12h((prayerTimes as any)[p])}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderDuas = () => {
    const categories = [
      { id: 'daily', title: 'প্রয়োজনীয় দোয়া', icon: <Heart size={24} />, color: 'emerald', data: DAILY_ESSENTIAL_DUAS },
      { id: 'kalima', title: 'কালিমা সমূহ', icon: <Fingerprint size={24} />, color: 'gold', data: KALIMAS },
      { id: 'allah', title: 'আল্লাহর নাম', icon: <Star size={24} />, color: 'amber', action: () => navigateToTab('allah-names') },
      { id: 'amal', title: 'গুরুত্বপূর্ণ আমল', icon: <ListChecks size={24} />, color: 'emerald', data: IMPORTANT_AMALS },
      { id: 'others', title: 'অন্যান্য', icon: <BookOpen size={24} />, color: 'amber', data: [...ESSENTIAL_DUAS, ...ESSENTIAL_SURAHS] },
    ];

    if (activeDuaCategory) {
      const category = categories.find(c => c.id === activeDuaCategory);
      return (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="px-6 pt-12 pb-24 space-y-6"
        >
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => window.history.back()}
              className="p-2 glass rounded-xl text-white/60"
            >
              <SkipBack size={20} />
            </button>
            <h2 className="text-2xl font-bold font-bangla">{category?.title}</h2>
          </div>

          <div className="space-y-3">
            {category?.data?.map((dua: any) => (
              <div 
                key={dua.id}
                className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all cursor-pointer"
                onClick={() => setSelectedDua(dua)}
              >
                <div className="flex items-center space-x-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    category.color === 'emerald' ? "bg-emerald-500/20 text-emerald-400" : 
                    category.color === 'gold' ? "bg-gold-500/20 text-gold-500" : "bg-amber-500/20 text-amber-400"
                  )}>
                    {category.icon}
                  </div>
                  <span className="text-white font-semibold">{dua.title}</span>
                </div>
                <ChevronRight className="text-white/20" size={20} />
              </div>
            ))}
          </div>

          {/* Reuse the Modal from below */}
          {renderDuaModal()}
        </motion.div>
      );
    }

    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="px-6 pt-12 pb-24 space-y-8"
      >
        <div className="space-y-1">
          <h2 className="text-3xl font-bold font-bangla">সুরা ও দোয়া</h2>
          <p className="text-emerald-400 font-medium">প্রয়োজনীয় দোয়া এবং সূরাসমূহ</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => cat.action ? cat.action() : openDuaCategory(cat.id)}
              className={cn(
                "w-full flex items-center justify-between p-6 rounded-[2rem] transition-all active:scale-95 group relative overflow-hidden",
                cat.id === 'allah' 
                  ? "bg-gradient-to-r from-gold-600/20 to-amber-600/10 border border-gold-500/30 gold-glow" 
                  : "bg-white/5 border border-white/10 hover:bg-white/10"
              )}
            >
              <div className="flex items-center space-x-5">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110",
                  cat.color === 'emerald' ? "bg-emerald-500/20 text-emerald-400" : 
                  cat.color === 'gold' ? "bg-gold-500 text-emerald-950" : "bg-amber-500/20 text-amber-400"
                )}>
                  {cat.icon}
                </div>
                <div className="text-left">
                  <span className="text-white text-lg font-bold block">{cat.title}</span>
                  <span className="text-white/40 text-xs font-medium uppercase tracking-wider">
                    {cat.id === 'daily' ? 'Daily Essentials' : 
                     cat.id === 'kalima' ? 'Five Kalimas' : 
                     cat.id === 'allah' ? '99 Names' : 
                     cat.id === 'amal' ? 'Important Deeds' : 'Others'}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/20 group-hover:text-white/60 transition-colors">
                <ChevronRight size={20} />
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    );
  };

  const renderDuaModal = () => (
    <AnimatePresence>
      {selectedDua && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedDua(null)}
        >
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="w-full max-w-lg bg-emerald-950 border border-white/10 rounded-t-[40px] p-8 space-y-8 overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto" />
            
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-white">{selectedDua.title}</h2>
              <div className="h-px w-24 bg-emerald-500/30 mx-auto" />
            </div>

            <div className="space-y-6">
              <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                <p className="text-3xl text-center leading-loose text-white font-arabic dir-rtl" style={{ fontFamily: 'Amiri, serif' }}>
                  {selectedDua.arabic}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-2">উচ্চারণ</p>
                  <p className="text-white/80 leading-relaxed italic">{selectedDua.transliteration}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-2">অর্থ</p>
                  <p className="text-white/90 leading-relaxed font-medium">{selectedDua.meaning}</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setSelectedDua(null)}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all"
            >
              বন্ধ করুন
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderQuran = () => (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="px-6 pt-12 pb-24 space-y-6"
    >
      <div className="space-y-1">
        <h2 className="text-3xl font-bold font-bangla">আল-কুরআন</h2>
        <p className="text-emerald-400 font-medium">১১৪টি সূরার তালিকা</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
        <input 
          type="text" 
          placeholder="সূরা খুঁজুন..." 
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-emerald-500/50 transition-all"
        />
      </div>

      <div className="space-y-3">
        {surahs.map(s => (
          <GlassCard 
            key={s.number} 
            className="p-4 flex items-center justify-between hover:bg-white/10"
            onClick={async () => {
              setSelectedSurah(s);
              setLoading(true);
              try {
                const detail = await fetchSurahDetail(s.number);
                setSurahDetail(detail);
                navigateToTab('surah-detail');
              } catch (err) {
                console.error('Failed to load surah detail:', err);
                alert('সূরা লোড করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
              } finally {
                setLoading(false);
              }
            }}
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-gold-500 font-bold">
                {toBengaliNumber(s.number)}
              </div>
              <div>
                <h4 className="font-bold text-white">{s.englishName}</h4>
                <p className="text-xs text-white/40">{s.numberOfAyahs} আয়াত • {s.revelationType === 'Meccan' ? 'মাক্কী' : 'মাদানী'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-arabic text-emerald-400">{s.name}</p>
            </div>
          </GlassCard>
        ))}
      </div>
    </motion.div>
  );

  const renderSurahDetail = () => {
    if (!surahDetail) return null;
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pb-32"
      >
        <div className="sticky top-0 z-30 glass p-6 flex items-center justify-between">
          <button onClick={() => window.history.back()} className="p-2 hover:bg-white/10 rounded-xl">
            <SkipBack size={24} />
          </button>
          <div className="text-center">
            <h3 className="text-xl font-bold">{surahDetail.surah.englishName}</h3>
            <p className="text-xs text-emerald-400">{surahDetail.surah.name}</p>
          </div>
          <button className="p-2 hover:bg-white/10 rounded-xl">
            <Bookmark size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {surahDetail.ayahs.map((ayah, idx) => (
            <div 
              key={ayah.number} 
              className={cn(
                "space-y-6 p-6 rounded-3xl transition-all duration-500",
                currentAyahIndex === idx && isPlaying ? "bg-emerald-500/10 border border-emerald-500/30 gold-glow" : "border border-transparent"
              )}
            >
              <div className="flex justify-end">
                <p className="text-3xl font-arabic leading-[2.5] text-right dir-rtl">
                  {ayah.text}
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-gold-500/50 text-xs text-gold-500 ml-4 font-mono">
                    {ayah.numberInSurah}
                  </span>
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-emerald-400 italic">{ayah.translation}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Audio Player Bar */}
        <div className="fixed bottom-24 left-4 right-4 z-40">
          <GlassCard className="p-4 bg-emerald-950/90 border-emerald-500/30 emerald-glow">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={toggleAudio}
                  className="w-12 h-12 rounded-full bg-gold-500 flex items-center justify-center text-emerald-950 shadow-lg shadow-gold-500/20 active:scale-90 transition-all"
                >
                  {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                </button>
                <div>
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Al-Quran Player</p>
                  <p className="text-sm font-bold text-white">আয়াত {toBengaliNumber((currentAyahIndex + 1).toString())}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => {
                    if (audioPlayer) {
                      audioPlayer.stop();
                      audioPlayer.unload();
                      setAudioPlayer(null);
                      setIsPlaying(false);
                      setCurrentAyahIndex(0);
                    }
                  }}
                  className="p-2 hover:bg-white/10 rounded-xl text-white/40"
                >
                  <RefreshCw size={20} />
                </button>
                <Share2 size={20} className="text-white/40" />
              </div>
            </div>
          </GlassCard>
        </div>
      </motion.div>
    );
  };

  const renderProfile = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="pb-24"
    >
      <div className="sticky top-0 z-30 glass p-6 flex items-center justify-between">
        <button onClick={() => window.history.back()} className="p-2 hover:bg-white/10 rounded-xl">
          <SkipBack size={24} />
        </button>
        <h3 className="text-xl font-bold">ডেভেলপার প্রোফাইল</h3>
        <div className="w-10" />
      </div>

      <div className="px-6 pt-8 space-y-8">
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <div className="w-36 h-36 rounded-full border-4 border-gold-500/30 p-1.5 bg-gradient-to-tr from-gold-500/20 to-transparent shadow-2xl">
              <img 
                src="https://i.ibb.co.com/QvCwgpWy/IMG-20260225-130127.webp" 
                alt="মোঃ নাসিফ ইকবাল" 
                className="w-full h-full rounded-full object-cover border border-gold-500/10"
              />
            </div>
            <div className="absolute bottom-2 right-2 w-8 h-8 bg-emerald-500 rounded-full border-4 border-[#020D0A] flex items-center justify-center shadow-lg">
              <Star size={14} className="text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold">মোঃ নাসিফ ইকবাল</h2>
            <p className="text-emerald-400 font-medium">App Developer & Tech Enthusiast</p>
          </div>
        </div>

        <GlassCard className="p-6 bg-gradient-to-br from-emerald-900/40 to-emerald-800/20 border-gold-500/20">
          <p className="text-center italic text-white/80 leading-relaxed">
            “প্রযুক্তির মাধ্যমে উপকার পৌঁছে দেওয়াই আমার লক্ষ্য। আল্লাহ আমাদের আমল কবুল করুন।”
          </p>
          <div className="mt-6 flex justify-center space-x-4">
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase font-bold">দেশ</p>
              <p className="font-bold">বাংলাদেশ</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase font-bold">ভার্সন</p>
              <p className="font-bold">১.০.০</p>
            </div>
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 gap-3">
          <Button 
            variant="outline" 
            className="justify-between"
            onClick={() => window.open('https://www.facebook.com/Nasif20k?mibextid=ZbWKwL', '_blank')}
          >
            <div className="flex items-center space-x-3">
              <Mail size={20} className="text-emerald-400" />
              <span>যোগাযোগ করুন</span>
            </div>
            <ChevronRight size={18} className="text-white/20" />
          </Button>
          <Button 
            variant="outline" 
            className="justify-between"
            onClick={() => window.open('https://m.me/Nasif20k', '_blank')}
          >
            <div className="flex items-center space-x-3">
              <MessageSquare size={20} className="text-emerald-400" />
              <span>মতামত দিন</span>
            </div>
            <ChevronRight size={18} className="text-white/20" />
          </Button>
          <Button 
            variant="outline" 
            className="justify-between"
            onClick={async () => {
              const shareData = {
                title: 'রমজান সাথী',
                text: 'রমজান সাথী - আপনার ইবাদতের ডিজিটাল সঙ্গী।',
                url: 'https://ramadansathi.netlify.app',
              };
              try {
                if (navigator.share) {
                  await navigator.share(shareData);
                } else {
                  await navigator.clipboard.writeText(shareData.url);
                  alert('লিঙ্কটি কপি করা হয়েছে!');
                }
              } catch (err) {
                console.error('Error sharing:', err);
              }
            }}
          >
            <div className="flex items-center space-x-3">
              <Share2 size={20} className="text-emerald-400" />
              <span>শেয়ার করুন</span>
            </div>
            <ChevronRight size={18} className="text-white/20" />
          </Button>
        </div>
      </div>
    </motion.div>
  );

  const renderTools = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-6 pt-12 pb-24 space-y-6"
    >
      <div className="space-y-1">
        <h2 className="text-3xl font-bold font-bangla">ইসলামিক টুলস</h2>
        <p className="text-emerald-400 font-medium">প্রয়োজনীয় সব ফিচার এক জায়গায়</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <GlassCard 
          className="p-6 flex flex-col items-center space-y-4 text-center bg-emerald-900/20 border-gold-500/20"
          onClick={() => setShowZakatCalc(true)}
        >
          <div className="w-16 h-16 rounded-2xl bg-gold-500/20 flex items-center justify-center text-gold-500">
            <Calculator size={32} />
          </div>
          <h4 className="font-bold">যাকাত ক্যালকুলেটর</h4>
        </GlassCard>
        <GlassCard 
          className="p-6 flex flex-col items-center space-y-4 text-center bg-emerald-900/20 border-gold-500/20"
          onClick={() => setShowRamadanCalendar(true)}
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Calendar size={32} />
          </div>
          <h4 className="font-bold">রমজান ক্যালেন্ডার</h4>
        </GlassCard>
        <GlassCard 
          className="p-6 flex flex-col items-center space-y-4 text-center bg-emerald-900/20 border-gold-500/20 col-span-2"
          onClick={() => navigateToTab('profile')}
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400">
            <Info size={32} />
          </div>
          <h4 className="font-bold">ডেভেলপার প্রোফাইল</h4>
        </GlassCard>
      </div>

      {/* App Download Section */}
      <div className="pt-8 space-y-6 flex flex-col items-center">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold font-bangla">অ্যাপ ডাউনলোড</h3>
          <div className="h-1 w-12 bg-gold-500/30 mx-auto rounded-full" />
        </div>

        <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
          <button 
            onClick={() => {
              setShowDownloadGuide(true);
              window.open('https://drive.google.com/uc?export=download&id=14OwJ2YjXl8Btr5Cx_Weo4ebUlYQ3TyQe', '_blank');
              setTimeout(() => setShowDownloadGuide(false), 8000);
            }}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 border border-gold-500/30 text-white font-bold shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:scale-[1.02] active:scale-95 transition-all duration-300 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gold-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative z-10 text-lg">📥 অ্যাপ ডাউনলোড করুন</span>
          </button>
          
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Android APK - Direct Download</p>
          
          <div className="flex items-center space-x-4 text-[10px] text-white/40 font-bold">
            <span className="flex items-center"><span className="text-emerald-500 mr-1">✔</span> Safe Download</span>
            <span className="flex items-center"><span className="text-emerald-500 mr-1">✔</span> Free App</span>
            <span className="flex items-center"><span className="text-emerald-500 mr-1">✔</span> No Ads</span>
          </div>
        </div>
      </div>

      {/* Zakat Calculator Section */}
      <AnimatePresence>
        {showZakatCalc && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 mt-8 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold font-bangla">যাকাত ক্যালকুলেটর</h3>
              <button onClick={() => setShowZakatCalc(false)} className="text-xs text-white/40">বন্ধ করুন</button>
            </div>
            <GlassCard className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-white/40 font-bold uppercase">স্বর্ণের মূল্য (টাকায়)</label>
                <input 
                  type="number" 
                  value={zakatData.gold}
                  onChange={(e) => setZakatData({ ...zakatData, gold: e.target.value })}
                  placeholder="০.০০"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-gold-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/40 font-bold uppercase">নগদ টাকা</label>
                <input 
                  type="number" 
                  value={zakatData.cash}
                  onChange={(e) => setZakatData({ ...zakatData, cash: e.target.value })}
                  placeholder="০.০০"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-gold-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/40 font-bold uppercase">ব্যবসায়িক সম্পদ</label>
                <input 
                  type="number" 
                  value={zakatData.business}
                  onChange={(e) => setZakatData({ ...zakatData, business: e.target.value })}
                  placeholder="০.০০"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-gold-500/50"
                />
              </div>
              <Button variant="gold" className="w-full" onClick={calculateZakat}>হিসাব করুন</Button>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ramadan Calendar Section */}
      <AnimatePresence>
        {showRamadanCalendar && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 mt-8 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold font-bangla">রমজান ক্যালেন্ডার ২০২৬ (রাজশাহী)</h3>
              <button onClick={() => setShowRamadanCalendar(false)} className="text-xs text-white/40">বন্ধ করুন</button>
            </div>
            <GlassCard className="overflow-hidden">
              <div className="max-h-[400px] overflow-y-auto scroll-smooth custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-emerald-950">
                    <tr className="bg-white/5 text-[10px] uppercase tracking-wider text-emerald-400">
                      <th className="p-4">রমজান</th>
                      <th className="p-4">তারিখ</th>
                      <th className="p-4">সেহরি</th>
                      <th className="p-4">ইফতার</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {RAMADAN_TIMETABLE.map((day, i) => {
                      const isToday = day.date === format(new Date(), 'dd MMM yyyy');
                      return (
                        <tr 
                          key={i} 
                          id={isToday ? 'today-row' : undefined}
                          className={cn(
                            "border-t border-white/5 transition-colors",
                            isToday ? "bg-emerald-500/20 border-l-4 border-l-gold-500" : "hover:bg-white/5"
                          )}
                        >
                          <td className="p-4 font-bold">{toBengaliNumber(day.roza.toString())}</td>
                          <td className="p-4 text-white/60">{toBengaliNumber(day.date.split(' ')[0])} {day.date.split(' ')[1]}</td>
                          <td className="p-4 text-gold-500 font-mono">{toBengaliNumber(day.sehri.replace(' AM', ''))}</td>
                          <td className="p-4 text-emerald-400 font-mono">{toBengaliNumber(day.iftar.replace(' PM', ''))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
            <script dangerouslySetInnerHTML={{
              __html: `
                setTimeout(() => {
                  const todayRow = document.getElementById('today-row');
                  if (todayRow) {
                    todayRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 500);
              `
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zakat Modal */}
      <AnimatePresence>
        {activeTab === 'tools' && zakatResult !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
            onClick={() => setZakatResult(null)}
          >
            <GlassCard className="w-full max-w-sm p-8 text-center space-y-6 bg-emerald-950 border-gold-500/30">
              <div className="w-20 h-20 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-500 mx-auto">
                <Calculator size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">আপনার যাকাতের পরিমাণ</h3>
                <p className="text-4xl font-black text-gold-500">৳ {toBengaliNumber(zakatResult.toFixed(2))}</p>
              </div>
              <Button variant="gold" className="w-full" onClick={() => setZakatResult(null)}>ঠিক আছে</Button>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Download Guide Modal */}
      <AnimatePresence>
        {showDownloadGuide && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
            onClick={() => setShowDownloadGuide(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm glass bg-emerald-950/90 border border-gold-500/30 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4">
                <button 
                  onClick={() => setShowDownloadGuide(false)}
                  className="p-2 hover:bg-white/10 rounded-full text-white/40 transition-colors"
                >
                  <RefreshCw size={20} className="rotate-45" />
                </button>
              </div>

              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-gold-500/20 rounded-2xl flex items-center justify-center text-gold-500 mx-auto mb-4">
                  <BookOpen size={32} />
                </div>
                <h3 className="text-2xl font-bold text-white font-bangla">অ্যাপ ইন্সটল করার নিয়ম</h3>
                <div className="h-0.5 w-12 bg-gold-500/30 mx-auto" />
              </div>

              <div className="space-y-4">
                {[
                  "Download complete হলে ফাইল ওপেন করুন",
                  "Unknown Sources allow করুন (প্রয়োজনে)",
                  "Install বাটনে চাপ দিন",
                  "App ওপেন করুন"
                ].map((step, i) => (
                  <div key={i} className="flex items-start space-x-4 group">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                      {toBengaliNumber((i + 1).toString())}
                    </div>
                    <p className="text-white/80 font-medium pt-1">{step}</p>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Button 
                  variant="gold" 
                  className="w-full py-4 rounded-2xl shadow-lg shadow-gold-500/20"
                  onClick={() => setShowDownloadGuide(false)}
                >
                  বুঝেছি
                </Button>
              </div>
              
              <p className="text-[10px] text-center text-white/20 font-bold uppercase tracking-widest">Auto-closing in 8 seconds</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  const renderAllahNames = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="pb-24"
    >
      <div className="sticky top-0 z-30 glass p-6 flex items-center justify-between">
        <button onClick={() => window.history.back()} className="p-2 hover:bg-white/10 rounded-xl">
          <SkipBack size={24} />
        </button>
        <h3 className="text-xl font-bold">আল্লাহর ৯৯ নাম</h3>
        <div className="w-10" />
      </div>

      <div className="p-6 grid grid-cols-2 gap-4">
        {ALLAH_NAMES.map(name => (
          <GlassCard key={name.id} className="p-6 text-center space-y-3 bg-emerald-900/20 border-gold-500/10">
            <p className="text-3xl font-arabic text-gold-500" style={{ fontFamily: 'Amiri, serif' }}>{name.arabic}</p>
            <div>
              <p className="font-bold text-white">{name.transliteration}</p>
              <p className="text-xs text-white/40">{name.meaning}</p>
            </div>
          </GlassCard>
        ))}
      </div>
    </motion.div>
  );

  const renderTasbeeh = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="px-6 pt-12 pb-24 flex flex-col items-center justify-center min-h-[80vh] space-y-12"
    >
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold font-bangla">তাসবিহ কাউন্টার</h2>
        <p className="text-emerald-400 font-medium tracking-widest uppercase text-xs">Digital Dhikr Companion</p>
      </div>

      <div className="relative">
        <div className={cn(
          "w-64 h-64 rounded-full border-8 border-emerald-500/20 flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden active:scale-95 cursor-pointer",
          tasbeehCount >= tasbeehTarget ? "border-gold-500/50 gold-glow" : "emerald-glow"
        )}
        onClick={() => {
          const newCount = tasbeehCount + 1;
          setTasbeehCount(newCount);
          localStorage.setItem('tasbeehCount', newCount.toString());
          if (navigator.vibrate) navigator.vibrate(50);
        }}>
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
          <p className="text-xs font-bold text-white/40 uppercase tracking-[0.3em] mb-2">Count</p>
          <motion.p 
            key={tasbeehCount}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-7xl font-black text-white tracking-tighter"
          >
            {toBengaliNumber(tasbeehCount.toString())}
          </motion.p>
          <p className="mt-4 text-[10px] font-bold text-gold-500 uppercase tracking-widest">Target: {toBengaliNumber(tasbeehTarget.toString())}</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {[33, 99, 1000].map(t => (
          <button 
            key={t}
            onClick={() => setTasbeehTarget(t)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all",
              tasbeehTarget === t ? "bg-gold-500 text-emerald-950" : "glass text-white/60"
            )}
          >
            {toBengaliNumber(t.toString())}
          </button>
        ))}
      </div>

      <div className="flex space-x-4">
        <Button 
          variant="outline" 
          className="rounded-full w-14 h-14 p-0"
          onClick={() => {
            setTasbeehCount(0);
            localStorage.setItem('tasbeehCount', '0');
          }}
        >
          <RotateCcw size={20} />
        </Button>
        <Button 
          variant="gold" 
          className="px-12"
          onClick={() => {
            const newCount = tasbeehCount + 1;
            setTasbeehCount(newCount);
            localStorage.setItem('tasbeehCount', newCount.toString());
            if (navigator.vibrate) navigator.vibrate(50);
          }}
        >
          সুবহানাল্লাহ
        </Button>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[#020D0A] text-white font-bangla selection:bg-emerald-500/30 overflow-x-hidden">
      <AnimatePresence>
        {isSplash && renderSplashScreen()}
      </AnimatePresence>

      <main className="max-w-lg mx-auto relative min-h-screen">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && renderHome()}
          {activeTab === 'quran' && renderQuran()}
          {activeTab === 'duas' && renderDuas()}
          {activeTab === 'surah-detail' && renderSurahDetail()}
          {activeTab === 'tools' && renderTools()}
          {activeTab === 'profile' && renderProfile()}
          {activeTab === 'tasbeeh' && renderTasbeeh()}
          {activeTab === 'allah-names' && renderAllahNames()}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      {!isSplash && (
        <div className="fixed bottom-0 left-0 w-full p-4 z-50">
          <div className="max-w-lg mx-auto">
            <GlassCard className="flex items-center justify-around py-4 px-2 bg-emerald-950/90 border-emerald-500/20 emerald-glow">
              <button onClick={() => navigateToTab('home')} className={cn("flex flex-col items-center space-y-1 transition-all", activeTab === 'home' ? "text-gold-500 scale-110" : "text-white/40")}>
                <Moon size={24} />
                <span className="text-[10px] font-bold uppercase">হোম</span>
              </button>
              <button onClick={() => navigateToTab('quran')} className={cn("flex flex-col items-center space-y-1 transition-all", activeTab === 'quran' || activeTab === 'surah-detail' ? "text-gold-500 scale-110" : "text-white/40")}>
                <BookOpen size={24} />
                <span className="text-[10px] font-bold uppercase">কুরআন</span>
              </button>
              <button onClick={() => navigateToTab('duas')} className={cn("flex flex-col items-center space-y-1 transition-all", activeTab === 'duas' ? "text-gold-500 scale-110" : "text-white/40")}>
                <Heart size={24} />
                <span className="text-[10px] font-bold uppercase">দোয়া</span>
              </button>
              <button onClick={() => navigateToTab('tasbeeh')} className={cn("flex flex-col items-center space-y-1 transition-all", activeTab === 'tasbeeh' ? "text-gold-500 scale-110" : "text-white/40")}>
                <Fingerprint size={24} />
                <span className="text-[10px] font-bold uppercase">তাসবিহ</span>
              </button>
              <button onClick={() => navigateToTab('tools')} className={cn("flex flex-col items-center space-y-1 transition-all", activeTab === 'tools' || activeTab === 'profile' ? "text-gold-500 scale-110" : "text-white/40")}>
                <Calculator size={24} />
                <span className="text-[10px] font-bold uppercase">টুলস</span>
              </button>
            </GlassCard>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Hind+Siliguri:wght@300;400;500;600;700&display=swap');
        
        .dir-rtl { direction: rtl; }
        
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.2); border-radius: 10px; }
      `}} />
    </div>
  );
}
