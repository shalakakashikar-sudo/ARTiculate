
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

  // PERSISTENT DELETE HANDLERS
  const handleDeleteComic = async (id: string) => {
    if (!isSupabaseConfigured) return;
    
    const comicToDelete = comics.find(c => c.id === id);
    if (!comicToDelete) return;

    try {
      // 1. Delete from Database
      const { error: dbError } = await supabase.from('comics').delete().eq('id', id);
      if (dbError) throw dbError;

      // 2. Try to Delete from Storage (Cleanup)
      if (comicToDelete.imageurl) {
        // Extract filename from the public URL
        const urlParts = comicToDelete.imageurl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        if (fileName) {
          await supabase.storage.from('comics').remove([fileName]);
        }
      }

      setComics(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      console.error("Delete Comic Error:", err);
      alert(`Delete failed: ${err.message}. Check your Supabase RLS policies!`);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { error } = await supabase.from('folders').delete().eq('id', id);
      if (error) throw error;
      setFolders(prev => prev.filter(f => f.id !== id));
    } catch (err: any) {
      console.error("Delete Folder Error:", err);
      alert("Could not delete series. Ensure it is empty and you have DELETE permissions in Supabase.");
    }
  };

  const isAuthenticated = !!session;

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

        <footer className="bg-black text-white p-8 mt-12">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col items-center md:items-start">
              <div className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-1">
                A CREATIVE GALLERY TOOL FOR ARTISTS
              </div>
              <div className="marker-font text-yellow-400 text-xl tracking-wider">
                CREATED BY <span className="text-white border-b-2 border-red-600">SHALAKA KASHIKAR</span>
              </div>
            </div>
            
            <div className="flex gap-6 text-slate-400 text-sm items-center">
              {!isAuthenticated && (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="text-[10px] font-black border border-slate-600 px-2 py-1 hover:border-white hover:text-white transition-colors uppercase"
                >
                  Enter The Atelier
                </button>
              )}
              <span className="text-[10px] opacity-30 font-black uppercase tracking-tighter">© {new Date().getFullYear()}</span>
            </div>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
