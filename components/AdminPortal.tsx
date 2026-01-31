
import React, { useState, useRef } from 'react';
import { ComicEntry, Folder } from '../types';
import { supabase } from '../lib/supabase';

interface AdminPortalProps {
  comics: ComicEntry[];
  folders: Folder[];
  session: any;
  onAdd: (comic: ComicEntry) => void;
  onDelete: (id: string) => void;
  onAddFolder: (folder: Folder) => void;
  onDeleteFolder: (id: string) => void;
}

type PublishStep = 'idle' | 'uploading-file' | 'uploading-thumb' | 'saving-db' | 'success' | 'error';

const AdminPortal: React.FC<AdminPortalProps> = ({ 
  comics, 
  folders, 
  session,
  onAdd, 
  onDelete, 
  onAddFolder, 
  onDeleteFolder
}) => {
  const [publishStep, setPublishStep] = useState<PublishStep>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isRlsError, setIsRlsError] = useState(false);
  const [isStorageRlsError, setIsStorageRlsError] = useState(false);
  const [isSchemaError, setIsSchemaError] = useState(false);
  
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTags, setNewTags] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const [layoutSize, setLayoutSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [thumbnailObject, setThumbnailObject] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState<string | null>(null);

  const [validationError, setValidationError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileObject(file);
      setValidationError(false);
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

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !fileObject) {
      setValidationError(true);
      setTimeout(() => setValidationError(false), 1000);
      return;
    }

    setPublishStep('uploading-file');
    setErrorMessage('');
    setIsRlsError(false);
    setIsStorageRlsError(false);
    setIsSchemaError(false);
    const tempId = Date.now().toString();
    const userId = session?.user?.id;

    try {
      let finalFolderId = selectedFolder;

      // 1. Handle dynamic folder creation
      if (isCreatingNewFolder && newFolderName) {
        const newFolderId = crypto.randomUUID();
        
        const { data: folderData, error: fError } = await supabase
          .from('folders')
          .insert([{ 
            id: newFolderId,
            name: newFolderName, 
            description: '', 
            datecreated: new Date().toISOString(),
            user_id: userId 
          }])
          .select()
          .single();

        if (fError) {
          if (fError.message.includes('row-level security')) setIsRlsError(true);
          if (fError.message.includes('schema cache')) setIsSchemaError(true);
          throw new Error(`Folder Error: ${fError.message}`);
        }
        onAddFolder(folderData);
        finalFolderId = folderData.id;
      }

      // 2. Upload Main File
      const fileExt = fileObject.name.split('.').pop();
      const fileName = `${tempId}-main.${fileExt}`;
      const { error: fileError } = await supabase.storage
        .from('comics')
        .upload(fileName, fileObject);
      
      if (fileError) {
        if (fileError.message.includes('row-level security')) setIsStorageRlsError(true);
        throw new Error(`Upload Error: ${fileError.message}`);
      }
      const { data: { publicUrl: imageUrl } } = supabase.storage.from('comics').getPublicUrl(fileName);

      // 3. Upload Thumbnail (if applicable)
      let thumbnailUrl = null;
      if (thumbnailObject) {
        setPublishStep('uploading-thumb');
        const thumbExt = thumbnailObject.name.split('.').pop();
        const thumbName = `${tempId}-thumb.${thumbExt}`;
        const { error: tError } = await supabase.storage.from('comics').upload(thumbName, thumbnailObject);
        if (tError) {
           if (tError.message.includes('row-level security')) setIsStorageRlsError(true);
           throw new Error(`Thumbnail Error: ${tError.message}`);
        }
        const { data: { publicUrl: thumbPublicUrl } } = supabase.storage.from('comics').getPublicUrl(thumbName);
        thumbnailUrl = thumbPublicUrl;
      }

      // 4. Save to DB
      setPublishStep('saving-db');
      const newComicId = crypto.randomUUID();
      const { data: dbData, error: dbError } = await supabase
        .from('comics')
        .insert([{
          id: newComicId,
          title: newTitle,
          description: newDesc,
          date: new Date().toISOString(),
          imageurl: imageUrl,
          thumbnailurl: thumbnailUrl || undefined,
          mimetype: fileObject.type,
          tags: newTags.split(',').map(t => t.trim()).filter(t => t),
          folderid: finalFolderId || null,
          layoutsize: layoutSize,
          user_id: userId
        }])
        .select()
        .single();

      if (dbError) {
        if (dbError.message.includes('row-level security')) setIsRlsError(true);
        if (dbError.message.includes('schema cache')) setIsSchemaError(true);
        throw new Error(`Archive Error: ${dbError.message}`);
      }

      onAdd(dbData);
      setPublishStep('success');
      
      setTimeout(() => {
        setPublishStep('idle');
        setNewTitle('');
        setNewDesc('');
        setNewTags('');
        setFileObject(null);
        setThumbnailObject(null);
        setPreviewUrl(null);
        setThumbPreviewUrl(null);
        setIsCreatingNewFolder(false);
        setNewFolderName('');
      }, 2000);

    } catch (err: any) {
      console.error(err);
      setPublishStep('error');
      setErrorMessage(err.message || "An unexpected error occurred.");
    }
  };

  const confirmDeleteComic = async (id: string) => {
    if (!confirm('This will delete this chronicle forever. Continue?')) return;
    const { error } = await supabase.from('comics').delete().eq('id', id);
    if (error) alert(error.message);
    else onDelete(id);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row gap-10">
        
        {/* Main Creation Column */}
        <div className="flex-grow space-y-8">
          <header className="relative">
            <h1 className="comic-title text-5xl text-black">THE CREATOR'S <span className="text-red-600">STUDIO</span></h1>
            <div className="absolute -top-4 -right-4 bg-yellow-400 border-2 border-black px-3 py-1 rotate-3 font-black text-xs hidden md:block">
              READY TO PUBLISH?
            </div>
          </header>

          <form onSubmit={handlePublish} className={`space-y-6 transition-transform ${validationError ? 'animate-shake' : ''}`}>
            <div className="bg-white border-4 border-black p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
              
              {/* Overlay for steps */}
              {publishStep !== 'idle' && (
                <div className="absolute inset-0 z-50 bg-white/95 flex flex-col items-center justify-center p-10 text-center animate-fadeIn">
                  {publishStep === 'success' ? (
                    <div className="space-y-4 animate-bounce">
                      <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center border-4 border-black mx-auto">
                        <span className="text-white text-5xl">✓</span>
                      </div>
                      <h2 className="comic-title text-4xl uppercase">POW! PUBLISHED!</h2>
                    </div>
                  ) : publishStep === 'error' ? (
                    <div className="space-y-4 max-w-lg">
                      <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center border-4 border-black mx-auto">
                        <span className="text-white text-4xl">!</span>
                      </div>
                      <h2 className="comic-title text-3xl uppercase text-red-600">MISSION FAILED</h2>
                      <p className="font-bold text-sm bg-red-50 p-4 border-2 border-red-600">{errorMessage}</p>
                      
                      {isStorageRlsError && (
                        <div className="text-left mt-4 p-4 bg-purple-50 border-2 border-purple-600">
                          <h4 className="font-black text-purple-800 text-xs mb-2">📦 STORAGE BUCKET LOCKED</h4>
                          <p className="text-[10px] font-bold text-purple-700 leading-tight">
                            The database is ready, but the <strong>'comics' storage bucket</strong> is locked.
                            <br/><br/>
                            1. Go to Supabase > <strong>Storage</strong> > 'comics' bucket.<br/>
                            2. Click <strong>Policies</strong>.<br/>
                            3. Add an <strong>INSERT</strong> policy for authenticated users.<br/>
                            4. Add a <strong>SELECT</strong> policy for everyone (anon/public).
                          </p>
                        </div>
                      )}

                      {isSchemaError && (
                        <div className="text-left mt-4 p-4 bg-yellow-50 border-2 border-yellow-600">
                          <h4 className="font-black text-yellow-800 text-xs mb-2">⚡ QUICK FIX NEEDED</h4>
                          <p className="text-[10px] font-bold text-yellow-700 leading-tight">
                            The app doesn't see your new database columns yet. 
                            <br/><br/>
                            1. Please <strong>refresh this page</strong>.<br/>
                            2. If it still fails, check your SQL scripts.
                          </p>
                        </div>
                      )}

                      {isRlsError && (
                        <div className="text-left mt-4 p-4 bg-blue-50 border-2 border-blue-600">
                          <h4 className="font-black text-blue-800 text-xs mb-2">💡 DATABASE TABLE LOCKED</h4>
                          <p className="text-[10px] font-bold text-blue-700 leading-tight">
                            Go to <strong>Authentication > Policies</strong> and allow authenticated users to insert into 'folders' and 'comics' tables.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-4 justify-center">
                        <button 
                          type="button" 
                          onClick={() => window.location.reload()}
                          className="mt-6 bg-yellow-400 text-black px-6 py-3 border-2 border-black font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                        >
                          Refresh App
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setPublishStep('idle')}
                          className="mt-6 bg-black text-white px-8 py-3 border-2 border-black font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 w-full max-w-sm">
                      <div className="relative h-8 bg-slate-100 border-4 border-black">
                        <div 
                          className="absolute inset-0 bg-yellow-400 transition-all duration-500"
                          style={{ 
                            width: publishStep === 'uploading-file' ? '30%' : 
                                   publishStep === 'uploading-thumb' ? '60%' : '90%' 
                          }}
                        ></div>
                      </div>
                      <div className="space-y-1">
                        <p className="comic-title text-2xl uppercase tracking-widest animate-pulse">
                          {publishStep === 'uploading-file' && '🎨 Uploading Masterpiece...'}
                          {publishStep === 'uploading-thumb' && '🖼️ Preparing Preview...'}
                          {publishStep === 'saving-db' && '✍️ Writing to Archive...'}
                        </p>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Don't close this tab!</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Left side: File Picking */}
                <div className="space-y-6">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-4 border-dashed p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[300px] relative group ${validationError && !fileObject ? 'border-red-600 bg-red-50' : 'border-black'} ${previewUrl ? 'bg-slate-50' : 'bg-slate-100 hover:bg-yellow-50'}`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden" 
                      accept="image/*,application/pdf"
                    />
                    
                    {previewUrl ? (
                      <img src={previewUrl} className="max-h-[250px] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="space-y-2">
                        <div className="text-4xl">🖼️</div>
                        <p className="font-black uppercase text-sm">Click to Select Art</p>
                        <p className="text-[10px] text-slate-500 font-bold">(Images or PDF Chronicles)</p>
                      </div>
                    )}

                    {fileObject && !previewUrl && fileObject.type === 'application/pdf' && (
                      <div className="bg-red-600 text-white border-2 border-black px-4 py-2 font-black text-xl rotate-[-2deg]">
                        PDF ARCHIVE
                      </div>
                    )}
                  </div>

                  {fileObject?.type === 'application/pdf' && (
                    <div className="bg-blue-50 border-2 border-blue-400 p-4 relative">
                      <div className="absolute -top-3 left-4 bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 border border-black">
                        PRO TIP
                      </div>
                      <p className="text-[10px] font-bold text-blue-800 mb-3">PDFs need a "Cover Image" to look good in the gallery!</p>
                      <button 
                        type="button"
                        onClick={() => thumbInputRef.current?.click()}
                        className="w-full bg-white border-2 border-black p-2 text-[10px] font-black uppercase hover:bg-blue-100 flex items-center justify-center gap-2"
                      >
                        {thumbPreviewUrl ? '✓ Cover Selected' : '📁 Add Cover Image'}
                      </button>
                      <input 
                        type="file" 
                        ref={thumbInputRef}
                        onChange={handleThumbnailChange}
                        className="hidden" 
                        accept="image/*"
                      />
                      {thumbPreviewUrl && <img src={thumbPreviewUrl} className="mt-2 h-16 w-12 object-cover border border-black" />}
                    </div>
                  )}
                </div>

                {/* Right side: Metadata */}
                <div className="space-y-4">
                  <div>
                    <label className={`block text-xs font-black uppercase mb-1 ${validationError && !newTitle ? 'text-red-600' : ''}`}>Chronicle Title</label>
                    <input 
                      type="text" 
                      value={newTitle}
                      onChange={(e) => {setNewTitle(e.target.value); setValidationError(false);}}
                      className={`w-full border-4 p-3 font-bold text-lg focus:ring-4 ring-yellow-400 outline-none transition-colors ${validationError && !newTitle ? 'border-red-600' : 'border-black'}`}
                      placeholder="e.g. Day 45: The Great Escape"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase mb-1">Collection / Series</label>
                    <div className="space-y-2">
                      {!isCreatingNewFolder ? (
                        <div className="flex gap-2">
                          <select 
                            value={selectedFolder}
                            onChange={(e) => setSelectedFolder(e.target.value)}
                            className="flex-grow border-2 border-black p-2 font-bold text-sm"
                          >
                            <option value="">(No Collection)</option>
                            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                          <button 
                            type="button"
                            onClick={() => setIsCreatingNewFolder(true)}
                            className="bg-black text-white px-3 border-2 border-black font-black text-lg"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            className="flex-grow border-2 border-black p-2 font-bold text-sm bg-yellow-50"
                            placeholder="New Collection Name..."
                            autoFocus
                          />
                          <button 
                            type="button"
                            onClick={() => setIsCreatingNewFolder(false)}
                            className="bg-red-500 text-white px-3 border-2 border-black font-black text-xs"
                          >
                            X
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase mb-1">Gallery Layout</label>
                    <div className="flex gap-1">
                      {(['small', 'medium', 'large'] as const).map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setLayoutSize(size)}
                          className={`flex-1 border-2 border-black py-1 font-black text-[10px] uppercase transition-colors ${layoutSize === size ? 'bg-yellow-400' : 'bg-white hover:bg-slate-100'}`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase mb-1">Tags (Comma separated)</label>
                    <input 
                      type="text" 
                      value={newTags}
                      onChange={(e) => setNewTags(e.target.value)}
                      className="w-full border-2 border-black p-2 font-bold text-sm"
                      placeholder="funny, sci-fi, pencils"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase mb-1">The Backstory</label>
                    <textarea 
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="w-full border-2 border-black p-2 h-24 font-medium text-sm"
                      placeholder="Tell the readers about this piece..."
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <button 
                  type="submit"
                  disabled={publishStep !== 'idle'}
                  className="w-full bg-black text-white py-5 font-black text-2xl uppercase tracking-[0.2em] border-4 border-black shadow-[6px_6px_0px_0px_rgba(234,179,8,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50"
                >
                  PUBLISH CHRONICLE
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Sidebar Archive */}
        <aside className="lg:w-80 space-y-6">
          <div className="bg-white border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="comic-title text-3xl border-b-4 border-black pb-2 mb-4">THE ARCHIVE</h2>
            <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
              {comics.length === 0 ? (
                <p className="text-center italic text-slate-400 py-10 font-bold">Your gallery is empty... for now.</p>
              ) : (
                comics.map(comic => (
                  <div key={comic.id} className="border-2 border-black p-2 flex gap-3 bg-slate-50 items-center group relative overflow-hidden">
                    <div className="w-16 h-16 bg-white border border-black flex-shrink-0 overflow-hidden">
                      {(comic.thumbnailurl || comic.imageurl) && comic.mimetype.startsWith('image/') ? (
                        <img src={comic.thumbnailurl || comic.imageurl} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-red-100 text-[10px] font-black text-red-600">PDF</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-grow">
                      <h4 className="font-black text-xs truncate leading-tight uppercase">{comic.title}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        {new Date(comic.date).toLocaleDateString()}
                      </p>
                      <button 
                        onClick={() => confirmDeleteComic(comic.id)}
                        className="text-[10px] font-black text-red-600 hover:underline mt-1 block"
                      >
                        DELETE PERMANENTLY
                      </button>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-black translate-x-1 group-hover:translate-x-0 transition-transform"></div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-yellow-400 border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="comic-title text-xl mb-2">MANAGE COLLECTIONS</h3>
            <div className="space-y-2">
              {folders.map(f => (
                <div key={f.id} className="flex justify-between items-center bg-white border-2 border-black px-2 py-1">
                  <span className="text-[10px] font-black uppercase truncate max-w-[150px]">{f.name}</span>
                  <button onClick={() => confirmDeleteFolder(f.id)} className="text-red-600 font-black text-xs">×</button>
                </div>
              ))}
            </div>
          </div>
        </aside>

      </div>
    </div>
  );

  async function confirmDeleteFolder(id: string) {
    if (!confirm('Delete this collection? Comics inside will become "Uncategorized".')) return;
    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (error) alert(error.message);
    else onDeleteFolder(id);
  }
};

export default AdminPortal;
