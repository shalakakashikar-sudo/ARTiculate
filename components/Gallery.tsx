
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
    <Link 
      to={`/comic/${comic.id}`}
      className="group block bg-white border-2 border-black p-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(250,204,21,1)]"
      title={comic.title}
    >
      <div className="relative flex flex-col h-full overflow-hidden">
        {/* The Frame - aspect-square with object-contain for full visibility */}
        <div className="relative aspect-square bg-slate-50 flex items-center justify-center p-1.5 overflow-hidden">
          {displayUrl ? (
            <img 
              src={displayUrl} 
              alt={comic.title} 
              className="max-w-full max-h-full object-contain prevent-save transition-transform duration-500 group-hover:scale-110"
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : (
            <div className="text-center opacity-20">
              <span className="comic-title text-xl text-red-600 italic uppercase">Log</span>
            </div>
          )}
          
          {/* Subtle PDF Badge */}
          {comic.mimetype === 'application/pdf' && (
            <div className="absolute top-1 right-1 bg-red-600 border border-black px-1.5 py-0.5 text-[8px] font-black text-white">
              PDF
            </div>
          )}
        </div>
        
        {/* Minimalist Data Bar */}
        <div className="bg-white pt-2 pb-1 px-1 border-t border-slate-100">
          <h3 className="font-black text-[10px] uppercase truncate leading-none mb-1 group-hover:text-blue-600 transition-colors">
            {comic.title}
          </h3>
          <div className="flex justify-between items-center opacity-60">
            <span className="text-[8px] font-bold uppercase tracking-tighter">
              {new Date(comic.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
            {comic.tags.length > 0 && (
              <span className="text-[7px] font-black uppercase">#{comic.tags[0]}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
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
    <div className="flex flex-col lg:flex-row gap-8 animate-fadeIn">
      {/* Sidebar Navigation - Slim and Modern */}
      <aside className="lg:w-64 flex-shrink-0 space-y-6">
        
        {/* Search */}
        <div className="relative">
          <input 
            type="text" 
            placeholder="FIND RECORD..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-black p-3 text-[10px] font-black uppercase italic focus:outline-none ring-2 ring-transparent focus:ring-yellow-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
          />
        </div>

        {/* Collections */}
        <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="comic-title text-xl mb-3 border-b-2 border-black pb-1 uppercase">Archives</h2>
          <ul className="space-y-1">
            <li>
              <button 
                onClick={() => setActiveFolderId(null)}
                className={`w-full text-left font-black uppercase text-[10px] px-2 py-2 border transition-all flex items-center justify-between ${!activeFolderId ? 'bg-black text-white border-black' : 'bg-slate-50 border-transparent hover:border-black'}`}
              >
                <span>Full History</span>
                <span className="opacity-40">{comics.length}</span>
              </button>
            </li>
            {folders.map(f => {
              const count = comics.filter(c => c.folderid === f.id).length;
              return (count > 0 || !activeFolderId) && (
                <li key={f.id}>
                  <button 
                    onClick={() => setActiveFolderId(f.id)}
                    className={`w-full text-left font-black uppercase text-[10px] px-2 py-2 border transition-all flex items-center justify-between ${activeFolderId === f.id ? 'bg-blue-600 text-white border-black' : 'bg-slate-50 border-transparent hover:border-black'}`}
                  >
                    <span className="truncate pr-2">{f.name}</span>
                    <span className="opacity-40">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Tags */}
        <div className="bg-yellow-400 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="comic-title text-xl mb-3 border-b-2 border-black pb-1 uppercase">Filter</h2>
          <div className="flex flex-wrap gap-1.5">
            <button 
              onClick={() => setSelectedTag(null)}
              className={`text-[9px] font-black uppercase px-2 py-1 border transition-all ${!selectedTag ? 'bg-black text-white border-black' : 'bg-white border-black hover:bg-slate-50'}`}
            >
              All
            </button>
            {allTags.map(tag => (
              <button 
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`text-[9px] font-black uppercase px-2 py-1 border transition-all ${selectedTag === tag ? 'bg-red-600 text-white border-black' : 'bg-white border-black hover:bg-slate-50'}`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Grid Area - Tightly Calibrated Columns */}
      <div className="flex-grow">
        {activeFolder && (
          <div className="mb-6 bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h1 className="comic-title text-3xl text-blue-600 uppercase leading-none">{activeFolder.name}</h1>
            <p className="marker-font text-xs text-slate-400 mt-2">{activeFolder.description || "Daily Chronicle Collection."}</p>
          </div>
        )}

        {(searchQuery || selectedTag) && (
          <div className="mb-4 flex items-center justify-between">
             <div className="text-[10px] font-black uppercase tracking-widest italic">
                Query: <span className="text-red-600 underline ml-2">{searchQuery || `#${selectedTag}`}</span>
             </div>
             <button 
               onClick={() => {setSearchQuery(''); setSelectedTag(null);}}
               className="text-[10px] font-black uppercase underline hover:text-red-600"
             >
               Clear
             </button>
          </div>
        )}

        {filteredComics.length === 0 ? (
          <div className="text-center py-32 bg-white border-2 border-black border-dashed opacity-30">
            <h2 className="comic-title text-3xl uppercase">Void</h2>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 md:gap-4">
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
