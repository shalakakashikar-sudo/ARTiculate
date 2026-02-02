
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ComicEntry } from '../types';

interface ComicViewerProps {
  comics: ComicEntry[];
}

const ComicViewer: React.FC<ComicViewerProps> = ({ comics }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [comic, setComic] = useState<ComicEntry | null>(null);

  useEffect(() => {
    const found = comics.find(c => c.id === id);
    if (found) {
      setComic(found);
    }
  }, [id, comics]);

  const openPdf = () => {
    if (!comic || !comic.imageurl) return;
    const win = window.open(comic.imageurl, '_blank');
    if (win) {
      win.focus();
    } else {
      alert("Pop-up blocked! Please allow pop-ups to read the chronicle.");
    }
  };

  // Prioritize the fixed high-res version if available
  const displayUrl = comic?.imageurl || comic?.thumbnailurl;

  if (!comic) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Comic not found!</h2>
        <Link to="/" className="text-blue-600 underline">Back to Gallery</Link>
      </div>
    );
  }

  const currentIndex = comics.findIndex(c => c.id === comic.id);
  const prevComic = currentIndex < comics.length - 1 ? comics[currentIndex + 1] : null;
  const nextComic = currentIndex > 0 ? comics[currentIndex - 1] : null;

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn mb-24">
      <div className="flex justify-between items-center mb-6">
        <Link to="/" className="text-sm font-bold text-slate-600 hover:text-black flex items-center gap-2">
          ← BACK TO FEED
        </Link>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {new Date(comic.date).toLocaleDateString('en-US', { dateStyle: 'full' })}
        </div>
      </div>

      <div className="bg-white border-4 border-black p-2 md:p-6 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] relative">
        <h1 className="comic-title text-4xl md:text-6xl mb-6 text-center border-b-4 border-black pb-4">
          {comic.title}
        </h1>

        <div className="relative mb-8 bg-slate-50 border-2 border-black min-h-[400px]">
          {/* 
            Even if the file was a PDF, the AdminPortal now converts it to a High-Res Image. 
            We show that image here because it has the FIXED colors.
          */}
          <div className="relative group">
            {displayUrl && (
              <img 
                src={displayUrl} 
                alt={comic.title} 
                className="w-full h-auto prevent-save"
                onContextMenu={(e) => e.preventDefault()}
              />
            )}
            {/* If the user really wants the original PDF, we can still provide a download link in the footer/meta */}
          </div>
        </div>

        <div className="prose max-w-none px-4">
          <p className="text-lg text-slate-700 leading-relaxed font-medium mb-4 italic">
            "{comic.description}"
          </p>
          <div className="flex flex-wrap gap-2 mb-8">
            {comic.tags.map(tag => (
              <span key={tag} className="text-xs font-bold bg-yellow-400 border border-black px-3 py-1 uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">#{tag}</span>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-8 border-t-4 border-black flex items-center justify-center gap-6">
          <button 
            disabled={!prevComic}
            onClick={() => navigate(`/comic/${prevComic?.id}`)}
            className="bg-white border-2 border-black px-8 py-3 font-black uppercase tracking-tighter hover:bg-black hover:text-white disabled:opacity-30 transition-all flex items-center gap-2"
          >
            ← PREV
          </button>
          <div className="h-10 w-1 bg-black hidden md:block"></div>
          <button 
            disabled={!nextComic}
            onClick={() => navigate(`/comic/${nextComic?.id}`)}
            className="bg-white border-2 border-black px-8 py-3 font-black uppercase tracking-tighter hover:bg-black hover:text-white disabled:opacity-30 transition-all flex items-center gap-2"
          >
            NEXT →
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComicViewer;
