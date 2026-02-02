
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
      const { error: dbError } = await supabase
        .from('comics')
        .delete()
        .eq('id', id);
      
      if (dbError) throw new Error(`Database Error: ${dbError.message}`);

      if (comicToDelete.imageurl && comicToDelete.imageurl.includes('supabase.co')) {
        const urlParts = comicToDelete.imageurl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        if (fileName) {
          await supabase.storage.from('comics').remove([fileName]);
        }
      }

      setComics(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      console.error("Delete Failed:", err);
      alert(`COULD NOT DELETE\n${err.message}`);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!isSupabaseConfigured) return;
    try {
      // Note: We delete the folder. Associated comics will remain in DB but with null folderid
      // because we want to avoid accidental bulk data loss unless explicitly requested.
      // However, to reflect this in UI, we update the local state.
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setFolders(prev => prev.filter(f => f.id !== id));
      // Update comics that were in this folder to be 'standalone'
      setComics(prev => prev.map(c => c.folderid === id ? { ...c, folderid: undefined } : c));
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
          <div className="max-w-7xl mx-auto px-4 h-24 md:h-20 flex items-center justify-between">
            <Link to="/" className="flex flex-col md:flex-row md:items-end gap-1 md:gap-3" onClick={() => setViewMode(ViewMode.VIEWER)}>
              <div className="bg-white border-2 border-black p-1 rotate-[-2deg] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:rotate-0 transition-transform">
                <span className="comic-title text-2xl md:text-3xl font-black text-black px-2">ART<span className="text-red-600">iculate</span></span>
              </div>
              <span className="marker-font text-[9px] md:text-[10px] uppercase text-slate-800 font-bold mb-1 opacity-60">by Shalaka Kashikar</span>
            </Link>

            <nav className="flex items-center gap-2 md:gap-4">
              <Link 
                to="/" 
                onClick={() => setViewMode(ViewMode.VIEWER)} 
                className={`text-[9px] md:text-xs font-bold border-2 border-black px-3 py-2 transition-all uppercase tracking-tight ${
                  viewMode === ViewMode.VIEWER ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-50'
                }`}
              >
                Gallery
              </Link>
              
              {isAuthenticated ? (
                <>
                  <button 
                    onClick={() => setViewMode(prev => prev === ViewMode.ADMIN ? ViewMode.VIEWER : ViewMode.ADMIN)}
                    className={`text-[9px] md:text-xs font-bold border-2 border-black px-3 py-2 transition-all uppercase tracking-tight ${
                      viewMode === ViewMode.ADMIN ? 'bg-blue-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black hover:bg-slate-50'
                    }`}
                  >
                    {viewMode === ViewMode.ADMIN ? 'Previewing' : 'Atelier'}
                  </button>
                  <button 
                    onClick={handleLogout} 
                    className="text-[9px] md:text-xs font-bold border-2 border-black bg-white px-3 py-2 hover:bg-red-500 hover:text-white transition-all uppercase tracking-tight"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="text-[9px] md:text-xs font-bold bg-black text-white border-2 border-black px-3 py-2 hover:bg-slate-800 transition-all uppercase tracking-tight shadow-[2px_2px_0px_0px_rgba(239,68,68,1)] active:shadow-none"
                >
                  Enter Atelier
                </button>
              )}
            </nav>
          </div>
        </header>

        <main className="flex-grow max-w-[1440px] mx-auto w-full px-8 py-6 md:px-20 md:py-10 overflow-visible relative">
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
            <div className="bg-white border-4 border-black w-full max-w-md p-8 shadow-[12px_12px_0px_0px_rgba(251,191,36,1)] animate-fadeIn">
              <div className="flex justify-between items-center mb-6">
                <h2 className="comic-title text-4xl uppercase">The Atelier</h2>
                <button onClick={() => setShowLoginModal(false)} className="text-2xl font-black">X</button>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase mb-1">Archive Email</label>
                  <input 
                    type="email" 
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full border-2 border-black p-3 font-bold focus:ring-4 ring-yellow-400 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase mb-1">Keyphrase</label>
                  <input 
                    type="password" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full border-2 border-black p-3 font-bold focus:ring-4 ring-yellow-400 outline-none"
                    required
                  />
                </div>
                {loginError && <p className="text-red-600 text-[10px] font-black uppercase italic">{loginError}</p>}
                <button 
                  type="submit" 
                  disabled={isLoggingIn}
                  className="w-full bg-black text-white border-2 border-black py-4 font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-[4px_4px_0px_0px_rgba(239,68,68,1)] disabled:opacity-50"
                >
                  {isLoggingIn ? 'AUTHENTICATING...' : 'OPEN ARCHIVE'}
                </button>
              </form>
            </div>
          </div>
        )}

        <footer className="bg-white border-t-4 border-black py-12">
          <div className="max-w-7xl mx-auto px-4 text-center space-y-3">
             <div className="comic-title text-xl md:text-3xl uppercase italic tracking-tight">
               ART<span className="text-red-600">iculate</span> Archive &copy; {new Date().getFullYear()}
             </div>
             <div className="marker-font text-xs md:text-sm text-slate-500 uppercase tracking-tighter">
               Brought to life by <span className="text-black font-black underline decoration-red-600 decoration-2 underline-offset-4">Shalaka Kashikar</span>
             </div>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
