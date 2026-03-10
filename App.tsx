
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  X, Settings, RefreshCw, Shield, Maximize, Activity, ChevronRight, ChevronLeft,
  FileImage, Map, HardHat, Info, Phone, Mail, Calendar, FileText, 
  FlaskConical, Database, Palette, ZoomIn, ZoomOut, FileType, Minimize, Eye, Layers, Loader2, Clock, Bell, Briefcase, Type as TypeIcon, FileCheck,
  Play, Lock, Delete, Search, TrendingUp, Timer
} from 'lucide-react';
import { ProjectData, ExtractionStatus, Stakeholder, TechnicalStudy } from './types';
import { extractProjectDataFromExcelContent } from './services/geminiService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const CACHE_KEY = "dgpc_dashboard_cache_v25";
const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/15aanGWc37_-w2iVsFnJWdQz9PpRM4WB-2PjhK0qRifA/export?format=csv";

type Theme = {
  id: string;
  name: string;
  primary: string;
  accent: string;
  bgLight: string;
  cardBg: string;
  borderColor: string;
  textColor: string;
};

const THEMES: Theme[] = [
  {
    id: 'clean-pro',
    name: 'Blanc Pro',
    primary: 'bg-red-600',
    accent: 'text-red-600',
    bgLight: 'bg-[#f8fafc]',
    cardBg: 'bg-white',
    borderColor: 'border-slate-100',
    textColor: 'text-slate-900',
  },
  {
    id: 'navy-prestige',
    name: 'Navy Prestige',
    primary: 'bg-[#1E293B]',
    accent: 'text-[#1E293B]',
    bgLight: 'bg-[#F1F5F9]',
    cardBg: 'bg-white',
    borderColor: 'border-slate-200',
    textColor: 'text-slate-900',
  },
  {
    id: 'royal-gold',
    name: 'Royal Gold',
    primary: 'bg-[#C5A059]',
    accent: 'text-[#C5A059]',
    bgLight: 'bg-[#0F0F0F]',
    cardBg: 'bg-[#1A1A1A]',
    borderColor: 'border-[#C5A059]/20',
    textColor: 'text-white',
  }
];

const FONTS = [
  { id: 'Arial', name: 'Arial (Classique)' },
  { id: 'Inter', name: 'Inter (Moderne)' },
  { id: 'Cairo', name: 'Cairo (Arabe/Prestige)' },
  { id: 'Times New Roman', name: 'Times (Sérieux)' }
];

const parseAndCheckFuture = (dateStr?: string): boolean => {
  if (!dateStr || dateStr.includes("--") || dateStr.length < 5) return false;
  const normalized = dateStr.trim().replace(/[-.]/g, '/');
  let targetDate: Date | null = null;
  const dmyMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmyMatch) {
    let year = parseInt(dmyMatch[3]);
    if (year < 100) year += 2000;
    targetDate = new Date(year, parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  }
  if (targetDate && !isNaN(targetDate.getTime())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    return targetDate >= today;
  }
  return false;
};

const calculateEndDate = (startStr?: string, durationStr?: string): { date: string, progress: number } => {
  if (!startStr || startStr === "--" || !durationStr || durationStr === "--") return { date: "--", progress: 0 };
  const normalized = startStr.trim().replace(/[-.]/g, '/');
  const dmyMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!dmyMatch) return { date: "--", progress: 0 };

  let year = parseInt(dmyMatch[3]);
  if (year < 100) year += 2000;

  const start = new Date(year, parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  const monthsMatch = durationStr.toUpperCase().match(/(\d+)\s*MOIS/);
  const months = monthsMatch ? parseInt(monthsMatch[1]) : 0;
  
  if (months === 0) return { date: "--", progress: 0 };

  const end = new Date(start);
  end.setMonth(start.getMonth() + months);

  const day = String(end.getDate()).padStart(2, '0');
  const month = String(end.getMonth() + 1).padStart(2, '0');
  const endYear = end.getFullYear();
  const dateStr = `${day}/${month}/${endYear}`;

  const today = new Date();
  const total = end.getTime() - start.getTime();
  const elapsed = today.getTime() - start.getTime();
  const progress = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));

  return { date: dateStr, progress };
};

const getStatusColorConfig = (status: string = "") => {
  const s = status.toUpperCase().trim();
  if (s === 'S/A' || s === 'S.A' || s.includes('SANS ARCHITECTE') || s === 'SA') return { bg: 'bg-slate-400', text: 'text-slate-400' };
  if (['ACHEVE', 'ACHEVÉ', 'ACHÈVE', 'FAVORABLE', 'OUI', 'VALIDE', 'APPROUVE', 'ACTIF'].some(k => s.includes(k))) return { bg: 'bg-emerald-500', text: 'text-emerald-500' };
  if (['ATTENTE', 'EN COURS', 'ETUDE', 'TRANSMIS', 'PROGRAMME', 'VALIDATION', 'PAS EN COURS', 'BCT'].some(k => s.includes(k))) return { bg: 'bg-amber-500', text: 'text-amber-500' };
  return { bg: 'bg-slate-500', text: 'text-slate-500' };
};

const getProgressColor = (progress: number) => {
  if (progress < 30) return 'bg-red-600';
  if (progress < 70) return 'bg-orange-500';
  return 'bg-emerald-500';
};

const parseFinancialValue = (val?: string): number => {
  if (!val || val === "--") return 0;
  const cleaned = val.toUpperCase().replace(/\s/g, '').replace(/,/g, '.');
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*([MK]?)\s*DHS?/);
  if (!match) {
    const simpleMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
    return simpleMatch ? parseFloat(simpleMatch[1]) : 0;
  }
  let num = parseFloat(match[1]);
  const unit = match[2];
  if (unit === 'M') num *= 1000000;
  if (unit === 'K') num *= 1000;
  return num;
};

