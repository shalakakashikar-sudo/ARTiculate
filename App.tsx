
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { ViewMode, ComicEntry, Folder } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import Gallery from './components/Gallery';
import ComicViewer from './components/ComicViewer';
import AdminPortal from './components/AdminPortal';

const App: React.FC = () => {
  const [comics, setComics] = useState<ComicEntry[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.VIEWER);
  const [session, setSession] = useState<any>(null);
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const loadData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const { data: foldersData, error: fError } = await supabase
        .from('folders')
        .select('*')
        .order('datecreated', { ascending: true });
      
      if (fError) throw fError;
      setFolders(foldersData || []);

      const { data: comicsData, error: cError } = await supabase
        .from('comics')
        .select('*')
        .order('date', { ascending: false });
      
      if (cError) throw cError;
      setComics(comicsData || []);
    } catch (e) {
      console.error("Supabase Load Error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setViewMode(ViewMode.VIEWER);
    });

    loadData();

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: passwordInput,
      });

      if (error) throw error;

      setShowLoginModal(false);
      setEmailInput('');
      setPasswordInput('');
      setViewMode(ViewMode.ADMIN);
    } catch (err: any) {
      setLoginError(err.message || "Invalid credentials.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setViewMode(ViewMode.VIEWER);
  };

  const handleDeleteComic = async (id: string) => {
    if (!isSupabaseConfigured) return;
    
    const comicToDelete = comics.find(c => c.id === id);
    if (!comicToDelete) return;

    try {
      // 1. Delete DB record
      // We don't check data length because RLS might prevent selecting the deleted row
      const { error: dbError } = await supabase
        .from('comics')
        .delete()
        .eq('id', id);
      
      if (dbError) {
        throw new Error(`Database Error: ${dbError.message}`);
      }

      // 2. Clean up storage (non-blocking)
      // Extract filename from the public URL if it's a Supabase hosted image
      if (comicToDelete.imageurl && comicToDelete.imageurl.includes('supabase.co')) {
        const urlParts = comicToDelete.imageurl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        if (fileName) {
          await supabase.storage.from('comics').remove([fileName]);
        }
      }

      // 3. Update local state
      setComics(prev => prev.filter(c => c.id !== id));
      console.log(`Comic ${id} deleted.`);
    } catch (err: any) {
      console.error("Delete Failed:", err);
      alert(`COULD NOT DELETE\n${err.message}`);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Update state
      setFolders(prev => prev.filter(f => f.id !== id));
      setComics(prev => prev.filter(c => c.folderid !== id));
      console.log(`Series ${id} and its contents removed.`);
    } catch (err: any) {
      console.error("Series Deletion Failed:", err);
      alert(`COULD NOT DELETE SERIES: ${err.message}`);
    }
  };

  const isAuthenticated = !!session;

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 bg-yellow-400 border-b-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3" onClick={() => setViewMode(ViewMode.VIEWER)}>
              <div className="bg-white border-2 border-black p-1 rotate-[-2deg] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:rotate-0 transition-transform">
                <span className="comic-title text-3xl font-black text-black px-2">ART<span className="text-red-600">iculate</span></span>
              </div>
            </Link>

            <nav className="flex items-center gap-2 md:gap-4">
              <Link 
                to="/" 
                onClick={() => setViewMode(ViewMode.VIEWER)} 
                className={`text-[10px] md:text-sm font-bold border-2 border-black px-4 py-2 transition-colors uppercase tracking-tight ${
                  viewMode === ViewMode.VIEWER ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-50'
                }`}
              >
                Gallery
              </Link>
              
              {isAuthenticated ? (
                <>
                  <button 
                    onClick={() => setViewMode(prev => prev === ViewMode.ADMIN ? ViewMode.VIEWER : ViewMode.ADMIN)}
                    className={`text-[10px] md:text-sm font-bold border-2 border-black px-4 py-2 transition-colors uppercase tracking-tight ${
                      viewMode === ViewMode.ADMIN ? 'bg-blue-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black hover:bg-slate-50'
                    }`}
                  >
                    {viewMode === ViewMode.ADMIN ? 'Previewing' : 'The Atelier'}
                  </button>
                  <button 
                    onClick={handleLogout} 
                    className="text-[10px] md:text-sm font-bold border-2 border-black bg-white px-4 py-2 hover:bg-red-500 hover:text-white transition-colors uppercase tracking-tight"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="text-[10px] md:text-sm font-bold bg-black text-white border-2 border-black px-4 py-2 hover:bg-slate-800 transition-colors uppercase tracking-tight shadow-[3px_3px_0px_0px_rgba(239,68,68,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
                >
                  Enter Atelier
                </button>
              )}
            </nav>
          </div>
        </header>

        <main className="flex-grow max-w-7xl mx-auto w-full p-4 md:p-8">
          {isLoading && (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin h-12 w-12 border-4 border-black border-t-yellow-400 rounded-full"></div>
            </div>
          )}
          
          <Routes>
            <Route path="/" element={
              !isLoading && (
                isAuthenticated && viewMode === ViewMode.ADMIN 
                  ? <AdminPortal 
                      comics={comics} 
                      folders={folders}
                      session={session}
                      onAdd={(c) => setComics(prev => [c, ...prev])} 
                      onUpdate={(c) => setComics(prev => prev.map(item => item.id === c.id ? c : item))}
                      onDelete={handleDeleteComic} 
                      onAddFolder={(f) => setFolders(prev => [...prev, f])}
                      onDeleteFolder={handleDeleteFolder}
                    />
                  : <Gallery comics={comics} folders={folders} />
              )
            } />
            <Route path="/comic/:id" element={<ComicViewer comics={comics} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {showLoginModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className={`bg-white border-4 border-black p-8 shadow-[12px_12px_0px_0px_rgba(234,179,8,1)] max-w-md w-full transition-transform ${loginError ? 'animate-shake' : 'animate-fadeIn'}`}>
              <h2 className="comic-title text-4xl mb-6 text-center">MASTER ARTIST LOGIN</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase mb-1 text-slate-500 tracking-widest">Email Address</label>
                  <input 
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full border-4 border-black p-3 font-bold focus:ring-4 ring-yellow-400 outline-none transition-all"
                    placeholder="artist@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase mb-1 text-slate-500 tracking-widest">Secret Password</label>
                  <input 
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full border-4 border-black p-3 font-bold focus:ring-4 ring-yellow-400 outline-none transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
                {loginError && (
                  <div className="bg-red-50 border-2 border-red-600 p-2 text-center">
                    <p className="text-red-600 font-black text-[10px] uppercase">
                      {loginError}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <button 
                    disabled={isLoggingIn}
                    type="button" 
                    onClick={() => { setShowLoginModal(false); setLoginError(null); }}
                    className="border-4 border-black font-black py-3 uppercase tracking-widest hover:bg-slate-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={isLoggingIn}
                    type="submit" 
                    className="bg-black text-white border-4 border-black font-black py-3 uppercase tracking-widest hover:bg-slate-800 shadow-[4px_4px_0px_0px_rgba(234,179,8,1)] disabled:opacity-50 active:shadow-none active:translate-x-1 active:translate-y-1"
                  >
                    {isLoggingIn ? 'Unlocking...' : 'Unlock'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <footer className="bg-black text-white p-8 mt-12">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
            <div className="flex flex-col items-center md:items-start">
              <div className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-1">
                A CREATIVE GALLERY TOOL FOR ARTISTS
              </div>
              <div className="marker-font text-yellow-400 text-xl tracking-wider">
                CREATED BY <span className="text-white border-b-2 border-red-600">SHALAKA KASHIKAR</span>
              </div>
            </div>
            
            <div className="flex flex-col items-center md:items-end gap-2 text-slate-400 text-sm">
              {!isAuthenticated && (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="text-[8px] font-black border border-slate-600 px-2 py-1 hover:border-white hover:text-white transition-colors uppercase mt-2 opacity-40 hover:opacity-100"
                >
                  Admin Portal Entry
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
