
import React, { useState } from 'react';
import { ComicEntry, Folder } from '../types';
import { supabase } from '../lib/supabase';

interface AdminPortalProps {
  comics: ComicEntry[];
  folders: Folder[];
  onAdd: (comic: ComicEntry) => void;
  onDelete: (id: string) => void;
  onAddFolder: (folder: Folder) => void;
  onDeleteFolder: (id: string) => void;
}

const AdminPortal: React.FC<AdminPortalProps> = ({ 
  comics, 
  folders, 
  onAdd, 
  onDelete, 
  onAddFolder, 
  onDeleteFolder
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTags, setNewTags] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [layoutSize, setLayoutSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [thumbnailObject, setThumbnailObject] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState<string | null>(null);

  const [folderName, setFolderName] = useState('');
  const [folderDesc, setFolderDesc] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileObject(file);
      if (file.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailObject(file);
      setThumbPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName) return;
    
    const newFolder: Folder = {
      id: Date.now().toString(),
      name: folderName,
      description: folderDesc,
      datecreated: new Date().toISOString() // Use lowercase
    };

    const { error } = await supabase.from('folders').insert([newFolder]);
    if (error) {
      alert("Error adding folder: " + error.message);
      return;
    }

    onAddFolder(newFolder);
    setFolderName('');
    setFolderDesc('');
  };

  const handleAddComic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !fileObject) return;

    setIsUploading(true);
    const id = Date.now().toString();

    try {
      // 1. Upload Main File
      const fileExt = fileObject.name.split('.').pop();
      const fileName = `${id}-main.${fileExt}`;
      const { data: fileData, error: fileError } = await supabase.storage
        .from('comics')
        .upload(fileName, fileObject);
      
      if (fileError) throw fileError;
      const { data: { publicUrl: imageUrl } } = supabase.storage.from('comics').getPublicUrl(fileName);

      // 2. Upload Thumbnail (if exists)
      let thumbnailUrl = null;
      if (thumbnailObject) {
        const thumbExt = thumbnailObject.name.split('.').pop();
        const thumbName = `${id}-thumb.${thumbExt}`;
        const { error: thumbError } = await supabase.storage
          .from('comics')
          .upload(thumbName, thumbnailObject);
        if (thumbError) throw thumbError;
        const { data: { publicUrl: thumbPublicUrl } } = supabase.storage.from('comics').getPublicUrl(thumbName);
        thumbnailUrl = thumbPublicUrl;
      }

      // 3. Save to DB - Keys must be lowercase
      const newEntry: ComicEntry = {
        id,
        title: newTitle,
        description: newDesc,
        date: new Date().toISOString(),
        imageurl: imageUrl,
        thumbnailurl: thumbnailUrl || undefined,
        mimetype: fileObject.type,
        tags: newTags.split(',').map(t => t.trim()).filter(t => t),
        folderid: selectedFolder || undefined,
        layoutsize: layoutSize
      };

      const { error: dbError } = await supabase.from('comics').insert([newEntry]);
      if (dbError) throw dbError;

      onAdd(newEntry);
      
      setNewTitle('');
      setNewDesc('');
      setNewTags('');
      setFileObject(null);
      setThumbnailObject(null);
      setPreviewUrl(null);
      setThumbPreviewUrl(null);
      alert("Published successfully!");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const confirmDeleteComic = async (id: string) => {
    if (!confirm('Delete permanently from cloud?')) return;
    const { error } = await supabase.from('comics').delete().eq('id', id);
    if (error) alert(error.message);
    else onDelete(id);
  };

  const confirmDeleteFolder = async (id: string) => {
    if (!confirm('Delete folder? (Comics will become ungrouped)')) return;
    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (error) alert(error.message);
    else onDeleteFolder(id);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <section className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="comic-title text-2xl mb-4 text-blue-600">Create Series</h2>
          <form onSubmit={handleAddFolder} className="space-y-3">
            <input 
              type="text" 
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="w-full border-2 border-black p-2 text-sm focus:ring-2 ring-yellow-400"
              placeholder="Series Title"
              required
            />
            <textarea 
              value={folderDesc}
              onChange={(e) => setFolderDesc(e.target.value)}
              className="w-full border-2 border-black p-2 text-xs h-16 focus:ring-2 ring-yellow-400"
              placeholder="Description..."
            />
            <button className="w-full bg-blue-600 text-white font-black py-2 uppercase text-xs border-2 border-black hover:bg-blue-700">Add Collection</button>
          </form>
        </section>

        <section className="bg-slate-100 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="comic-title text-xl mb-4">Cloud Folders</h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {folders.map(f => (
              <div key={f.id} className="flex justify-between items-center bg-white border-2 border-black p-2">
                <span className="font-bold text-xs truncate mr-2">{f.name}</span>
                <button onClick={() => confirmDeleteFolder(f.id)} className="text-red-600 font-black text-[10px] hover:underline">X</button>
              </div>
            ))}
            {folders.length === 0 && <p className="text-[10px] italic text-slate-400">No folders yet.</p>}
          </div>
        </section>
      </div>

      <div className="lg:col-span-1">
        <section className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="comic-title text-3xl mb-4 text-red-600">Publish Art</h2>
          <form onSubmit={handleAddComic} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase mb-1">Title</label>
              <input 
                type="text" 
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full border-2 border-black p-2 focus:ring-2 ring-yellow-400 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">Assign to Series</label>
              <select 
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full border-2 border-black p-2 text-sm"
              >
                <option value="">Ungrouped</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">Display Size</label>
              <div className="flex gap-2">
                {(['small', 'medium', 'large'] as const).map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setLayoutSize(size)}
                    className={`flex-1 border-2 border-black text-[10px] py-1 font-black uppercase ${layoutSize === size ? 'bg-yellow-400' : 'bg-white'}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">Main File</label>
              <input 
                type="file" 
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:border-2 file:border-black file:text-[10px] file:font-black file:bg-yellow-400"
                required
              />
            </div>
            {fileObject?.type === 'application/pdf' && (
              <div className="bg-blue-50 p-2 border-2 border-blue-200">
                <label className="block text-xs font-black uppercase mb-1 text-blue-700">PDF Cover</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleThumbnailChange}
                  className="w-full text-xs"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-black uppercase mb-1">Description</label>
              <textarea 
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full border-2 border-black p-2 h-20 text-sm"
              />
            </div>
            <button 
              type="submit"
              disabled={isUploading}
              className="w-full bg-black text-white font-black py-3 uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-[4px_4px_0px_0px_rgba(234,179,8,1)] disabled:opacity-50"
            >
              {isUploading ? 'UPLOADING TO CLOUD...' : 'POST CONTENT'}
            </button>
          </form>
        </section>
      </div>

      <div className="lg:col-span-2">
        <section className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-full">
          <h2 className="comic-title text-3xl mb-6">Archive</h2>
          <div className="space-y-3 overflow-y-auto max-h-[800px] pr-2">
            {comics.map(comic => (
              <div key={comic.id} className="flex gap-4 border-2 border-black p-2 items-center bg-slate-50 group">
                <div className="w-12 h-12 bg-white border-2 border-black overflow-hidden flex-shrink-0">
                  {comic.mimetype.startsWith('image/') ? (
                    <img 
                      src={comic.thumbnailurl || comic.imageurl} 
                      className="w-full h-full object-cover" 
                      alt="" 
                    />
                  ) : <div className="w-full h-full flex items-center justify-center text-xs font-black text-red-600">PDF</div>}
                </div>
                <div className="flex-grow min-w-0">
                  <h4 className="font-black text-sm truncate">{comic.title}</h4>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {folders.find(f => f.id === comic.folderid)?.name || 'Ungrouped'} • {new Date(comic.date).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => confirmDeleteComic(comic.id)} className="bg-red-500 text-white p-1 border-2 border-black font-black text-[10px]">DELETE</button>
              </div>
            ))}
            {comics.length === 0 && <p className="italic text-slate-400">Empty archive.</p>}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminPortal;
