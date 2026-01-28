
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ComicEntry, Folder } from '../types';

interface GalleryProps {
  comics: ComicEntry[];
  folders: Folder[];
}

const GalleryCard: React.FC<{ comic: ComicEntry; isHero?: boolean }> = ({ comic, isHero }) => {
  const displayUrl = comic.thumbnailurl || (comic.mimetype.startsWith('image/') ? comic.imageurl : null);

  const sizeClasses = isHero 
    ? "md:col-span-full mb-8" 
    : (comic.layoutsize === 'small' ? "md:col-span-1 md:row-span-1" : 
       comic.layoutsize === 'large' ? "md:col-span-2 md:row-span-2" : 
       "md:col-span-1 md:row-span-2");

  return (
    <Link 
      to={`/comic/${comic.id}`}
      className={`group block bg-white border-4 border-black p-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${sizeClasses}`}
    >
      <div className={`relative h-full flex ${isHero ? 'flex-col md:flex-row gap-6' : 'flex-col'}`}>
        <div className={`relative overflow-hidden border-2 border-black bg-slate-50 flex items-center justify-center ${isHero ? 'w-full md:w-2/3 h-[300px] md:h-[450px]' : 'flex-grow min-h-[150px] mb-3'}`}>
          {displayUrl ? (
            <img 
              src={displayUrl} 
              alt={comic.title} 
              className="w-full h-full object-cover prevent-save"
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-slate-200">
              <span className="font-black text-red-600 text-2xl">PDF VOLUME</span>
            </div>
          )}
          
          {comic.mimetype === 'application/pdf' && (
            <div className="absolute top-2 left-2 bg-red-600 border-2 border-black px-2 py-1 text-xs font-black uppercase text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              PDF CHRONICLE
            </div>
          )}
          {isHero && (
            <div className="absolute top-2 right-2 bg-yellow-400 border-2 border-black px-3 py-1 font-black uppercase text-xs">
              Latest Release
            </div>
          )}
        </div>
        
        <div className={isHero ? 'w-full md:w-1/3 flex flex-col justify-center py-4' : 'mt-auto'}>
          <h3 className={`comic-title mb-1 truncate ${isHero ? 'text-4xl md:text-5xl border-b-4 border-black pb-2' : 'text-xl'}`}>
            {comic.title}
          </h3>
          {isHero && <p className="text-slate-600 font-medium my-4 italic line-clamp-3">"{comic.description}"</p>}
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] font-black text-black uppercase tracking-widest bg-yellow-400 px-2 py-0.5 border border-black">
              {new Date(comic.date).toLocaleDateString()}
            </span>
            <div className="flex gap-1 overflow-hidden">
               {comic.tags.slice(0, isHero ? 5 : 1).map(tag => (
                 <span key={tag} className="text-[10px] border border-slate-300 px-1.5 py-0.5 font-bold text-slate-400 uppercase">#{tag}</span>
               ))}
            </div>
          </div>
          {isHero && (
            <button className="mt-8 bg-black text-white font-black py-4 uppercase tracking-widest border-2 border-black hover:bg-slate-800 self-start px-8">
              Read Entry →
            </button>
          )}
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
  const showHero = !searchQuery && !selectedTag && !activeFolderId && filteredComics.length > 0;
  
  const heroComic = showHero ? filteredComics[0] : null;
  const gridComics = showHero ? filteredComics.slice(1) : filteredComics;

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Sidebar Navigation */}
      <aside className="md:w-64 flex-shrink-0 space-y-8">
        {/* Collections */}
        <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="comic-title text-2xl mb-4 border-b-2 border-black pb-2">Series</h2>
          <ul className="space-y-2">
            <li>
              <button 
                onClick={() => setActiveFolderId(null)}
                className={`w-full text-left font-black uppercase text-xs p-2 border-2 transition-all ${!activeFolderId ? 'bg-black text-white border-black' : 'border-transparent hover:border-slate-200'}`}
              >
                Entire Archive
              </button>
            </li>
            {folders.map(f => (
              <li key={f.id}>
                <button 
                  onClick={() => setActiveFolderId(f.id)}
                  className={`w-full text-left font-black uppercase text-xs p-2 border-2 transition-all ${activeFolderId === f.id ? 'bg-blue-600 text-white border-black' : 'border-transparent hover:border-slate-200'}`}
                >
                  {f.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Tags */}
        <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="comic-title text-2xl mb-4 border-b-2 border-black pb-2">Tags</h2>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setSelectedTag(null)}
              className={`text-[10px] font-black uppercase px-2 py-1 border-2 transition-all ${!selectedTag ? 'bg-black text-white border-black' : 'bg-white border-slate-200 hover:border-black'}`}
            >
              All Tags
            </button>
            {allTags.map(tag => (
              <button 
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`text-[10px] font-black uppercase px-2 py-1 border-2 transition-all ${selectedTag === tag ? 'bg-yellow-400 border-black' : 'bg-white border-slate-200 hover:border-black'}`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-grow">
        {/* Search Bar */}
        <div className="mb-8 relative group">
          <input 
            type="text" 
            placeholder="Search for chronicles, heroes, or dates..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-4 border-black p-4 text-xl font-bold italic focus:outline-none focus:ring-4 ring-yellow-400 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-focus-within:opacity-100">
            <span className="font-black text-xs uppercase tracking-widest">Type to find...</span>
          </div>
        </div>

        {activeFolder && (
          <div className="mb-8 border-l-8 border-yellow-400 pl-4 py-2">
            <h1 className="comic-title text-5xl">{activeFolder.name}</h1>
            <p className="text-slate-500 font-medium italic mt-1 text-lg">{activeFolder.description || "A curated series of chronicles."}</p>
          </div>
        )}

        {filteredComics.length === 0 ? (
          <div className="text-center py-20 bg-white border-4 border-black border-dashed">
            <h2 className="text-2xl font-black text-slate-300 uppercase italic tracking-widest">No matching chronicles found...</h2>
            <button onClick={() => {setSearchQuery(''); setSelectedTag(null); setActiveFolderId(null);}} className="mt-4 text-blue-600 underline font-bold">Clear all filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-[120px]">
            {heroComic && <GalleryCard comic={heroComic} isHero={true} />}
            {gridComics.map((comic) => (
              <GalleryCard key={comic.id} comic={comic} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Gallery;
