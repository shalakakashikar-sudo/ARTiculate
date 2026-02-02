
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ComicEntry, Folder } from '../types';

interface GalleryProps {
  comics: ComicEntry[];
  folders: Folder[];
}

const GalleryCard: React.FC<{ comic: ComicEntry }> = ({ comic }) => {
  const displayUrl = comic.thumbnailurl || (comic.mimetype.startsWith('image/') ? comic.imageurl : null);

  return (
    /* Wrapper with generous padding to contain the 10px pop-shadow */
    <div className="p-4 md:p-6 overflow-visible">
      <Link 
        to={`/comic/${comic.id}`}
        className="group block bg-white border-[3px] border-black p-2 transition-all duration-300 hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transform-gpu"
        style={{ backfaceVisibility: 'hidden' }}
        title={comic.title}
      >
        <div className="relative flex flex-col h-full overflow-hidden">
          {/* Dynamic Image Container */}
          <div className="relative bg-slate-100 flex items-center justify-center overflow-hidden halftone-overlay border-b-[3px] border-black aspect-square md:aspect-auto">
            {displayUrl ? (
              <img 
                src={displayUrl} 
                alt={comic.title} 
                className="w-full h-full object-cover prevent-save transition-transform duration-700 group-hover:scale-105"
                onContextMenu={(e) => e.preventDefault()}
              />
            ) : (
              <div className="py-20 text-center opacity-20">
                <span className="comic-title text-3xl text-red-600 italic uppercase">Log</span>
              </div>
            )}
            
            {comic.mimetype === 'application/pdf' && (
              <div className="absolute top-2 right-2 bg-red-600 border-2 border-black px-2 py-1 text-[10px] font-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                PDF
              </div>
            )}
          </div>
          
          {/* Exhibition Label */}
          <div className="bg-white pt-4 pb-2 px-1">
            <h3 className="comic-title text-xl uppercase truncate leading-none mb-2 group-hover:text-blue-600 transition-colors">
              {comic.title}
            </h3>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {new Date(comic.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
              </span>
              {comic.tags.length > 0 && (
                <span className="text-[9px] font-black uppercase bg-yellow-400 px-1.5 py-0.5 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                  #{comic.tags[0]}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

const Gallery: React.FC<GalleryProps> = ({ comics, folders }) => {
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    comics.forEach(c => c.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [comics]);

  const filteredComics = useMemo(() => {
    return comics.filter(c => {
      const matchesFolder = !activeFolderId || c.folderid === activeFolderId;
      const matchesSearch = !searchQuery || 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = !selectedTag || c.tags.includes(selectedTag);
      return matchesFolder && matchesSearch && matchesTag;
    });
  }, [comics, activeFolderId, searchQuery, selectedTag]);

  const activeFolder = folders.find(f => f.id === activeFolderId);

  return (
    <div className="flex flex-col lg:flex-row gap-10 animate-fadeIn overflow-visible">
      {/* Sidebar Navigation */}
      <aside className="lg:w-72 flex-shrink-0 space-y-8">
        
        <div className="relative">
          <input 
            type="text" 
            placeholder="SEARCH ARCHIVE..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-[3px] border-black p-4 text-xs font-black uppercase italic focus:outline-none ring-4 ring-transparent focus:ring-yellow-400 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
          />
        </div>

        <div className="bg-white border-[3px] border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="comic-title text-2xl mb-5 border-b-4 border-black pb-2 uppercase">Series</h2>
          <ul className="space-y-2">
            <li>
              <button 
                onClick={() => setActiveFolderId(null)}
                className={`w-full text-left font-black uppercase text-xs px-3 py-3 border-2 transition-all flex items-center justify-between ${!activeFolderId ? 'bg-black text-white border-black' : 'bg-slate-50 border-transparent hover:border-black'}`}
              >
                <span>The Full Feed</span>
                <span className="opacity-40">{comics.length}</span>
              </button>
            </li>
            {folders.map(f => {
              const count = comics.filter(c => c.folderid === f.id).length;
              return (
                <li key={f.id}>
                  <button 
                    onClick={() => setActiveFolderId(f.id)}
                    className={`w-full text-left font-black uppercase text-xs px-3 py-3 border-2 transition-all flex items-center justify-between ${activeFolderId === f.id ? 'bg-blue-600 text-white border-black' : 'bg-slate-50 border-transparent hover:border-black'}`}
                  >
                    <span className="truncate pr-2">{f.name}</span>
                    <span className="opacity-40">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="bg-yellow-400 border-[3px] border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="comic-title text-2xl mb-5 border-b-4 border-black pb-2 uppercase text-black">Tags</h2>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setSelectedTag(null)}
              className={`text-[10px] font-black uppercase px-3 py-1.5 border-2 transition-all ${!selectedTag ? 'bg-black text-white border-black' : 'bg-white border-black hover:bg-slate-50'}`}
            >
              All
            </button>
            {allTags.map(tag => (
              <button 
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`text-[10px] font-black uppercase px-3 py-1.5 border-2 transition-all ${selectedTag === tag ? 'bg-red-600 text-white border-black' : 'bg-white border-black hover:bg-slate-50'}`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Area - Strict 2-Column Grid for maximum stability */}
      <div className="flex-grow overflow-visible pr-8">
        {activeFolder && (
          <div className="mb-8 bg-white border-[3px] border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h1 className="comic-title text-4xl text-blue-600 uppercase leading-none">{activeFolder.name}</h1>
            <p className="marker-font text-sm text-slate-400 mt-3">{activeFolder.description || "Collection archive."}</p>
          </div>
        )}

        {(searchQuery || selectedTag) && (
          <div className="mb-6 flex items-center justify-between px-6">
             <div className="text-xs font-black uppercase tracking-widest italic">
                Filtering: <span className="text-red-600 underline ml-2">{searchQuery || `#${selectedTag}`}</span>
             </div>
             <button 
               onClick={() => {setSearchQuery(''); setSelectedTag(null);}}
               className="text-[10px] font-black uppercase underline hover:text-red-600"
             >
               Clear Filters
             </button>
          </div>
        )}

        {filteredComics.length === 0 ? (
          <div className="mx-6 text-center py-40 bg-white border-4 border-black border-dashed opacity-20">
            <h2 className="comic-title text-5xl uppercase italic tracking-tighter">The Void</h2>
          </div>
        ) : (
          /* Forcing 2 columns as requested. gap-2 md:gap-6 adds space between panels. */
          <div className="grid grid-cols-2 gap-2 md:gap-6 pb-10 overflow-visible">
            {filteredComics.map((comic) => (
              <GalleryCard key={comic.id} comic={comic} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Gallery;