export default function App() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [exportingProjectId, setExportingProjectId] = useState<string | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>('idle');
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<Theme>(THEMES[0]);
  const [selectedFont, setSelectedFont] = useState(FONTS[1].id);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{current: number, total: number} | null>(null);
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [showTechStudies, setShowTechStudies] = useState<ProjectData | null>(null);
  const [showEntreprise, setShowEntreprise] = useState<ProjectData | null>(null);
  const [isDownloadingEntreprise, setIsDownloadingEntreprise] = useState(false);
  const entreprisePdfRef = useRef<HTMLDivElement>(null);
  const [showMap, setShowMap] = useState<ProjectData | null>(null);
  const [showFutureDates, setShowFutureDates] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const captureHiddenRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playClick = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 0.4;
      audioRef.current.play().catch(() => {});
    }
  };

  const handlePinInput = (num: string) => {
    playClick();
    if (pinError) return;
    if (pin.length < 4) setPin(pin + num);
  };

  const handlePinDelete = () => {
    playClick();
    if (pinError) return;
    setPin(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === '2025') {
        setTimeout(() => { playClick(); setIsAuthenticated(true); toggleFullscreen(); }, 100);
      } else {
        setPinError(true);
        setTimeout(() => { setPin(""); setPinError(false); }, 600);
      }
    }
  }, [pin]);

  // المرحلة الثانية: التحميل الفوري من الـ Cache ثم المزامنة في الخلفية
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setProjects(parsed);
        if (parsed.length > 0) setSelectedProjectId(parsed[0].id);
        
        // مزامنة صامتة في الخلفية إذا كانت هناك بيانات مخزنة
        syncDataInBackground();
      } catch (e) { loadInitialData(); }
    } else { loadInitialData(); }
  }, []);

  const syncDataInBackground = async () => {
    setIsBackgroundSyncing(true);
    try {
      const response = await fetch(DEFAULT_SHEET_URL);
      const csvData = await response.text();
      const extracted = await extractProjectDataFromExcelContent(csvData);
      setProjects(extracted);
      localStorage.setItem(CACHE_KEY, JSON.stringify(extracted));
    } catch (error) {
      console.warn("Mise à jour arrière-plan échouée, utilisation du cache.");
    } finally {
      setIsBackgroundSyncing(false);
    }
  };

  const loadInitialData = async () => {
    if (extractionStatus === 'processing') return;
    setExtractionStatus('processing');
    try {
      const response = await fetch(DEFAULT_SHEET_URL);
      const csvData = await response.text();
      const extracted = await extractProjectDataFromExcelContent(csvData);
      setProjects(extracted);
      if (extracted.length > 0) setSelectedProjectId(extracted[0].id);
      localStorage.setItem(CACHE_KEY, JSON.stringify(extracted));
      setExtractionStatus('idle');
    } catch (error) { 
      setExtractionStatus('error');
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) { setProjects(JSON.parse(cached)); setExtractionStatus('idle'); }
    }
  };

  const handleDownloadEntreprisePDF = async () => {
    if (!entreprisePdfRef.current || !showEntreprise) return;
    playClick();
    setIsDownloadingEntreprise(true);
    await new Promise(r => setTimeout(r, 500));
    
    try {
      const canvas = await html2canvas(entreprisePdfRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`ENTREPRISE_${showEntreprise.entreprise?.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error("Erreur PDF Entreprise:", error);
    } finally {
      setIsDownloadingEntreprise(false);
    }
  };

  const handleDownloadSingleA4 = async () => {
    playClick();
    if (!captureHiddenRef.current) return;
    setIsDownloading(true);
    setExportingProjectId(selectedProjectId);
    await new Promise(r => setTimeout(r, 600));
    try {
      const canvas = await html2canvas(captureHiddenRef.current!, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, width: 794, height: 1123 }); 
      const link = document.createElement('a');
      link.download = `RAPPORT_FHD_${selectedProject?.name}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 1.0); 
      link.click();
    } catch (err) { console.error(err); } finally { setIsDownloading(false); setExportingProjectId(null); }
  };

  const startPdfGeneration = async () => {
    playClick();
    setShowPdfOptions(false);
    if (projects.length === 0) return;
    setIsDownloading(true);
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    for (let i = 0; i < projects.length; i++) {
      setPdfProgress({ current: i + 1, total: projects.length });
      setExportingProjectId(projects[i].id);
      await new Promise(r => setTimeout(r, 800)); 
      if (captureHiddenRef.current) {
         const canvas = await html2canvas(captureHiddenRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, width: 794, height: 1123 });
         const imgData = canvas.toDataURL('image/jpeg', 0.9);
         if (i > 0) doc.addPage();
         doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }
    }
    doc.save(`RAPPORT_DGPC_OFFICIEL_${new Date().getTime()}.pdf`);
    setPdfProgress(null); setIsDownloading(false); setExportingProjectId(null);
  };

  const filteredProjects = useMemo(() => {
    if (!searchTerm) return projects;
    const s = searchTerm.toLowerCase();
    return projects.filter(p => p.name.toLowerCase().includes(s) || p.convention.toLowerCase().includes(s) || (p.entreprise && p.entreprise.toLowerCase().includes(s)) || p.stakeholders.some(sh => sh.name.toLowerCase().includes(s)));
  }, [projects, searchTerm]);

  const selectedProject = useMemo(() => filteredProjects.find(p => p.id === selectedProjectId) || null, [filteredProjects, selectedProjectId]);
  const exportingProject = useMemo(() => projects.find(p => p.id === exportingProjectId) || null, [projects, exportingProjectId]); 

  const futureDeadlines = useMemo(() => {
    const deadlines: any[] = [];
    projects.forEach(p => {
      p.stakeholders.forEach(s => {
        if (parseAndCheckFuture(s.visitePrevue)) deadlines.push({ project: p.name, label: `Visite (${s.role})`, date: s.visitePrevue });
        if (parseAndCheckFuture(s.dateOuverturePlis)) deadlines.push({ project: p.name, label: `Ouverture Plis (${s.role})`, date: s.dateOuverturePlis });
      });
      if (parseAndCheckFuture(p.entrepriseVisite)) deadlines.push({ project: p.name, label: `Visite Entreprise`, date: p.entrepriseVisite });
      if (parseAndCheckFuture(p.entrepriseOuverturePlis)) deadlines.push({ project: p.name, label: `Ouverture Plis Entreprise`, date: p.entrepriseOuverturePlis });
      
      const { date: calcEnd } = calculateEndDate(p.startDate, p.delaiPrevisionnel);
      if (parseAndCheckFuture(calcEnd)) deadlines.push({ project: p.name, label: `Fin Travaux (Calculée)`, date: calcEnd });
    });
    return deadlines.sort((a, b) => {
        const parseD = (d: string) => {
            const m = d.trim().replace(/[-.]/g, '/').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
            if (!m) return 0;
            let year = parseInt(m[3]);
            if (year < 100) year += 2000;
            return new Date(year, parseInt(m[2])-1, parseInt(m[1])).getTime();
        }
        return parseD(a.date) - parseD(b.date);
    });
  }, [projects]);

  const handlePrev = () => {
    playClick();
    const idx = filteredProjects.findIndex(p => p.id === selectedProjectId);
    if (idx === -1) return;
    const prevIdx = (idx - 1 + filteredProjects.length) % filteredProjects.length;
    setSelectedProjectId(filteredProjects[prevIdx].id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNext = () => {
    playClick();
    const idx = filteredProjects.findIndex(p => p.id === selectedProjectId);
    if (idx === -1) return;
    const nextIdx = (idx + 1) % filteredProjects.length;
    setSelectedProjectId(filteredProjects[nextIdx].id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(() => {}); setIsFullscreen(true); }
    else { document.exitFullscreen().catch(() => {}); setIsFullscreen(false); }
  };

  const isSystemBusy = extractionStatus === 'processing' || !!pdfProgress;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col min-h-screen luxury-bg font-['Inter'] relative overflow-hidden">
        <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3" preload="auto" />
        <div className="absolute inset-0 z-0">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-900/10 blur-[150px] rounded-full animate-pulse"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6">
           <div className="mb-12 text-center">
              <div className="inline-block mb-6 p-4 rounded-full glass-panel shadow-2xl"><Lock className="text-amber-500 w-8 h-8" /></div>
              <h1 className="text-3xl font-black uppercase tracking-[0.2em] text-white mb-2 farsi-bold">Authentification</h1>
              <p className="text-amber-500/60 font-bold text-[10px] uppercase tracking-[0.5em]">Accès Sécurisé DGPC</p>
           </div>
           <div className="flex gap-4 mb-12">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`w-4 h-4 rounded-full border border-amber-500/30 transition-all duration-300 ${pin.length > i ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-110' : 'bg-transparent'} ${pinError ? 'animate-[shake_0.5s_ease-in-out] bg-red-600 border-red-600' : ''}`}></div>
              ))}
           </div>
           <div className="grid grid-cols-3 gap-6 max-w-[320px] w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button key={num} onClick={() => handlePinInput(num.toString())} className="w-20 h-20 rounded-full glass-panel border border-white/5 text-2xl font-bold text-white hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center group"><span className="group-hover:text-amber-400 transition-colors">{num}</span></button>
              ))}
              <div className="w-20 h-20"></div>
              <button onClick={() => handlePinInput("0")} className="w-20 h-20 rounded-full glass-panel border border-white/5 text-2xl font-bold text-white hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center group"><span className="group-hover:text-amber-400 transition-colors">0</span></button>
              <button onClick={handlePinDelete} className="w-20 h-20 rounded-full text-white/50 hover:text-red-400 active:scale-95 transition-all flex items-center justify-center"><Delete size={28} /></button>
           </div>
           <div className="mt-12 text-slate-500 text-[9px] uppercase tracking-widest">v5.0.0 • Flash Engine</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-screen ${currentTheme.bgLight}`} style={{ fontFamily: selectedFont }}>
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3" preload="auto" />

      {/* مؤشر المزامنة في الخلفية */}
      {isBackgroundSyncing && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[5000] bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-3 shadow-2xl animate-in fade-in slide-in-from-top-4">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </div>
          <span className="text-[9px] font-black text-white uppercase tracking-widest">Mise à jour en direct...</span>
        </div>
      )}

      {extractionStatus === 'processing' && projects.length === 0 && (
        <div className="fixed inset-0 z-[6000] luxury-bg flex flex-col items-center justify-center p-6 text-center">
          <Loader2 className="animate-spin text-amber-500 w-16 h-16 opacity-70 mb-6" />
          <h3 className="gold-text text-2xl font-black uppercase tracking-wider farsi-bold">Initialisation Flash</h3>
        </div>
      )}

      {showPdfOptions && (
        <div className="fixed inset-0 z-[3500] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setShowPdfOptions(false)}>
          <div className="w-full max-w-sm bg-white rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
             <div className="bg-orange-600 p-6 text-white text-center"><FileType size={32} className="mx-auto mb-2" /><h3 className="font-black uppercase text-[10px] tracking-[0.3em]">Exportation</h3></div>
             <div className="p-8 space-y-6">
                <div>
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-4">Police</p>
                   <div className="grid grid-cols-1 gap-2">
                      {FONTS.map(f => (
                        <button key={f.id} onClick={() => { playClick(); setSelectedFont(f.id); }} className={`w-full p-4 rounded-2xl flex items-center justify-between border transition-all ${selectedFont === f.id ? 'border-orange-600 bg-orange-50' : 'border-slate-100 bg-slate-50'}`}><span className="text-[10px] font-black uppercase" style={{ fontFamily: f.id }}>{f.name}</span>{selectedFont === f.id && <div className="w-2 h-2 rounded-full bg-orange-600"></div>}</button>
                      ))}
                   </div>
                </div>
                <button onClick={startPdfGeneration} className="w-full py-5 bg-orange-600 text-white rounded-[25px] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-orange-100 active:scale-95 transition-all">Générer PDF</button>
             </div>
          </div>
        </div>
      )}

      {showFutureDates && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setShowFutureDates(false)}>
           <div className="w-full max-w-lg bg-white rounded-[35px] overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="bg-slate-950 p-5 text-white flex justify-between items-center"><div className="flex items-center gap-3"><Bell size={18} className="text-red-500" /><h3 className="font-black uppercase text-[9px] tracking-widest">Échéances</h3></div><button onClick={() => { playClick(); setShowFutureDates(false); }} className="p-2 hover:bg-white/10 rounded-full"><X size={20}/></button></div>
              <div className="p-5 space-y-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
                 {futureDeadlines.length > 0 ? futureDeadlines.map((dl, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-[20px] border border-slate-100">
                       <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white shadow-sm text-red-600"><Calendar size={18} /></div>
                       <div className="flex-1"><p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">{dl.project}</p><h4 className="text-[10px] font-black text-slate-900 uppercase">{dl.label}</h4></div>
                       <div className="px-2.5 py-1 bg-white rounded-lg border border-slate-100 font-black text-red-600 text-[9px]">{dl.date}</div>
                    </div>
                 )) : <div className="text-center py-10 opacity-30 flex flex-col items-center"><Clock size={32} className="mb-2" /><p className="font-black uppercase text-[8px]">Aucune échéance à venir</p></div>}
              </div>
           </div>
        </div>
      )}

      {showThemePicker && (
        <div className="fixed inset-0 z-[2500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowThemePicker(false)}>
          <div className="w-full max-w-xs bg-white rounded-[35px] overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
             <div className="bg-slate-900 p-5 text-white text-center"><Palette size={20} className="mx-auto mb-2 opacity-80" /><h3 className="font-black uppercase text-[9px] tracking-widest">Style Visuel</h3></div>
             <div className="p-4 space-y-2">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => { playClick(); setCurrentTheme(t); setShowThemePicker(false); }} className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all border ${currentTheme.id === t.id ? 'border-red-600 bg-red-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}>
                    <div className="flex items-center gap-4"><div className={`w-5 h-5 rounded-full ${t.primary}`}></div><span className="font-black text-[9px] text-slate-900 uppercase">{t.name}</span></div>
                  </button>
                ))}
             </div>
          </div>
        </div>
      )}

      {showEntreprise && (
        <div className="fixed inset-0 z-[2500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowEntreprise(null)}>
           <div className="w-full max-w-xl bg-white rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white text-center flex flex-col items-center justify-center relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-10"><Briefcase size={120} /></div>
                 <div className="absolute top-4 right-4 flex gap-2">
                    <button 
                       onClick={handleDownloadEntreprisePDF}
                       disabled={isDownloadingEntreprise}
                       className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all active:scale-90 flex items-center gap-2"
                    >
                       {isDownloadingEntreprise ? <Loader2 size={16} className="animate-spin" /> : <FileType size={16} />}
                       <span className="text-[8px] font-black uppercase">PDF</span>
                    </button>
                    <button onClick={() => { playClick(); setShowEntreprise(null); }} className="p-2.5 hover:bg-white/10 rounded-xl transition-all"><X size={20}/></button>
                 </div>
                 <Briefcase size={32} className="mb-4 text-red-500" />
                 <h3 className="font-black uppercase text-[10px] tracking-[0.4em] mb-2 opacity-60">Fiche Entreprise</h3>
                 <p className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight max-w-md">{showEntreprise.entreprise || "Non Spécifié"}</p>
              </div>
              
              <div className="p-8 bg-white space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailRow icon={Info} label="TRAVAUX LANCÉS" value={showEntreprise.travauxLances} />
                    <DetailRow icon={FileText} label="N AOO ENTREPRISE" value={showEntreprise.entrepriseNAoo} />
                    <DetailRow icon={FileText} label="N MARCHÉ ENTREPRISE" value={showEntreprise.entrepriseNMarche} />
                    <DetailRow icon={Calendar} label="DÉBUT DES TRAVAUX" value={showEntreprise.startDate} />
                    <DetailRow icon={Clock} label="DÉLAI PRÉVISIONNEL" value={showEntreprise.delaiPrevisionnel} />
                    {showEntreprise.delaiPrevisionnel && showEntreprise.delaiPrevisionnel !== "--" && (
                       <DetailRow icon={Calendar} label="FIN PRÉVUE (CALCULÉE)" value={calculateEndDate(showEntreprise.startDate, showEntreprise.delaiPrevisionnel).date} />
                    )}
                 </div>

                 <div className="space-y-6 pt-6 border-t border-slate-100">
                    {/* AVANCEMENT TRAVAUX */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                       <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2"><TrendingUp size={16} className="text-emerald-600" /><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">AVANCEMENT TRAVAUX</span></div>
                          <span className="text-sm font-black text-slate-900">{showEntreprise.progressTravaux || 0}%</span>
                       </div>
                       <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${showEntreprise.progressTravaux || 0}%` }}></div>
                       </div>
                    </div>

                    {/* ESTIMATION */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                       <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2"><Activity size={16} className="text-blue-600" /><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">ESTIMATION ({showEntreprise.financialEstimation || "--"})</span></div>
                          <span className="text-sm font-black text-slate-900">
                             {showEntreprise.financialEstimation && showEntreprise.financialEstimation !== "--" ? 
                                Math.min(100, Math.round(((showEntreprise.totalDecomptes || 0) / parseFinancialValue(showEntreprise.financialEstimation)) * 100)) : 0}%
                          </span>
                       </div>
                       <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 shadow-sm" 
                               style={{ width: `${showEntreprise.financialEstimation && showEntreprise.financialEstimation !== "--" ? 
                                          Math.min(100, Math.round(((showEntreprise.totalDecomptes || 0) / parseFinancialValue(showEntreprise.financialEstimation)) * 100)) : 0}%` }}></div>
                       </div>
                       <div className="mt-2 flex justify-between text-[8px] font-bold text-slate-400 uppercase">
                          <span>Décomptes: {(showEntreprise.totalDecomptes || 0).toLocaleString()} DHS</span>
                          <span>Total: {showEntreprise.financialEstimation}</span>
                       </div>
                    </div>

                    {/* Temps Écoulé */}
                    {showEntreprise.startDate && showEntreprise.startDate !== "--" && showEntreprise.delaiPrevisionnel && showEntreprise.delaiPrevisionnel !== "--" && (
                       <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <div className="flex justify-between items-center mb-3">
                             <div className="flex items-center gap-2"><Timer size={16} className="text-red-600" /><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Temps Écoulé</span></div>
                             <span className="text-sm font-black text-slate-900">{calculateEndDate(showEntreprise.startDate, showEntreprise.delaiPrevisionnel).progress}%</span>
                          </div>
                          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                             <div className="h-full bg-red-600 rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${calculateEndDate(showEntreprise.startDate, showEntreprise.delaiPrevisionnel).progress}%` }}></div>
                          </div>
                       </div>
                    )}
                 </div>

                 <div className="space-y-4 pt-4 border-t border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Description des travaux</p>
                    <p className="text-[11px] text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">{showEntreprise.description || "--"}</p>
                 </div>
              </div>
              <button onClick={() => { playClick(); setShowEntreprise(null); }} className="w-full py-5 bg-slate-900 text-[10px] font-black uppercase text-white hover:bg-red-600 transition-all">Fermer</button>
           </div>
        </div>
      )}

      {/* Hidden Entreprise PDF Content */}
      {showEntreprise && (
        <div className="fixed left-[-9999px] top-0">
          <div ref={entreprisePdfRef} className="w-[794px] bg-white p-12 font-['Inter']">
            <div className="flex justify-between items-start mb-12 border-b-4 border-slate-900 pb-8">
              <div>
                <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-2">{showEntreprise.name}</h1>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-6 bg-red-600"></div>
                  <span className="text-red-600 font-black text-xl uppercase tracking-widest">{showEntreprise.convention}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Généré le</p>
                <p className="text-sm font-black text-slate-900">{new Date().toLocaleDateString('fr-FR')}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-12">
              <div className="col-span-2 bg-slate-50 p-8 rounded-[40px] border border-slate-100">
                <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.4em] mb-4">Entreprise Attributaire</p>
                <h2 className="text-3xl font-black uppercase text-slate-900 mb-8 leading-tight">{showEntreprise.entreprise || "Non Spécifié"}</h2>
                
                <div className="grid grid-cols-2 gap-y-6 gap-x-12">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">N° AOO</p>
                    <p className="text-sm font-black text-slate-900">{showEntreprise.entrepriseNAoo || "--"}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">N° MARCHÉ</p>
                    <p className="text-sm font-black text-slate-900">{showEntreprise.entrepriseNMarche || "--"}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">DÉBUT TRAVAUX</p>
                    <p className="text-sm font-black text-slate-900">{showEntreprise.startDate || "--"}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">DÉLAI</p>
                    <p className="text-sm font-black text-slate-900">{showEntreprise.delaiPrevisionnel || "--"}</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-8 rounded-[40px] text-white flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-6">Indicateurs Clés</p>
                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase opacity-60">Avancement</span>
                      <span className="text-xl font-black">{showEntreprise.progressTravaux || 0}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: `${showEntreprise.progressTravaux || 0}%` }}></div>
                    </div>
                  </div>
                </div>
                <div className="pt-8 border-t border-white/10">
                  <p className="text-[8px] font-black uppercase opacity-40 mb-2">Estimation Financière</p>
                  <p className="text-lg font-black text-amber-500">{showEntreprise.financialEstimation || "--"}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-8 mb-12">
              <div className="flex flex-col items-center p-8 bg-white border border-slate-100 rounded-[40px] shadow-sm">
                <CircularProgress value={showEntreprise.progressTravaux || 0} size={120} strokeWidth={12} color="#ef4444" />
                <p className="mt-4 text-[10px] font-black text-slate-900 uppercase tracking-widest">Travaux</p>
              </div>
              <div className="flex flex-col items-center p-8 bg-white border border-slate-100 rounded-[40px] shadow-sm">
                <CircularProgress 
                  value={showEntreprise.financialEstimation && showEntreprise.financialEstimation !== "--" ? 
                         Math.min(100, Math.round(((showEntreprise.totalDecomptes || 0) / parseFinancialValue(showEntreprise.financialEstimation)) * 100)) : 0} 
                  size={120} strokeWidth={12} color="#2563eb" 
                />
                <p className="mt-4 text-[10px] font-black text-slate-900 uppercase tracking-widest">Financier</p>
              </div>
              <div className="flex flex-col items-center p-8 bg-white border border-slate-100 rounded-[40px] shadow-sm">
                <CircularProgress 
                  value={showEntreprise.startDate && showEntreprise.startDate !== "--" && showEntreprise.delaiPrevisionnel && showEntreprise.delaiPrevisionnel !== "--" ? 
                         calculateEndDate(showEntreprise.startDate, showEntreprise.delaiPrevisionnel).progress : 0} 
                  size={120} strokeWidth={12} color="#d97706" 
                />
                <p className="mt-4 text-[10px] font-black text-slate-900 uppercase tracking-widest">Temps</p>
              </div>
            </div>

            <div className="bg-slate-50 p-10 rounded-[40px] border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Description des Travaux</p>
              <p className="text-sm text-slate-700 leading-relaxed italic">"{showEntreprise.description || "Aucune description disponible."}"</p>
            </div>

            <div className="mt-12 flex justify-between items-center text-[8px] font-black text-slate-300 uppercase tracking-[0.5em]">
              <span>DGPC DASHBOARD v5.0</span>
              <span>CONFIDENTIEL</span>
            </div>
          </div>
        </div>
      )}

      {selectedStakeholder && (
        <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedStakeholder(null)}>
           <div className="w-full max-w-lg bg-white rounded-[30px] overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="bg-slate-900 p-4 text-white flex justify-between items-center"><div className="flex items-center gap-3"><Info size={16} /><h3 className="font-black uppercase text-[9px] tracking-widest">Détails Intervenant</h3></div><button onClick={() => { playClick(); setSelectedStakeholder(null); }} className="p-2 hover:bg-white/10 rounded-full"><X size={18}/></button></div>
              <div className="p-5 space-y-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
                 {(() => {
                    const statusUpper = (selectedStakeholder.status || "").toUpperCase().trim();
                    const isSansArchi = statusUpper.includes("SANS ARCHITECTE") || statusUpper === "S/A" || statusUpper === "S.A";
                    const displayName = isSansArchi ? "--" : (selectedStakeholder.name || "--");
                    const displayStatus = isSansArchi ? "Sans architecte" : selectedStakeholder.status;
                    return (
                      <>
                        <div className="mb-3">
                          <p className="text-[7px] font-bold text-red-600 uppercase tracking-widest mb-0.5">{selectedStakeholder.role}</p>
                          <h2 className={`text-lg font-black uppercase leading-tight text-slate-900`}>{isSansArchi ? "--" : selectedStakeholder.name}</h2>
                          <div className={`mt-3 inline-block py-2 px-4 rounded-2xl ${isSansArchi ? 'bg-slate-400' : 'bg-red-50 text-red-600'} text-white text-[9px] font-black uppercase tracking-widest`}>
                            {isSansArchi ? "Sans architecte" : selectedStakeholder.status}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 border-t border-slate-100 pt-3">
                           <DetailRow icon={Phone} label="FAX / TÉL" value={selectedStakeholder.faxTel} />
                           <DetailRow icon={Mail} label="EMAIL" value={selectedStakeholder.email} />
                           <DetailRow icon={FileText} label="N° AOO" value={selectedStakeholder.nAoo} />
                           <DetailRow icon={FileText} label="N° MARCHÉ" value={selectedStakeholder.nMarche} />
                           <DetailRow icon={Layers} label="DOCUMENTS" value={selectedStakeholder.documents} />
                           <DetailRow icon={Calendar} label="VISITE PRÉVUE" value={selectedStakeholder.visitePrevue} />
                           <DetailRow icon={Calendar} label="OUVERTURE PLIS" value={selectedStakeholder.dateOuverturePlis} />
                           {selectedStakeholder.visa && <DetailRow icon={FileCheck} label="VISA BCT" value={selectedStakeholder.visa} />}
                           {selectedStakeholder.notice && <DetailRow icon={Info} label="NOTICE BET" value={selectedStakeholder.notice} />}
                        </div>
                      </>
                    );
                 })()}
              </div>
           </div>
        </div>
      )}

      {showTechStudies && (
        <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowTechStudies(null)}>
           <div className="w-full max-w-lg bg-white rounded-[35px] p-5 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center"><FlaskConical size={18}/></div><h3 className="font-black uppercase text-[10px] text-slate-900">Études Techniques</h3></div><button onClick={() => { playClick(); setShowTechStudies(null); }} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button></div>
              <div className="space-y-3"><StudyItem study={showTechStudies.topographicStudy} icon={Map} /><StudyItem study={showTechStudies.geotechnicalStudy} icon={HardHat} /></div>
           </div>
        </div>
      )}

      {showMap && (
        <div className="fixed inset-0 z-[2500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowMap(null)}>
           <div className="w-full max-w-3xl bg-white rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <Map size={24} className="text-red-500" />
                    <div>
                       <h3 className="font-black uppercase text-[10px] tracking-widest opacity-60">Localisation Google Maps</h3>
                       <p className="text-sm font-black uppercase tracking-tight">{showMap.name}</p>
                    </div>
                 </div>
                 <button onClick={() => { playClick(); setShowMap(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
              </div>
              <div className="aspect-video w-full bg-slate-100 relative">
                 {showMap.maps && showMap.maps !== "--" ? (
                    <iframe 
                       width="100%" 
                       height="100%" 
                       style={{ border: 0 }} 
                       loading="lazy" 
                       allowFullScreen 
                       referrerPolicy="no-referrer-when-downgrade"
                       src={showMap.maps.startsWith('http') ? showMap.maps : `https://www.google.com/maps?q=${encodeURIComponent(showMap.maps)}&output=embed`}
                    ></iframe>
                 ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
                       <Map size={48} className="opacity-20" />
                       <p className="text-[10px] font-black uppercase tracking-widest">Aucune donnée de localisation disponible</p>
                    </div>
                 )}
              </div>
              <div className="p-4 bg-slate-50 flex justify-center">
                 <button onClick={() => { playClick(); setShowMap(null); }} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-all active:scale-95 shadow-lg">Fermer</button>
              </div>
           </div>
        </div>
      )}

      {pdfProgress && (
        <div className="fixed inset-0 z-[6000] bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-10 text-center">
           <Loader2 size={50} className="text-orange-500 animate-spin mb-6" />
           <h3 className="text-white font-black text-xl mb-2 uppercase tracking-tight">Génération du Rapport PDF</h3>
           <p className="text-slate-400 font-bold text-[9px] uppercase tracking-[0.4em]">Fiche {pdfProgress.current} sur {pdfProgress.total}</p>
        </div>
      )}

      <div id="zoom-wrapper" className="custom-scrollbar">
        <div id="zoom-container" style={{ transform: `scale(${zoomScale})`, alignItems: 'center' }}>
          <div className="mx-auto w-full max-w-3xl p-3 md:p-6 pt-5">
            <div className={`flex items-center w-full max-w-xl mx-auto ${currentTheme.cardBg} rounded-[20px] p-2 border ${currentTheme.borderColor} shadow-sm mb-6 no-print`}>
              <Search size={18} className="text-slate-400 ml-2" />
              <input type="text" placeholder="Rechercher un centre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`flex-1 bg-transparent border-none outline-none px-3 py-2 text-sm ${currentTheme.textColor} placeholder-slate-400`} />
              {searchTerm && <button onClick={() => setSearchTerm("")} className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors mr-2"><X size={16} /></button>}
            </div>

            {selectedProject ? (
               <>
                  <div className="flex justify-between items-center w-full max-w-[240px] mx-auto bg-white shadow-xl rounded-[20px] p-1.5 border border-slate-50 mb-6 sticky top-2 z-[200] no-print">
                     <button onClick={handlePrev} className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-red-600 transition-all active:scale-90 shadow-sm"><ChevronLeft size={18}/></button>
                     <div className="flex-1 text-center"><p className="text-[6px] font-black uppercase tracking-[0.3em] text-slate-400">Opération</p><div className="text-[10px] font-black text-slate-900">{filteredProjects.indexOf(selectedProject) + 1} / {filteredProjects.length}</div></div>
                     <button onClick={handleNext} className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-red-600 transition-all active:scale-90 shadow-sm"><ChevronRight size={18}/></button>
                  </div>
                  <DetailView 
                    project={selectedProject} 
                    theme={currentTheme} 
                    isDownloading={false} 
                    onDownloadImg={handleDownloadSingleA4} 
                    onStakeholderClick={(s: any) => { playClick(); setSelectedStakeholder(s); }} 
                    onTechStudiesClick={() => { playClick(); setShowTechStudies(selectedProject); }} 
                    onEntrepriseClick={() => { playClick(); setShowEntreprise(selectedProject); }} 
                    onMapClick={() => { playClick(); setShowMap(selectedProject); }}
                  />
               </>
            ) : <div className="h-[40vh] flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={24} /></div>}

            {filteredProjects.length > 0 && (
              <div className="mt-10 pb-20 px-1 no-print border-t border-slate-200/40 pt-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3"><div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-md"><Database size={14}/></div><h2 className={`text-[11px] font-black uppercase tracking-tighter ${currentTheme.textColor}`}>Catalogue des centres</h2></div>
                  <div className="px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest">{filteredProjects.length} Centres</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProjects.map(p => (
                    <button key={p.id} onClick={() => { playClick(); setSelectedProjectId(p.id); window.scrollTo({top:0, behavior:'smooth'}); }} className={`group relative p-6 pt-8 rounded-[30px] border text-left transition-all ${selectedProjectId === p.id ? `border-red-600 ${currentTheme.cardBg} shadow-md shadow-red-50/50` : `border-transparent ${currentTheme.cardBg} shadow-sm hover:border-slate-200`}`}>
                      <div className={`status-dot absolute top-6 left-6 w-2.5 h-2.5 rounded-full ${getProgressColor((p.progressEtude + p.progressCPS + p.progressValidation) / 3)} ring-2 ring-white shadow-sm`}></div>
                      <h4 className={`text-[10px] font-black uppercase leading-tight ${currentTheme.textColor}`}>{p.name}</h4>
                      <p className={`text-[7px] font-black uppercase opacity-40 mt-2 tracking-wider ${currentTheme.textColor}`}>{p.convention}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="portrait-capture-mode" ref={captureHiddenRef} style={{ fontFamily: selectedFont }}>
        {exportingProject && <DetailView project={exportingProject} theme={THEMES[0]} isDownloading={true} onDownloadImg={()=>{}} onStakeholderClick={()=>{}} onTechStudiesClick={()=>{}} onEntrepriseClick={()=>{}} />}
      </div>

      <div className="fixed bottom-5 right-5 z-[4500] flex flex-col items-end gap-2.5 no-print">
        {showFloatingMenu && (
          <div className="flex flex-col gap-2.5 mb-2.5 animate-in slide-in-from-bottom-4 duration-300">
             <div className="flex gap-2.5"><button onClick={() => { playClick(); setZoomScale(Math.min(1.5, zoomScale + 0.1)); }} className="bg-slate-900 text-white p-3.5 rounded-full shadow-lg ring-2 ring-white hover:bg-red-600"><ZoomIn size={18} /></button><button onClick={() => { playClick(); setZoomScale(Math.max(0.4, zoomScale - 0.1)); }} className="bg-slate-900 text-white p-3.5 rounded-full shadow-lg ring-2 ring-white hover:bg-red-600"><ZoomOut size={18} /></button></div>
             <button onClick={() => { playClick(); setShowFutureDates(true); }} className="bg-red-600 text-white p-3.5 rounded-xl shadow-lg flex items-center gap-2.5 font-black uppercase text-[9px] ring-2 ring-white hover:bg-red-700 transition-all"><Bell size={18} /> <span>Alertes</span></button>
             <button onClick={toggleFullscreen} className="bg-indigo-600 text-white p-3.5 rounded-xl shadow-lg flex items-center gap-2.5 font-black uppercase text-[9px] ring-2 ring-white hover:bg-indigo-700 transition-all">{isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />} <span>Mode</span></button>
             <button onClick={() => { playClick(); setShowPdfOptions(true); }} className="bg-orange-600 text-white p-3.5 rounded-xl shadow-lg flex items-center gap-2.5 font-black uppercase text-[9px] ring-2 ring-white hover:bg-orange-700 transition-all"><FileType size={18} /> <span>Export</span></button>
             <button onClick={() => { playClick(); loadInitialData(); }} className="bg-emerald-600 text-white p-3.5 rounded-xl shadow-lg flex items-center gap-2.5 font-black uppercase text-[9px] ring-2 ring-white hover:bg-emerald-700 transition-all"><RefreshCw size={18} /> <span>Sync</span></button>
             <button onClick={() => { playClick(); setShowThemePicker(true); }} className="bg-blue-600 text-white p-3.5 rounded-xl shadow-lg flex items-center gap-2.5 font-black uppercase text-[9px] ring-2 ring-white hover:bg-blue-700 transition-all"><Palette size={18} /> <span>Style</span></button>
          </div>
        )}
        <button onClick={() => { playClick(); setShowFloatingMenu(!showFloatingMenu); }} className={`bg-red-600 text-white p-4 rounded-full shadow-xl ring-2 ring-white transition-all active:scale-90 ${showFloatingMenu ? 'rotate-45' : ''}`}><Settings size={20} /></button>
      </div>
    </div>
  );
}

function DetailView({ project, theme, isDownloading, onDownloadImg, onStakeholderClick, onTechStudiesClick, onEntrepriseClick, onMapClick }: any) {
  const stakeholders = useMemo(() => project.stakeholders.filter((s: Stakeholder) => !s.role.toUpperCase().includes("VISA BCT")), [project.stakeholders]);
  const phases = useMemo(() => project.phases, [project.phases]);

  if (isDownloading) {
    return (
      <div className="flex flex-col w-full h-full bg-white">
        <h1 className="text-3xl font-black uppercase mb-2">{project.name}</h1>
        <div className="flex items-center gap-3 mb-6"><div className="w-1.5 h-6 bg-red-600"></div><span className="text-red-600 font-black text-lg uppercase">{project.convention}</span></div>
        <div className="p-6 border border-slate-200 rounded-3xl mb-6">
            <h4 className="font-black text-lg uppercase mb-4">Intervenants</h4>
            <div className="grid grid-cols-3 gap-3">
                {stakeholders.slice(0, 3).map((s: Stakeholder, i: number) => {
                    const statusUpper = s.status.toUpperCase().trim();
                    const isSansArchi = statusUpper.includes("SANS ARCHITECTE") || statusUpper === "S/A" || statusUpper === "S.A";
                    const displayStatus = isSansArchi ? "Sans architecte" : s.status;
                    return (
                        <div key={i} className="p-4 border border-slate-200 rounded-2xl h-40 flex flex-col justify-between">
                            <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">{s.role}</p>
                                <p className={`text-sm font-black uppercase mt-2 ${isSansArchi ? 'text-slate-900' : 'text-slate-900'}`}>{isSansArchi ? "--" : s.name}</p>
                            </div>
                            <div className={`py-2 rounded-2xl ${isSansArchi ? 'bg-slate-400' : getStatusColorConfig(s.status).bg} text-white text-center font-bold text-[9px] uppercase`}>
                                {isSansArchi ? "Sans architecte" : s.status}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
        <div className="p-6 border border-slate-200 rounded-3xl mb-6">
            <h4 className="font-black text-lg uppercase mb-4">Avancement</h4>
            <div className="space-y-4">
                <ProgressBarPDF label="Phase Étude" value={project.progressEtude} />
                <ProgressBarPDF label="Réalisé CPS" value={project.progressCPS} />
                <ProgressBarPDF label="Validation CSP/TM" value={project.progressValidation} />
            </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
            {phases.slice(0, 3).map((ph: any, i: number) => (
                <div key={i} className="p-4 border border-slate-200 rounded-2xl text-center">
                    <p className="text-[8px] font-bold text-slate-400 uppercase">{ph.label}</p>
                    <div className={`mt-2 py-2 rounded-lg ${getStatusColorConfig(ph.value).bg} text-white font-bold text-[9px]`}>{ph.value}</div>
                </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="mb-6 space-y-1.5">
        <h1 className={`text-xl md:text-3xl font-black uppercase tracking-tighter leading-tight ${theme.textColor}`}>{project.name}</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`w-1 h-5 ${theme.primary} rounded-full`}></div>
          <span className={`text-[11px] md:text-sm font-black uppercase tracking-widest ${theme.accent}`}>{project.convention}</span>
          {project.entreprise && project.entreprise !== "--" && (
            <button onClick={() => onEntrepriseClick(project)} className="ml-2 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl font-black uppercase text-[9px] tracking-wider flex items-center gap-1.5 hover:bg-slate-200 transition-all shadow-sm active:scale-95"><Briefcase size={12} /> <span>Entreprise</span></button>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onDownloadImg} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[8px] tracking-widest flex items-center gap-2.5 shadow-lg active:scale-95 transition-all"><FileImage size={16} /> <span>Rapport</span></button>
          <button onClick={onTechStudiesClick} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[8px] tracking-widest flex items-center gap-2.5 shadow-lg active:scale-95 transition-all"><FlaskConical size={16} /> <span>Études</span></button>
          <button onClick={onMapClick} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[8px] tracking-widest flex items-center gap-2.5 shadow-lg active:scale-95 transition-all"><Map size={16} /> <span>Carte</span></button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <HardHat size={20} className={theme.accent} />
        <h4 className="farsi-bold text-lg uppercase tracking-tighter">Intervenants</h4>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6">
        {stakeholders.map((s: Stakeholder, i: number) => {
          const statusUpper = s.status.toUpperCase().trim();
          const isSansArchi = statusUpper.includes("SANS ARCHITECTE") || statusUpper === "S/A" || statusUpper === "S.A";
          const displayStatus = isSansArchi ? "Sans architecte" : s.status;
          const cfg = getStatusColorConfig(s.status);
          return (
            <button key={i} onClick={() => onStakeholderClick(s)} className={`group p-6 rounded-[20px] border text-left ${theme.borderColor} ${theme.cardBg} space-y-5 flex flex-col justify-between shadow-sm hover:border-red-600 transition-all active:scale-95`}>
               <div>
                 <p className="text-[6px] font-black opacity-40 uppercase tracking-widest mb-1">{s.role}</p>
                 <p className={`text-[11px] font-black uppercase tracking-tight ${theme.textColor}`}>{isSansArchi ? "--" : s.name}</p>
               </div>
               <div className={`py-2 px-2 rounded-2xl ${isSansArchi ? 'bg-slate-400' : cfg.bg} text-white text-center font-black text-[7px] uppercase tracking-widest`}>
                 {isSansArchi ? "Sans architecte" : s.status}
               </div>
            </button>
          );
        })}
      </div>

      <div className={`p-8 rounded-[25px] ${theme.cardBg} border ${theme.borderColor} mb-6 space-y-8 shadow-sm`}>
          <div className="flex items-center gap-3"><Activity size={24} className={theme.accent} /><h4 className="farsi-bold text-lg uppercase tracking-tighter">Avancement Global</h4></div>
          <div className="space-y-6">
            <ProgressBar label="Phase Étude" value={project.progressEtude} theme={theme} />
            <ProgressBar label="Réalisé CPS" value={project.progressCPS} theme={theme} />
            <ProgressBar label="Validation CSP/TM" value={project.progressValidation} theme={theme} />
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pb-16">
          {phases.map((ph: any, i: number) => (
            <div key={i} className={`p-6 rounded-[20px] border ${theme.borderColor} ${theme.cardBg} space-y-2`}>
              <p className="text-[6px] font-black opacity-40 uppercase tracking-widest">{ph.label}</p>
              <div className={`py-1.5 px-2 rounded-lg ${getStatusColorConfig(ph.value).bg} text-white text-center font-black text-[6px] uppercase`}>{ph.value}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

const CircularProgress = ({ value, color = "#ef4444", size = 60, strokeWidth = 6, label }: { value: number, color?: string, size?: number, strokeWidth?: number, label?: string }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="rotate-[-90deg]" width={size} height={size}>
          <circle
            className="text-slate-100"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            style={{ stroke: color, transition: 'stroke-dashoffset 1s ease-in-out' }}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-900">
          {value}%
        </div>
      </div>
      {label && <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{label}</span>}
    </div>
  );
};

function DetailRow({ icon: Icon, label, value }: { icon: any, label: string, value?: string }) {
  const isFuture = parseAndCheckFuture(value);
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isFuture ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}><Icon size={18}/></div>
      <div className="flex-1"><p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p><p className={`text-[10px] font-black uppercase ${isFuture ? 'text-red-600' : 'text-slate-900'}`}>{value || "--"}</p></div>
    </div>
  );
}

function StudyItem({ study, icon: Icon }: { study: TechnicalStudy, icon: any }) {
  return (
    <div className="bg-slate-50 p-5 rounded-[25px] border border-slate-100 space-y-4">
      <div className="flex justify-between items-center"><div className="flex items-center gap-3"><Icon size={20} className="text-slate-900" /><div><span className="text-[8px] font-black text-slate-400 uppercase">{study.label}</span><p className="text-[11px] font-black uppercase">{study.attributaire || "--"}</p></div></div><div className={`px-2 py-1 rounded-lg text-[7px] font-black uppercase text-white ${study.isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}>{study.isPaid ? 'Payé' : 'À Régler'}</div></div>
      <div className="space-y-1.5"><div className="flex justify-between text-[8px] font-black uppercase"><span>Avancement</span><span>{study.progress}%</span></div><div className="h-2 bg-slate-200 rounded-full overflow-hidden"><div className={`h-full ${getProgressColor(study.progress)} transition-all duration-1000`} style={{width: `${study.progress}%`}}></div></div></div>
    </div>
  );
}

function ProgressBar({ label, value, theme }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center px-1"><span className={`text-[7px] font-black uppercase opacity-60 tracking-widest ${theme.textColor}`}>{label}</span><span className={`text-lg font-black ${theme.textColor}`}>{value}%</span></div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-50 shadow-inner"><div className={`h-full rounded-full ${getProgressColor(value)} transition-all duration-1000`} style={{width: `${value}%`}}></div></div>
    </div>
  );
}

function ProgressBarPDF({ label, value }: { label: string, value: number }) {
    return (
        <div className="w-full">
            <div className="flex justify-between items-end mb-2 px-1"><span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span><span className="text-lg font-black">{value}%</span></div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${getProgressColor(value)}`} style={{ width: `${value}%` }}></div></div>
        </div>
    )
}
