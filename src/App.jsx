import React, { useState, useRef, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import './index.css';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  doc, updateDoc, deleteDoc, query 
} from 'firebase/firestore';
import { 
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut 
} from 'firebase/auth';
import { 
  Music, Plus, Trash2, Edit3, Play, Pause, 
  Box, FileAudio, ChevronLeft,
  ImageIcon, Loader2, Filter,
  Sun, Moon, Lock, LogOut, X, BoxSelect
} from 'lucide-react';

// --- KONFIGURASI FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCa_2i_z6xC2ka0KmNHcTbJYI-WZ3VV_tI",
  authDomain: "multimedia-8f0e2.firebaseapp.com",
  projectId: "multimedia-8f0e2",
  storageBucket: "multimedia-8f0e2.firebasestorage.app",
  messagingSenderId: "792545835400",
  appId: "1:792545835400:web:1a1bc834ca56fa05b1a23d",
  measurementId: "G-S5H2T9CZDK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app); 
const db = getFirestore(app); 

// --- HELPER: KONVERSI FILE KE BASE64 ---
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * KOMPONEN HALAMAN 3D EXPLORER
 */
const ThreeDExplorer = ({ instrument, onBack }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col md:flex-row overflow-hidden animate-in slide-in-from-bottom duration-500">
      <button 
        onClick={onBack}
        className="absolute top-8 left-8 z-50 flex items-center gap-2 bg-white/10 backdrop-blur-xl border border-white/20 px-6 py-4 rounded-3xl text-white hover:bg-white/20 transition-all font-bold uppercase text-xs tracking-widest"
      >
        <ChevronLeft size={18} /> Kembali ke Galeri
      </button>

      
      <div className="w-full md:w-2/3 h-[50vh] md:h-full relative bg-gradient-to-br from-indigo-950 via-slate-900 to-black flex items-center justify-center">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500 via-transparent to-transparent"></div>
        
        <div className="w-full h-full relative z-10">
        {instrument.model3dUrl ? (
        <model-viewer
        src={instrument.model3dUrl}
        camera-controls
        auto-rotate
        shadow-intensity="1"
        style={{ width: '100%', height: '100%', outline: 'none' }}
        >
        </model-viewer>
        ) : (
        <div className="text-white">Model tidak ditemukan</div>
        )}
  </div>
      </div>

      {/* Info Panel */}
      <div className="flex-1 bg-white dark:bg-slate-900 p-12 md:p-24 flex flex-col justify-center overflow-y-auto">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black tracking-widest uppercase">
              3D Interactive
            </span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest">{instrument.category}</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white leading-[0.85] uppercase tracking-tighter mb-6">
            {instrument.name}
          </h1>
          <p className="text-indigo-600 dark:text-indigo-400 font-black text-xl mb-10">{instrument.origin}</p>
          
          <div className="h-1 w-20 bg-slate-200 dark:bg-slate-800 mb-10"></div>
          
          <p className="text-slate-600 dark:text-slate-300 text-2xl leading-relaxed italic font-serif opacity-80 mb-12">
            "{instrument.desc}"
          </p>

          <div className="grid grid-cols-2 gap-4">
             <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                <p className="text-slate-900 dark:text-white font-bold">Terverifikasi</p>
             </div>
             <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Teknologi</p>
                <p className="text-slate-900 dark:text-white font-bold">GLTF / WebGL</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedInst, setSelectedInst] = useState(null);
  const [viewing3D, setViewing3D] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterType, setFilterType] = useState('Semua'); 
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Auth & CRUD Form State
  const [authData, setAuthData] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [formData, setFormData] = useState({
    name: '', origin: '', desc: '', category: 'Tradisional', audioUrl: '', imageUrl: '', model3dUrl: ''
  });

  const audioRef = useRef(new Audio());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      const collectionRef = collection(db, 'instruments');
      const q = query(collectionRef);
      const unsubSnap = onSnapshot(q, (snapshot) => {
        setInstruments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }, (err) => {
        console.error("Firestore error:", err);
        setLoading(false);
      });

      return () => unsubSnap();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    // Debugging: Muncul di Console (F12) untuk memastikan state berubah
    console.log("Dark Mode Is:", isDarkMode);
  }, [isDarkMode]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSaving(true);
    try {
      await signInWithEmailAndPassword(auth, authData.email, authData.password);
      setIsAuthModalOpen(false);
      setAuthData({ email: '', password: '' });
    } catch (err) {
      setAuthError("Email atau Password salah.");
    }
    setSaving(false);
  };

  const handleLogout = () => signOut(auth);

  const handleToggleAudio = (e, inst) => {
    if (e) e.stopPropagation();
    if (!inst.audioUrl) return;
    if (currentlyPlaying === inst.id) {
      audioRef.current.pause();
      setCurrentlyPlaying(null);
    } else {
      audioRef.current.src = inst.audioUrl;
      audioRef.current.play().catch(() => {});
      setCurrentlyPlaying(inst.id);
      audioRef.current.onended = () => setCurrentlyPlaying(null);
    }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1000000) return alert("File terlalu besar (Maks 1MB). Gunakan file yang lebih kecil.");
    
    try {
      const base64 = await fileToBase64(file);
      setFormData(prev => {
        const newData = { ...prev, [type]: base64 };
        if (type === 'model3dUrl' && base64) newData.category = '3D';
        return newData;
      });
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return alert("Hanya Admin yang diizinkan.");
    setSaving(true);
    
    const jsonString = JSON.stringify(formData);
    const sizeInBytes = new TextEncoder().encode(jsonString).length;
    console.log("Estimasi Ukuran Data:", sizeInBytes / 1024, "KB");

    if (sizeInBytes > 1000000) {
      setSaving(false);
      return alert("Total data (Gambar + Audio + 3D) terlalu besar. Kurangi salah satu.");
    }

    try {
      const finalData = { 
      ...formData, 
      category: formData.model3dUrl ? '3D' : formData.category,
      updatedAt: Date.now() 
      };

      if (editingId) {
        await updateDoc(doc(db, 'instruments', editingId), finalData);
      } else {
        await addDoc(collection(db, 'instruments'), { ...finalData, createdAt: Date.now() });
      }
      setIsModalOpen(false);
      setEditingId(null);
    } catch (err) { 
      console.error("error firebase:", err)
      alert("Gagal menyimpan data."); }
    setSaving(false);
  };

  const filteredInstruments = useMemo(() => {
    if (filterType === 'Semua') return instruments;
    return instruments.filter(i => i.category === filterType);
  }, [instruments, filterType]);

  if (loading) return (
    <div className={`min-h-screen flex flex-col items-center justify-center ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Loader2 className="animate-spin text-indigo-600 mb-6" size={48} />
      <p className="font-black tracking-[0.3em] text-[10px] uppercase opacity-40 italic">Mempersiapkan Laboratorium...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-500 pb-20">
      
      {/* {viewing3D && <ThreeDExplorer instrument={viewing3D} onBack={() => setViewing3D(null)} />} */}

      {/* HEADER */}
      <header className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 p-6 px-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-5">
            <div className="bg-indigo-600 p-3.5 rounded-3xl text-white shadow-2xl shadow-indigo-200 dark:shadow-none rotate-3 group hover:rotate-0 transition-transform cursor-pointer">
              <Music size={28} />
            </div>
            <div>
              <h1 className="font-black text-3xl tracking-tighter uppercase leading-none">Dunia Bunyi</h1>
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 tracking-[0.4em] uppercase">Digital Archive</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl text-slate-600 dark:text-slate-300 hover:scale-110 transition-all shadow-sm"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {!user ? (
               <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-3 px-6 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl text-slate-900 dark:text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
              >
                <Lock size={16} className="text-indigo-600" /> Login Admin
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { 
                    setEditingId(null); 
                    setFormData({name:'', origin:'', desc:'', category:'Tradisional', audioUrl:'', imageUrl:'', model3dUrl:''}); 
                    setIsModalOpen(true); 
                  }} 
                  className="bg-indigo-600 text-white px-8 py-4 rounded-3xl text-[10px] font-black flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none"
                >
                  <Plus size={18} strokeWidth={3} /> TAMBAH DATA
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-3xl hover:bg-red-100 transition-all border border-red-100 dark:border-red-900/40"
                >
                  <LogOut size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* FILTER CATEGORY */}
      <nav className="max-w-7xl mx-auto px-10 pt-16 flex flex-wrap gap-4">
        {/* {['Semua', 'Tradisional', 'Modern', '3D'].map((cat) =>  */}
        {['Semua', 'Tradisional', 'Modern',].map((cat) =>(
          <button
            key={cat}
            onClick={() => setFilterType(cat)}
            className={`px-10 py-5 rounded-full text-[10px] font-black transition-all tracking-[0.2em] uppercase border ${filterType === cat ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-2xl scale-105' : 'bg-transparent text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:border-indigo-400'}`}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* INSTRUMENT LISTING */}
      <main className="max-w-7xl mx-auto p-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
        {filteredInstruments.length === 0 ? (
          <div className="col-span-full py-48 text-center bg-white dark:bg-slate-900/50 rounded-[4rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <Filter size={64} className="text-slate-200 dark:text-slate-700 mx-auto mb-8" />
            <p className="text-slate-400 font-bold text-xl uppercase tracking-widest opacity-50">Belum ada koleksi {filterType}</p>
          </div>
        ) : filteredInstruments.map((inst) => (
          <div 
            key={inst.id} 
            
            // onClick={() => inst.model3dUrl ? setViewing3D(inst) : setSelectedInst(inst)}
            onClick={() => setSelectedInst(inst)}

            className="group bg-white dark:bg-slate-900 rounded-[3.5rem] border border-slate-100 dark:border-slate-800/50 overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-700 cursor-pointer relative flex flex-col h-full"
          >
            <div className="absolute top-8 right-8 z-10 flex flex-col gap-2 items-end">
              {/* <div className={`text-[9px] font-black px-5 py-2.5 rounded-full backdrop-blur-xl border border-white/20 shadow-lg ${inst.category === '3D' ? 'bg-indigo-600 text-white animate-pulse' : 'bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white'}`}>
                {inst.category.toUpperCase()}
              </div>
              {inst.model3dUrl && (
                <div className="bg-emerald-500 text-white p-2.5 rounded-2xl shadow-lg border border-white/20">
                  <Box size={14} />
                </div>
              )} */}
            </div>

            <div className="h-72 bg-slate-100 dark:bg-slate-800/50 relative overflow-hidden">
              {inst.imageUrl ? (
                <img src={inst.imageUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt={inst.name} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-200 dark:text-slate-700 font-black text-6xl
                 italic opacity-40">AUDIO</div>
              )}
              <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/10 transition-colors pointer-events-none"></div>
            </div>

            <div className="p-10 flex flex-col flex-grow">
              <p className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 tracking-[0.4em] mb-3 uppercase opacity-70">{inst.origin}</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight uppercase mb-8 tracking-tighter group-hover:text-indigo-600 transition-colors">{inst.name}</h3>
              
              <div className="mt-auto flex justify-between items-center">
                <div className="flex gap-3">
                  {user && (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingId(inst.id); setFormData({...inst}); setIsModalOpen(true); }}
                        className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); if(window.confirm("Hapus data ini selamanya?")) deleteDoc(doc(db, 'instruments', inst.id)); }}
                        className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                   {inst.model3dUrl && (
                     <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">
                        <BoxSelect size={22} />
                     </div>
                   )}
                   {inst.audioUrl && (
                    <button 
                      onClick={(e) => handleToggleAudio(e, inst)}
                      className={`p-5 rounded-2xl shadow-2xl transition-all active:scale-90 flex items-center justify-center ${currentlyPlaying === inst.id ? 'bg-red-500 text-white' : 'bg-slate-900 dark:bg-slate-700 text-white group-hover:bg-indigo-600'}`}
                    >
                      {currentlyPlaying === inst.id ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* LOGIN MODAL */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] w-full max-w-md p-12 shadow-2xl relative border border-white/10">
            <button onClick={() => setIsAuthModalOpen(false)} className="absolute top-10 right-10 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={24} />
            </button>

            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-500/40">
                <Lock size={36} />
              </div>
              <h2 className="text-4xl font-black uppercase tracking-tighter dark:text-white leading-none mb-2">Login Admin</h2>
              <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">Akses Panel Kontrol</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <input 
                type="email" required placeholder="admin@duniabunyi.com" 
                className="w-full p-6 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-100 dark:border-slate-700 rounded-3xl outline-none focus:border-indigo-500 font-bold transition-all"
                value={authData.email} onChange={(e) => setAuthData({...authData, email: e.target.value})}
              />
              <input 
                type="password" required placeholder="••••••••" 
                className="w-full p-6 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-100 dark:border-slate-700 rounded-3xl outline-none focus:border-indigo-500 font-bold transition-all"
                value={authData.password} onChange={(e) => setAuthData({...authData, password: e.target.value})}
              />
              {authError && <p className="text-red-500 text-[10px] font-black text-center uppercase tracking-widest bg-red-50 dark:bg-red-900/20 py-3 rounded-2xl">{authError}</p>}
              <button 
                type="submit" disabled={saving}
                className="w-full py-6 bg-indigo-600 text-white font-black rounded-3xl shadow-2xl active:scale-95 disabled:opacity-50 mt-4 uppercase tracking-[0.2em] text-[11px]"
              >
                {saving ? 'Otentikasi...' : 'Masuk Panel'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CRUD MODAL */}
      {isModalOpen && user && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[4rem] w-full max-w-2xl p-12 md:p-16 shadow-2xl border border-slate-100 dark:border-slate-800 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-12">
              <div>
                <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">{editingId ? 'Ubah Data' : 'Koleksi Baru'}</h2>
                <p className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black tracking-[0.4em] mt-3 uppercase">Master Database</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-5 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-900 transition-colors">
                <X size={28} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Nama Instrumen</label>
                <input required placeholder="Contoh: Gamelan" className="w-full p-6 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-100 dark:border-slate-700 rounded-[2rem] outline-none focus:border-indigo-500 font-bold" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Asal Daerah</label>
                  <input required placeholder="Jawa Tengah" className="w-full p-6 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-100 dark:border-slate-700 rounded-[2rem] outline-none focus:border-indigo-500 font-bold" value={formData.origin} onChange={(e) => setFormData({...formData, origin: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Kategori Dasar</label>
                  <select className="w-full p-6 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-100 dark:border-slate-700 rounded-[2rem] font-bold outline-none cursor-pointer" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                    <option value="Tradisional">Tradisional</option>
                    <option value="Modern">Modern</option>
                    <option value="3D">Wajib 3D</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Narasi Sejarah</label>
                <textarea 
                  required placeholder="Tuliskan deskripsi mendalam..." 
                  className="w-full p-8 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-100 dark:border-slate-700 rounded-[2.5rem] min-h-[160px] outline-none focus:border-indigo-500 text-lg italic font-serif leading-relaxed" 
                  value={formData.desc} onChange={(e) => setFormData({...formData, desc: e.target.value})}
                ></textarea>
              </div>
              
              <div className="grid grid-cols-3 gap-6">
                <label className={`group flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-800 border-2 border-dashed rounded-[2.5rem] cursor-pointer transition-all ${formData.imageUrl ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400'}`}>
                  <ImageIcon size={32} className={formData.imageUrl ? 'text-indigo-600' : 'text-slate-300 dark:text-slate-600 group-hover:text-indigo-400'} />
                  <span className="text-[9px] font-black uppercase mt-3 text-slate-400 group-hover:text-indigo-500 tracking-tighter text-center">Foto Instrumen</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'imageUrl')} />
                </label>

                <label className={`group flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-800 border-2 border-dashed rounded-[2.5rem] cursor-pointer transition-all ${formData.audioUrl ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 dark:border-slate-700 hover:border-emerald-400'}`}>
                  <FileAudio size={32} className={formData.audioUrl ? 'text-emerald-600' : 'text-slate-300 dark:text-slate-600 group-hover:text-emerald-400'} />
                  <span className="text-[9px] font-black uppercase mt-3 text-slate-400 group-hover:text-emerald-500 tracking-tighter text-center">Sampel Audio</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, 'audioUrl')} />
                </label>

                {/* <label className={`group flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-800 border-2 border-dashed rounded-[2.5rem] cursor-pointer transition-all ${formData.model3dUrl ? 'border-amber-500 bg-amber-50/30' : 'border-slate-200 dark:border-slate-700 hover:border-amber-400'}`}>
                  <Box size={32} className={formData.model3dUrl ? 'text-amber-600' : 'text-slate-300 dark:text-slate-600 group-hover:text-amber-400'} />
                  <span className="text-[9px] font-black uppercase mt-3 text-slate-400 group-hover:text-amber-500 tracking-tighter text-center">3D Model (GLB/OBJ)</span>
                  <input type="file" accept=".glb,.gltf,.obj" className="hidden" onChange={(e) => handleFileUpload(e, 'model3dUrl')} />
                </label> */}
              </div>

              <div className="pt-6">
                <button type="submit" disabled={saving} className="w-full py-8 bg-indigo-600 text-white font-black rounded-[2.5rem] shadow-2xl shadow-indigo-500/30 active:scale-95 disabled:opacity-50 uppercase tracking-[0.3em] text-xs">
                  {saving ? 'Sinkronisasi Database...' : 'Publikasikan ke Galeri'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {selectedInst && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-8 bg-slate-950/80 backdrop-blur-xl" onClick={() => setSelectedInst(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-[4.5rem] max-w-6xl w-full overflow-hidden flex flex-col md:flex-row shadow-2xl animate-in zoom-in duration-500 border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="md:w-[45%] h-96 md:h-auto bg-slate-100 dark:bg-slate-800 relative">
              {selectedInst.imageUrl ? <img src={selectedInst.imageUrl} className="w-full h-full object-cover" alt={selectedInst.name} /> : <div className="w-full h-full flex items-center justify-center opacity-10 font-black text-7xl italic text-center">COLLECTION</div>}
            </div>
            <div className="p-16 md:p-24 flex-1 flex flex-col justify-center relative bg-white dark:bg-slate-900">
              <button onClick={() => setSelectedInst(null)} className="absolute top-12 right-12 text-slate-300 hover:text-slate-900 transition-colors">
                <X size={32} />
              </button>
              
              <div className="mb-10 text-center md:text-left">
                <span className="text-indigo-600 dark:text-indigo-400 font-black text-[12px] tracking-[0.5em] uppercase block mb-4">{selectedInst.origin}</span>
                <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 dark:text-white leading-[0.8]">{selectedInst.name}</h2>
              </div>
              
              <div className="h-24 overflow-y-auto mb-10 pr-4 custom-scrollbar">
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-2xl italic font-serif opacity-90 whitespace-pre-wrap break-words">
                  "{selectedInst.desc}"
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {selectedInst.audioUrl && (
                  <button 
                    onClick={(e) => handleToggleAudio(e, selectedInst)} 
                    className={`w-full py-8 rounded-[2.5rem] flex items-center justify-center gap-6 text-white font-black transition-all shadow-2xl tracking-[0.2em] text-xs ${currentlyPlaying === selectedInst.id ? 'bg-red-500' : 'bg-slate-950 dark:bg-slate-700 hover:bg-indigo-600'}`}
                  >
                    {currentlyPlaying === selectedInst.id ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />} 
                    {currentlyPlaying === selectedInst.id ? 'HENTIKAN REKAMAN' : 'DENGARKAN BUNYI'}
                  </button>
                )}
                {/* {selectedInst.model3dUrl && (
                  <button 
                    onClick={() => { setSelectedInst(null); setViewing3D(selectedInst); }}
                    className="w-full py-8 rounded-[2.5rem] border-2 border-slate-900 dark:border-white text-slate-900 dark:text-white font-black flex items-center justify-center gap-6 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-all tracking-[0.2em] text-xs"
                  >
                    <Box size={24} /> EKSPLORASI MODEL 3D
                  </button>
                )} */}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #6366f1; border-radius: 20px; }
        @keyframes bounce {
          0%, 100% { transform: translateY(0) rotate(0); }
          50% { transform: translateY(-30px) rotate(10deg); }
        }
      `}</style>
    </div>
  );
}