
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { ViewMode, ComicEntry, Folder } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import Gallery from './components/Gallery';
import ComicViewer from './components/ComicViewer';
import AdminPortal from './components/AdminPortal';

const App: React.FC = () => {
  const [comics, setComics] = useState<ComicEntry[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.VIEWER);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const ARTIST_KEY = "SKETCH2025";

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
        .order('datecreated', { ascending: true }); // Use lowercase
      
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
    const authStatus = sessionStorage.getItem('articulate_auth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    loadData();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcodeInput === ARTIST_KEY) {
      setIsAuthenticated(true);
      sessionStorage.setItem('articulate_auth', 'true');
      setViewMode(ViewMode.ADMIN);
      setShowLoginModal(false);
      setPasscodeInput('');
      setLoginError(false);
    } else {
      setLoginError(true);
      setTimeout(() => setLoginError(false), 500);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('articulate_auth');
    setViewMode(ViewMode.VIEWER);
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md w-full bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center">
          <h1 className="comic-title text-4xl mb-4 text-red-600">ACTION REQUIRED!</h1>
          <p className="font-bold mb-6">You need to connect your Supabase project keys in <code className="bg-slate-100 px-1">lib/supabase.ts</code> to start using the cloud archive.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full bg-black text-white font-black py-3 uppercase border-2 border-black hover:bg-slate-800"
          >
            I've Added Them! Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 bg-yellow-400 border-b-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3" onClick={() => setViewMode(ViewMode.VIEWER)}>
              <div className="bg-white border-2 border-black p-1 rotate-[-2deg] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <span className="comic-title text-3xl font-black text-black px-2">ART<span className="text-red-600">iculate</span></span>
              </div>
            </Link>

            <nav className="flex gap-4">
              <Link to="/" onClick={() => setViewMode(ViewMode.VIEWER)} className="text-sm font-bold bg-white border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors uppercase tracking-tight">Gallery</Link>
              
              {isAuthenticated ? (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setViewMode(prev => prev === ViewMode.ADMIN ? ViewMode.VIEWER : ViewMode.ADMIN)}
                    className={`text-sm font-bold border-2 border-black px-4 py-2 transition-colors uppercase tracking-tight ${
                      viewMode === ViewMode.ADMIN ? 'bg-blue-500 text-white' : 'bg-black text-white'
                    }`}
                  >
                    {viewMode === ViewMode.ADMIN ? 'View Gallery' : 'The Atelier'}
                  </button>
                  <button onClick={handleLogout} className="text-sm font-bold border-2 border-black bg-white px-4 py-2 hover:bg-red-500 hover:text-white transition-colors uppercase tracking-tight">
                    Logout
                  </button>
                </div>
              ) : null}
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
                      onAdd={(c) => setComics(prev => [c, ...prev])} 
                      onDelete={(id) => setComics(prev => prev.filter(c => c.id !== id))} 
                      onAddFolder={(f) => setFolders(prev => [...prev, f])}
                      onDeleteFolder={(id) => setFolders(prev => prev.filter(f => f.id !== id))}
                    />
                  : <Gallery comics={comics} folders={folders} />
              )
            } />
            <Route path="/comic/:id" element={<ComicViewer comics={comics} />} />
          </Routes>
        </main>

        {showLoginModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className={`bg-white border-4 border-black p-8 shadow-[12px_12px_0px_0px_rgba(234,179,8,1)] max-w-md w-full transition-transform ${loginError ? 'animate-bounce' : ''}`}>
              <h2 className="comic-title text-4xl mb-6 text-center">THE ATELIER ACCESS</h2>
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-xs font-black uppercase mb-2 tracking-widest text-slate-500">Secret sketchbook Passcode</label>
                  <input 
                    autoFocus
                    type="password"
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    className="w-full border-4 border-black p-4 text-2xl font-black text-center focus:outline-none focus:ring-4 ring-yellow-400"
                    placeholder="••••••••"
                  />
                </div>
                {loginError && (
                  <p className="text-red-600 font-black text-center animate-pulse uppercase text-sm italic">"Wrong Key, Villain! Access Denied!"</p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    type="button" 
                    onClick={() => { setShowLoginModal(false); setLoginError(false); }}
                    className="border-4 border-black font-black py-3 uppercase tracking-widest hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="bg-black text-white border-4 border-black font-black py-3 uppercase tracking-widest hover:bg-slate-800 shadow-[4px_4px_0px_0px_rgba(234,179,8,1)]"
                  >
                    Unlock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <footer className="bg-black text-white p-8 mt-12">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-slate-400 font-bold uppercase tracking-widest text-sm">
              Credits to <span className="text-yellow-400">Shalaka Kashikar</span>
            </div>
            <div className="flex gap-6 text-slate-400 text-sm items-center">
              <span className="italic">Connected to Cloud Archive</span>
              {!isAuthenticated && (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="text-[10px] font-black border border-slate-600 px-2 py-1 hover:border-white hover:text-white transition-colors uppercase"
                >
                  Enter The Atelier
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
