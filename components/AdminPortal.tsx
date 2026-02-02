
import React, { useState, useRef, useMemo } from 'react';
import { ComicEntry, Folder } from '../types';
import { supabase } from '../lib/supabase';

interface AdminPortalProps {
  comics: ComicEntry[];
  folders: Folder[];
  session: any;
  onAdd: (comic: ComicEntry) => void;
  onUpdate: (comic: ComicEntry) => void;
  onDelete: (id: string) => void;
  onAddFolder: (folder: Folder) => void;
  onDeleteFolder: (id: string) => void;
}

type PublishStep = 'idle' | 'uploading-file' | 'uploading-thumb' | 'saving-db' | 'success' | 'error' | 'batch-processing';

const AdminPortal: React.FC<AdminPortalProps> = ({ 
  comics, 
  folders, 
  session,
  onAdd, 
  onUpdate,
  onDelete, 
  onAddFolder, 
  onDeleteFolder
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [publishStep, setPublishStep] = useState<PublishStep>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [editModeId, setEditModeId] = useState<string | null>(null);
  const [showExportGuide, setShowExportGuide] = useState(false);
  
  const [archiveSearch, setArchiveSearch] = useState('');
  
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTags, setNewTags] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [layoutSize, setLayoutSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState<string | null>(null);

  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const [validationError, setValidationError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const filteredArchives = useMemo(() => {
    return comics.filter(c => 
      c.title.toLowerCase().includes(archiveSearch.toLowerCase()) ||
      c.tags.some(t => t.toLowerCase().includes(archiveSearch.toLowerCase()))
    );
  }, [comics, archiveSearch]);

  const startEditing = (comic: ComicEntry) => {
    setActiveTab('single');
    setEditModeId(comic.id);
    setNewTitle(comic.title);
    setNewDesc(comic.description || '');
    setNewTags(comic.tags.join(', '));
    setSelectedFolder(comic.folderid || '');
    setLayoutSize(comic.layoutsize || 'medium');
    setPreviewUrl(comic.imageurl);
    setThumbPreviewUrl(comic.thumbnailurl || null);
    setFileObject(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditModeId(null);
    setNewTitle('');
    setNewDesc('');
    setNewTags('');
    setPreviewUrl(null);
    setThumbPreviewUrl(null);
    setFileObject(null);
    setSelectedFolder('');
  };

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

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || (!fileObject && !editModeId)) {
      setValidationError(true);
      setTimeout(() => setValidationError(false), 1000);
      return;
    }

    setPublishStep('uploading-file');
    const tempId = Date.now().toString();

    try {
      let finalFolderId = selectedFolder;

      if (isCreatingNewFolder && newFolderName) {
        const { data: folderData, error: fError } = await supabase
          .from('folders')
          .insert([{ name: newFolderName, description: '' }])
          .select();
        
        if (fError) throw fError;
        if (folderData && folderData.length > 0) {
          onAddFolder(folderData[0]);
          finalFolderId = folderData[0].id;
        }
        setIsCreatingNewFolder(false);
        setNewFolderName('');
      }

      let imageUrl = previewUrl || '';
      let thumbnailUrl = thumbPreviewUrl || null;

      if (fileObject) {
        const fileExt = fileObject.name.split('.').pop();
        const fileName = `${tempId}-main.${fileExt}`;
        const { error: fileError } = await supabase.storage.from('comics').upload(fileName, fileObject);
        if (fileError) throw fileError;
        const { data: { publicUrl } } = supabase.storage.from('comics').getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      setPublishStep('saving-db');
      const payload = {
        title: newTitle,
        description: newDesc,
        imageurl: imageUrl,
        thumbnailurl: thumbnailUrl,
        mimetype: fileObject ? fileObject.type : comics.find(c => c.id === editModeId)?.mimetype,
        tags: newTags.split(',').map(t => t.trim()).filter(t => t),
        folderid: finalFolderId || null,
        layoutsize: layoutSize,
      };

      if (editModeId) {
        const { data: updated, error: dbError } = await supabase
          .from('comics')
          .update(payload)
          .eq('id', editModeId)
          .select();
        
        if (dbError) throw dbError;
        if (updated && updated.length > 0) onUpdate(updated[0]);
      } else {
        const { data: created, error: dbError } = await supabase
          .from('comics')
          .insert([payload])
          .select();
        
        if (dbError) throw dbError;
        if (created && created.length > 0) onAdd(created[0]);
      }

      setPublishStep('success');
      setTimeout(() => {
        setPublishStep('idle');
        cancelEdit();
      }, 1500);

    } catch (err: any) {
      console.error("Publish Error:", err);
      setPublishStep('error');
      setErrorMessage(err.message);
      setTimeout(() => setPublishStep('idle'), 3000);
    }
  };

  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) return;
    setPublishStep('batch-processing');
    setBatchProgress({ current: 0, total: bulkFiles.length });

    for (let i = 0; i < bulkFiles.length; i++) {
      const file = bulkFiles[i];
      setBatchProgress(prev => ({ ...prev, current: i + 1 }));
      
      try {
        const tempId = `${Date.now()}-${i}`;
        const fileExt = file.name.split('.').pop();
        const fileName = `${tempId}-bulk.${fileExt}`;
        
        const { error: storageError } = await supabase.storage.from('comics').upload(fileName, file);
        if (storageError) continue;
        
        const { data: { publicUrl } } = supabase.storage.from('comics').getPublicUrl(fileName);
        
        const { data: created, error: dbError } = await supabase
          .from('comics')
          .insert([{
            title: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
            imageurl: publicUrl,
            mimetype: file.type,
            tags: newTags.split(',').map(t => t.trim()).filter(t => t),
            folderid: selectedFolder || null
          }])
          .select();
        
        if (!dbError && created && created.length > 0) onAdd(created[0]);
      } catch (err) {
        console.error("Bulk upload item failed:", err);
      }
    }

    setPublishStep('success');
    setBulkFiles([]);
    setTimeout(() => setPublishStep('idle'), 2000);
  };

  const currentFolderName = folders.find(f => f.id === selectedFolder)?.name || '(Uncategorized)';

  return (
    <div className="max-w-7xl mx-auto pb-20">
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Creation Column */}
        <div className="flex-grow space-y-8">
          <header className="flex flex-col md:flex-row md:items-end gap-6 justify-between border-b-2 border-black pb-4">
            <h1 className="comic-title text-5xl text-black">
              THE <span className="text-red-600">ATELIER</span>
            </h1>
            <div className="flex border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden h-10">
               <button 
                 onClick={() => setActiveTab('single')}
                 className={`px-4 py-1 font-black uppercase text-xs transition-colors ${activeTab === 'single' ? 'bg-black text-white' : 'hover:bg-yellow-100'}`}
               >
                 {editModeId ? '⚡ Edit' : 'Single'}
               </button>
               <button 
                 onClick={() => setActiveTab('bulk')}
                 className={`px-4 py-1 font-black uppercase text-xs transition-colors ${activeTab === 'bulk' ? 'bg-black text-white' : 'hover:bg-yellow-100'}`}
               >
                 Bulk
               </button>
            </div>
          </header>

          <div className="bg-white border-2 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
            
            {publishStep !== 'idle' && (
              <div className="absolute inset-0 z-50 bg-white/95 flex flex-col items-center justify-center p-12 text-center animate-fadeIn">
                {publishStep === 'success' ? (
                  <div className="space-y-4 animate-bounce">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center border-2 border-black mx-auto">
                      <span className="text-white text-3xl">✓</span>
                    </div>
                    <h2 className="comic-title text-3xl uppercase">Recorded!</h2>
                  </div>
                ) : publishStep === 'batch-processing' ? (
                  <div className="space-y-6 w-full max-w-sm">
                    <h2 className="comic-title text-2xl uppercase">Processing Batch</h2>
                    <div className="relative h-8 bg-slate-100 border-2 border-black">
                      <div 
                        className="absolute inset-0 bg-blue-500 transition-all duration-300"
                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                      ></div>
                    </div>
                    <p className="font-black text-[10px] uppercase italic">Finalizing {batchProgress.current} / {batchProgress.total}</p>
                  </div>
                ) : publishStep === 'error' ? (
                  <div className="space-y-4">
                     <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center border-2 border-black mx-auto">
                      <span className="text-white text-3xl">!</span>
                    </div>
                     <h2 className="comic-title text-3xl uppercase text-red-600">Error</h2>
                     <p className="text-red-600 font-black uppercase text-xs">{errorMessage}</p>
                  </div>
                ) : (
                  <div className="animate-pulse space-y-4">
                     <h2 className="comic-title text-3xl uppercase">{publishStep.replace('-', ' ')}...</h2>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'single' ? (
              <form onSubmit={handlePublish} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[350px] relative group ${validationError && !fileObject && !editModeId ? 'border-red-600 bg-red-50' : 'border-black bg-slate-50 hover:bg-yellow-50'}`}
                  >
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                    {previewUrl ? (
                      <div className="relative">
                        <img src={previewUrl} className="max-h-[300px] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] object-contain" />
                        <div className="absolute -top-3 -right-3 bg-red-600 text-white text-[8px] px-2 py-1 font-black border border-black uppercase tracking-widest">Change</div>
                      </div>
                    ) : (
                      <div className="space-y-2 opacity-30 group-hover:opacity-100 transition-opacity">
                        <div className="text-4xl">📁</div>
                        <p className="font-black uppercase text-[10px]">Select Daily Art</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase mb-1 tracking-widest">Title</label>
                      <input 
                        type="text" 
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="w-full border-2 border-black p-3 font-bold text-sm focus:ring-4 ring-yellow-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase mb-1 tracking-widest">Collection</label>
                      <div className="flex gap-2">
                        <select 
                          value={selectedFolder}
                          onChange={(e) => setSelectedFolder(e.target.value)}
                          className="flex-grow border-2 border-black p-2 font-black uppercase text-[10px]"
                        >
                          <option value="">Standalone</option>
                          {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                        <button type="button" onClick={() => setIsCreatingNewFolder(!isCreatingNewFolder)} className="bg-black text-white px-3 font-black text-lg border-2 border-black">+</button>
                      </div>
                      {isCreatingNewFolder && (
                        <input 
                          type="text" 
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          className="w-full border-2 border-black p-2 mt-2 font-bold text-xs bg-yellow-50"
                          placeholder="New Series Name..."
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase mb-1 tracking-widest">Keywords</label>
                      <input 
                        type="text" 
                        value={newTags}
                        onChange={(e) => setNewTags(e.target.value)}
                        className="w-full border-2 border-black p-2 font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase mb-1 tracking-widest">Artist Note</label>
                      <textarea 
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        className="w-full border-2 border-black p-2 h-20 font-medium text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-6 border-t border-black">
                  {editModeId && (
                    <button type="button" onClick={cancelEdit} className="flex-grow border-2 border-black font-black uppercase py-3 text-xs tracking-widest hover:bg-slate-50">
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="flex-grow bg-black text-white border-2 border-black font-black uppercase py-3 text-xs tracking-[0.3em] shadow-[4px_4px_0px_0px_rgba(234,179,8,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                    {editModeId ? 'Update Entry' : 'Archive Art'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="bg-blue-50 border-2 border-blue-600 p-8 text-center space-y-4">
                  <h3 className="comic-title text-3xl text-blue-800 uppercase italic">Bulk Archiver</h3>
                  <div className="bg-white border-2 border-blue-200 p-3 max-w-xs mx-auto">
                    <p className="text-[8px] font-black uppercase text-blue-400 mb-1">Target Series</p>
                    <div className="text-sm font-black uppercase text-blue-800 truncate">{currentFolderName}</div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-4">
                     <select 
                        value={selectedFolder}
                        onChange={(e) => setSelectedFolder(e.target.value)}
                        className="border-2 border-black p-2 font-black text-[10px] w-full max-w-xs uppercase"
                      >
                        <option value="">Standalone</option>
                        {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>

                      <input type="file" multiple ref={bulkInputRef} onChange={(e) => setBulkFiles(Array.from(e.target.files || []))} className="hidden" accept="image/*" />
                      
                      <button 
                        type="button"
                        onClick={() => bulkInputRef.current?.click()}
                        className="bg-white border-2 border-black px-10 py-5 font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                      >
                        {bulkFiles.length > 0 ? `${bulkFiles.length} Ready` : 'Select Assets'}
                      </button>
                  </div>
                </div>

                <button 
                  disabled={bulkFiles.length === 0}
                  onClick={handleBulkUpload}
                  className="w-full bg-black text-white border-2 border-black font-black uppercase py-4 text-xs tracking-[0.4em] shadow-[4px_4px_0px_0px_rgba(234,179,8,1)] disabled:opacity-20"
                >
                  Confirm Mass Upload
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Archives Sidebar */}
        <aside className="lg:w-80 space-y-6 flex-shrink-0">
          
          {/* Pro Tip Note */}
          <div className="bg-yellow-100 border-2 border-dashed border-black p-4 tilt-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative">
            <h3 className="comic-title text-lg uppercase mb-2 text-red-600">Artist's Studio Note</h3>
            <p className="text-[10px] font-bold leading-tight uppercase italic opacity-80 mb-3">
              Seeing color shifts in your PDFs? Web browsers prefer <span className="underline">sRGB</span>. 
              Avoid <span className="underline">CMYK</span> exports to ensure your art looks exactly as intended!
            </p>
            <button 
              onClick={() => setShowExportGuide(true)}
              className="w-full bg-black text-white text-[8px] font-black uppercase py-2 tracking-widest hover:bg-slate-800 transition-colors"
            >
              How to Export Correcty →
            </button>
          </div>

          {/* Comics Feed Log */}
          <div className="bg-white border-2 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col h-[400px]">
            <h2 className="comic-title text-2xl border-b-2 border-black pb-2 mb-4">Feed Log</h2>
            
            <input 
              type="text" 
              placeholder="Search..."
              value={archiveSearch}
              onChange={(e) => setArchiveSearch(e.target.value)}
              className="w-full border-2 border-black p-2 font-black uppercase text-[10px] mb-4 outline-none focus:ring-2 ring-yellow-400"
            />

            <div className="flex-grow space-y-2 overflow-y-auto pr-2 custom-scrollbar">
              {filteredArchives.map(comic => (
                <div key={comic.id} className={`p-2 border-2 flex gap-3 transition-all ${editModeId === comic.id ? 'border-yellow-400 bg-yellow-50' : 'border-black bg-slate-50'}`}>
                  <div className="w-10 h-10 bg-white border border-black flex-shrink-0 overflow-hidden">
                    {comic.imageurl && (comic.mimetype?.startsWith('image/') || comic.mimetype === 'application/pdf') ? (
                      <img 
                        src={comic.thumbnailurl || comic.imageurl} 
                        className="w-full h-full object-cover" 
                        alt=""
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-black text-[8px] text-red-600">ART</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-grow flex flex-col justify-center">
                    <h4 className="font-black text-[9px] uppercase truncate leading-tight">{comic.title}</h4>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => startEditing(comic)} className="text-[8px] font-black text-blue-600 uppercase hover:underline">Edit</button>
                      <button onClick={() => { if(confirm(`Permanently delete "${comic.title}"?`)) onDelete(comic.id); }} className="text-[8px] font-black text-red-600 uppercase hover:underline">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Folders/Series Management */}
          <div className="bg-white border-2 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col h-[280px]">
            <h2 className="comic-title text-2xl border-b-2 border-black pb-2 mb-4">Series List</h2>
            <div className="flex-grow space-y-2 overflow-y-auto pr-2 custom-scrollbar">
              {folders.length === 0 ? (
                <p className="text-[8px] uppercase font-black opacity-20 text-center py-10">No collections yet</p>
              ) : (
                folders.map(folder => (
                  <div key={folder.id} className="p-3 border-2 border-black bg-slate-50 flex justify-between items-center group">
                    <div className="min-w-0">
                      <span className="font-black text-[10px] uppercase truncate block">{folder.name}</span>
                      <span className="text-[7px] text-slate-400 font-bold uppercase">
                        {comics.filter(c => c.folderid === folder.id).length} Entries
                      </span>
                    </div>
                    <button 
                      onClick={() => { if(confirm(`Delete Series "${folder.name}" and ALL its comics?`)) onDeleteFolder(folder.id); }}
                      className="text-[8px] font-black text-red-600 uppercase hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </aside>

      </div>

      {/* Color Export Guide Modal */}
      {showExportGuide && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4">
          <div className="bg-white border-4 border-black max-w-2xl w-full p-8 shadow-[12px_12px_0px_0px_rgba(239,68,68,1)] overflow-y-auto max-h-[90vh] animate-fadeIn">
             <div className="flex justify-between items-start mb-6 border-b-4 border-black pb-4">
               <h2 className="comic-title text-4xl uppercase">sRGB Export Guide</h2>
               <button onClick={() => setShowExportGuide(false)} className="bg-black text-white px-3 py-1 font-black text-xl border-2 border-black hover:bg-red-600 transition-colors">X</button>
             </div>
             
             <div className="space-y-8">
                <section>
                  <h3 className="font-black text-xs uppercase bg-yellow-400 inline-block px-2 py-1 border border-black mb-3">Clip Studio Paint</h3>
                  <p className="text-[10px] font-bold uppercase leading-relaxed text-slate-600">
                    File > Export (Single Layer) > .pdf <br/>
                    In the dialog: Set <span className="text-black underline">Expression Color</span> to <span className="text-black">RGB</span> and ensure <span className="text-black underline">Embed Color Profile</span> is CHECKED.
                  </p>
                </section>

                <section>
                  <h3 className="font-black text-xs uppercase bg-blue-400 text-white inline-block px-2 py-1 border border-black mb-3">Adobe Photoshop</h3>
                  <p className="text-[10px] font-bold uppercase leading-relaxed text-slate-600">
                    File > Save As > Photoshop PDF <br/>
                    In the dialog: Select <span className="text-black">Output</span> on left > Set Color Conversion to <span className="text-black">Convert to Destination</span> > Destination: <span className="text-black">sRGB IEC61966-2.1</span>.
                  </p>
                </section>

                <section>
                  <h3 className="font-black text-xs uppercase bg-red-600 text-white inline-block px-2 py-1 border border-black mb-3">Procreate (iPad)</h3>
                  <p className="text-[10px] font-bold uppercase leading-relaxed text-slate-600">
                    PDFs inherit the canvas profile. Always start your canvas with an <span className="text-black underline">sRGB Color Profile</span>. If your colors look dull, copy layers to a new sRGB canvas before exporting.
                  </p>
                </section>

                <div className="bg-slate-100 p-4 border-2 border-black italic">
                   <p className="text-[9px] font-black uppercase text-center">Browsers are built for LIGHT (RGB), not INK (CMYK). <br/> Using sRGB ensures your digital art stays consistent everywhere.</p>
                </div>
             </div>

             <button 
               onClick={() => setShowExportGuide(false)}
               className="w-full mt-8 bg-black text-white py-4 font-black uppercase tracking-widest border-2 border-black hover:bg-slate-800 transition-colors"
             >
               Got it, Master Artist!
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPortal;
