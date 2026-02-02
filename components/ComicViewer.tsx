
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ComicEntry } from '../types';

// Setup PDF.js worker
if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
  (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

interface ComicViewerProps {
  comics: ComicEntry[];
}

const ComicViewer: React.FC<ComicViewerProps> = ({ comics }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [comic, setComic] = useState<ComicEntry | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [loadingPdf, setLoadingPdf] = useState(false);

  useEffect(() => {
    const found = comics.find(c => c.id === id);
    if (found) {
      setComic(found);
      setPdfPages([]); // Reset pages when switching comics
    }
  }, [id, comics]);

  /**
   * High-Fidelity PDF Multi-Page Renderer
   * Renders every page of the chronicle to a color-safe sRGB JPEG
   * using a "white foundation" pass to guarantee original artist colors.
   */
  const renderPdfChronicle = useCallback(async (url: string) => {
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) return;

    setLoadingPdf(true);
    try {
      const pdf = await pdfjsLib.getDocument(url).promise;
      const pagesCount = pdf.numPages;
      const renderedPages: string[] = [];

      // Loop through all pages to ensure the "Full Chronicle" is visible
      for (let i = 1; i <= pagesCount; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.5 }); // High-resolution render scale
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false });
        
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          // COLOR FIX: Fill with solid white first to fix CMYK transparency issues
          context.fillStyle = '#FFFFFF';
          context.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({ 
            canvasContext: context, 
            viewport: viewport,
            intent: 'display' // Optimize for screen color accuracy
          }).promise;
          
          renderedPages.push(canvas.toDataURL('image/jpeg', 0.92));
        }
      }
      setPdfPages(renderedPages);
    } catch (err) {
      console.error("PDF Rendering Failed:", err);
    } finally {
      setLoadingPdf(false);
    }
  }, []);

  useEffect(() => {
    if (comic && comic.mimetype === 'application/pdf' && comic.imageurl) {
      renderPdfChronicle(comic.imageurl);
    }
  }, [comic, renderPdfChronicle]);

  const openFullContent = () => {
    if (!comic || !comic.imageurl) return;
    const win = window.open(comic.imageurl, '_blank');
    if (win) {
      win.focus();
    } else {
      alert("Pop-up blocked! Please allow pop-ups to view the chronicle.");
    }
  };

  if (!comic) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Comic not found!</h2>
        <Link to="/" className="text-blue-600 underline">Back to Gallery</Link>
      </div>
    );
  }

  const isPdf = comic.mimetype === 'application/pdf';
  const currentIndex = comics.findIndex(c => c.id === comic.id);
  const prevComic = currentIndex < comics.length - 1 ? comics[currentIndex + 1] : null;
  const nextComic = currentIndex > 0 ? comics[currentIndex - 1] : null;

  return (
    <div className="max-w-[1200px] mx-auto animate-fadeIn mb-24 px-4 md:px-0">
      <div className="flex justify-between items-center mb-6">
        <Link to="/" className="text-sm font-bold text-slate-600 hover:text-black flex items-center gap-2">
          ← BACK TO FEED
        </Link>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {new Date(comic.date).toLocaleDateString('en-US', { dateStyle: 'full' })}
        </div>
      </div>

      <div className="bg-white border-4 border-black p-1 md:p-8 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] relative">
        <header className="mb-8 text-center border-b-4 border-black pb-6">
          <h1 className="comic-title text-5xl md:text-8xl mb-3 italic leading-tight">
            {comic.title}
          </h1>
          {isPdf && (
            <span className="text-[10px] md:text-xs font-black bg-blue-600 text-white px-4 py-1.5 uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] tracking-widest inline-block">
              Full Multi-Page Chronicle
            </span>
          )}
        </header>

        <div className="space-y-10 mb-12">
          {isPdf ? (
            <>
              {loadingPdf ? (
                <div className="py-60 text-center bg-slate-50 border-2 border-black border-dashed">
                  <div className="animate-spin h-12 w-12 border-4 border-black border-t-red-600 rounded-full mx-auto mb-6"></div>
                  <p className="comic-title text-2xl uppercase italic">Processing High-Def Pages...</p>
                </div>
              ) : (
                <div className="flex flex-col gap-12">
                  {pdfPages.map((pageUrl, idx) => (
                    <div key={idx} className="bg-white border-[3px] border-black overflow-hidden shadow-[10px_10px_0px_0px_rgba(0,0,0,0.05)]">
                      <img 
                        src={pageUrl} 
                        alt={`${comic.title} - Page ${idx + 1}`} 
                        className="w-full h-auto prevent-save block"
                        onContextMenu={(e) => e.preventDefault()}
                      />
                      <div className="bg-slate-50 border-t-2 border-black p-3 text-right">
                         <span className="text-[10px] font-black uppercase opacity-40">Section {idx + 1} of {pdfPages.length}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="bg-white border-[3px] border-black overflow-hidden shadow-[10px_10px_0px_0px_rgba(0,0,0,0.08)]">
              <img 
                src={comic.imageurl} 
                alt={comic.title} 
                className="w-full h-auto prevent-save block"
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
          )}
        </div>

        <div className="prose max-w-4xl mx-auto px-4 md:px-0">
          <div className="marker-font text-3xl text-blue-600 mb-4">Notes from the Artist</div>
          <p className="text-xl md:text-2xl text-slate-800 leading-relaxed font-medium mb-10 italic">
            "{comic.description}"
          </p>
          <div className="flex flex-wrap gap-3 mb-12">
            {comic.tags.map(tag => (
              <span key={tag} className="text-xs font-black bg-yellow-400 border-2 border-black px-4 py-2 uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">#{tag}</span>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 justify-center items-center py-10 border-t-4 border-black mb-10">
          {isPdf && (
            <button 
              onClick={openFullContent}
              className="bg-black text-white border-4 border-black px-12 py-5 font-black uppercase tracking-tighter text-base shadow-[8px_8px_0px_0px_rgba(239,68,68,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(239,68,68,1)] active:shadow-none transition-all"
            >
              Open Original PDF File
            </button>
          )}
        </div>

        <div className="pt-10 border-t-2 border-black border-dashed flex items-center justify-center gap-10">
          <button 
            disabled={!prevComic}
            onClick={() => navigate(`/comic/${prevComic?.id}`)}
            className="bg-white border-2 border-black px-10 py-4 font-black uppercase tracking-tighter hover:bg-black hover:text-white disabled:opacity-30 transition-all flex items-center gap-3 text-sm"
          >
            ← PREV STRIP
          </button>
          <div className="h-12 w-1.5 bg-black hidden md:block"></div>
          <button 
            disabled={!nextComic}
            onClick={() => navigate(`/comic/${nextComic?.id}`)}
            className="bg-white border-2 border-black px-10 py-4 font-black uppercase tracking-tighter hover:bg-black hover:text-white disabled:opacity-30 transition-all flex items-center gap-3 text-sm"
          >
            NEXT STRIP →
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComicViewer;
