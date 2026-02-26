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
  Bell, ListChecks, FileText, Search, Volume2, VolumeX
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, addDays, differenceInSeconds } from 'date-fns';
import { Howl } from 'howler';

import { getBengaliDate, getHijriDate, toBengaliNumber } from './utils/calendar';
import { fetchPrayerTimes, type PrayerTimes } from './services/prayerService';
import { fetchSurahs, fetchSurahDetail, type Surah, type Ayah } from './services/quranService';
import { BD_DISTRICTS, getDistrictFromCoords } from './services/locationService';
import { ESSENTIAL_DUAS, ESSENTIAL_SURAHS, DAILY_HADITH, type Dua } from './constants/content';

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

type Screen = 'home' | 'quran' | 'duas' | 'tools' | 'tracker' | 'profile' | 'surah-detail';

export default function App() {
  const [isSplash, setIsSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<Screen>('home');
  const [prevTab, setPrevTab] = useState<Screen>('home');
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
  const [countdown, setCountdown] = useState('০০:০০:০০');
  const [nextPrayer, setNextPrayer] = useState<{name: string, time: Date} | null>(null);

  const calculateZakat = () => {
    const total = (parseFloat(zakatData.gold) || 0) + (parseFloat(zakatData.cash) || 0) + (parseFloat(zakatData.business) || 0);
    setZakatResult(total * 0.025);
  };

  useEffect(() => {
    if (!prayerTimes) return;
    
    const getNextPrayer = (times: PrayerTimes) => {
      const now = new Date();
      const prayerNames = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      
      for (const name of prayerNames) {
        const [hours, minutes] = (times as any)[name].split(':');
        const prayerTime = new Date();
        prayerTime.setHours(parseInt(hours), parseInt(minutes), 0);
        
        if (prayerTime > now) {
          return { name, time: prayerTime };
        }
      }
      
      const [hours, minutes] = (times as any)['Fajr'].split(':');
      const tomorrowFajr = new Date();
      tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);
      tomorrowFajr.setHours(parseInt(hours), parseInt(minutes), 0);
      return { name: 'Fajr', time: tomorrowFajr };
    };

    const interval = setInterval(() => {
      const next = getNextPrayer(prayerTimes);
      setNextPrayer(next);
      const diff = differenceInSeconds(next.time, new Date());
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setCountdown(`${toBengaliNumber(h.toString().padStart(2, '0'))}:${toBengaliNumber(m.toString().padStart(2, '0'))}:${toBengaliNumber(s.toString().padStart(2, '0'))}`);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [prayerTimes]);

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
    fetchSurahs().then(setSurahs);
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
      console.error(e);
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

  // --- Audio Logic ---

  const playSurah = (detail: { ayahs: Ayah[] }) => {
    if (audioPlayer) audioPlayer.stop();
    
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
        onend: () => playNext(index + 1)
      });
      setAudioPlayer(sound);
      sound.play();
      setIsPlaying(true);
    };

    playNext(0);
  };

  const toggleAudio = () => {
    if (audioPlayer) {
      if (isPlaying) audioPlayer.pause();
      else audioPlayer.play();
      setIsPlaying(!isPlaying);
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
    const hDate = getHijriDate(now);

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
              <p className="text-emerald-400 font-medium">আজকের রমজান ক্যালেন্ডার</p>
            </div>
            <div className="flex flex-col items-end space-y-3">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="w-10 h-10 rounded-xl glass flex items-center justify-center text-gold-500"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button 
                onClick={handleLocationDetection}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg glass text-[10px] font-bold text-emerald-400 border-emerald-500/30"
              >
                <MapPin size={12} />
                <span>{district}</span>
              </button>
            </div>
          </div>

          <GlassCard className="p-6 bg-gradient-to-br from-emerald-900/60 to-emerald-800/20 border-emerald-500/20">
            <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-white/10">
              <div className="text-center">
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">ইংরেজি</p>
                <p className="text-sm font-bold">{format(now, 'dd MMM')}</p>
              </div>
              <div className="text-center border-x border-white/10">
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">হিজরি</p>
                <p className="text-sm font-bold">{hDate.day} {hDate.month}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">বাংলা</p>
                <p className="text-sm font-bold">{bDate.day} {bDate.month}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-white/60">
                  পরবর্তী ওয়াক্ত: <span className="text-gold-500 font-bold">
                    {nextPrayer?.name === 'Fajr' ? 'ফজর (সেহরি শেষ)' : 
                     nextPrayer?.name === 'Sunrise' ? 'সূর্যোদয়' : 
                     nextPrayer?.name === 'Dhuhr' ? 'যোহর' : 
                     nextPrayer?.name === 'Asr' ? 'আসর' : 
                     nextPrayer?.name === 'Maghrib' ? 'মাগরিব (ইফতার)' : 
                     nextPrayer?.name === 'Isha' ? 'এশা' : '...'}
                  </span>
                </p>
                <p className="text-3xl font-black text-white tracking-tighter">{countdown}</p>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 flex items-center justify-center relative">
                <div className="absolute inset-0 border-t-4 border-gold-500 rounded-full animate-spin" />
                <Timer size={24} className="text-gold-500" />
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

  const renderDuas = () => (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="px-6 pt-12 pb-24 space-y-6"
    >
      <div className="space-y-1">
        <h2 className="text-3xl font-bold font-bangla">সূরা ও দোয়া</h2>
        <p className="text-emerald-400 font-medium">প্রয়োজনীয় দোয়া এবং সূরাসমূহ</p>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest">প্রয়োজনীয় দোয়া</h3>
        {ESSENTIAL_DUAS.map(dua => (
          <button 
            key={dua.id}
            onClick={() => setSelectedDua(dua)}
            className="w-full flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-left"
          >
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
                <BookOpen size={20} />
              </div>
              <span className="text-white font-semibold">{dua.title}</span>
            </div>
            <ChevronRight className="text-white/20" size={20} />
          </button>
        ))}

        <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mt-8">প্রয়োজনীয় সূরা</h3>
        {ESSENTIAL_SURAHS.map(surah => (
          <button 
            key={surah.id}
            onClick={() => setSelectedDua(surah)}
            className="w-full flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-left"
          >
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400">
                <BookOpen size={20} />
              </div>
              <span className="text-white font-semibold">{surah.title}</span>
            </div>
            <ChevronRight className="text-white/20" size={20} />
          </button>
        ))}
      </div>

      {/* Dua Detail Modal */}
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
    </motion.div>
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
              const detail = await fetchSurahDetail(s.number);
              setSurahDetail(detail);
              setLoading(false);
              setActiveTab('surah-detail');
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
          <button onClick={() => setActiveTab('quran')} className="p-2 hover:bg-white/10 rounded-xl">
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
                currentAyahIndex === idx ? "bg-emerald-500/10 border border-emerald-500/30 gold-glow" : "border border-transparent"
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
                  onClick={() => playSurah(surahDetail)}
                  className="w-12 h-12 rounded-full bg-gold-500 flex items-center justify-center text-emerald-950"
                >
                  {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                </button>
                <div>
                  <p className="text-xs font-bold text-emerald-400">অডিও প্লেয়ার</p>
                  <p className="text-sm font-bold">আয়াত {toBengaliNumber(currentAyahIndex + 1)}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Volume2 size={20} className="text-white/40" />
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
        <button onClick={() => setActiveTab('tools')} className="p-2 hover:bg-white/10 rounded-xl">
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
          onClick={() => setActiveTab('profile')}
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400">
            <Info size={32} />
          </div>
          <h4 className="font-bold">ডেভেলপার প্রোফাইল</h4>
        </GlassCard>
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
              <h3 className="text-xl font-bold font-bangla">রমজান ক্যালেন্ডার ২০২৬</h3>
              <button onClick={() => setShowRamadanCalendar(false)} className="text-xs text-white/40">বন্ধ করুন</button>
            </div>
            <GlassCard className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-[10px] uppercase tracking-wider text-emerald-400">
                    <th className="p-4">রমজান</th>
                    <th className="p-4">তারিখ</th>
                    <th className="p-4">সেহরি</th>
                    <th className="p-4">ইফতার</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[...Array(30)].map((_, i) => (
                    <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                      <td className="p-4 font-bold">{toBengaliNumber(i + 1)}</td>
                      <td className="p-4 text-white/60">{toBengaliNumber(i + 1)} মার্চ</td>
                      <td className="p-4 text-gold-500 font-mono">০৪:৫২</td>
                      <td className="p-4 text-emerald-400 font-mono">০৬:০৫</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>
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
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      {!isSplash && (
        <div className="fixed bottom-0 left-0 w-full p-4 z-50">
          <div className="max-w-lg mx-auto">
            <GlassCard className="flex items-center justify-around py-4 px-2 bg-emerald-950/90 border-emerald-500/20 emerald-glow">
              <button onClick={() => setActiveTab('home')} className={cn("flex flex-col items-center space-y-1 transition-all", activeTab === 'home' ? "text-gold-500 scale-110" : "text-white/40")}>
                <Moon size={24} />
                <span className="text-[10px] font-bold uppercase">হোম</span>
              </button>
              <button onClick={() => setActiveTab('quran')} className={cn("flex flex-col items-center space-y-1 transition-all", activeTab === 'quran' || activeTab === 'surah-detail' ? "text-gold-500 scale-110" : "text-white/40")}>
                <BookOpen size={24} />
                <span className="text-[10px] font-bold uppercase">কুরআন</span>
              </button>
              <button onClick={() => setActiveTab('duas')} className={cn("flex flex-col items-center space-y-1 transition-all", activeTab === 'duas' ? "text-gold-500 scale-110" : "text-white/40")}>
                <Heart size={24} />
                <span className="text-[10px] font-bold uppercase">দোয়া</span>
              </button>
              <button onClick={() => setActiveTab('tools')} className={cn("flex flex-col items-center space-y-1 transition-all", activeTab === 'tools' || activeTab === 'profile' ? "text-gold-500 scale-110" : "text-white/40")}>
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
