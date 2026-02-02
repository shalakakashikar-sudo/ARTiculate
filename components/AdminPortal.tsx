
import React, { useState, useRef, useMemo } from 'react';
import { ComicEntry, Folder } from '../types';
import { supabase } from '../lib/supabase';

// Setup PDF.js worker
if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
  (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

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

type PublishStep = 'idle' | 'optimizing-color' | 'extracting-pdf' | 'uploading-file' | 'uploading-thumb' | 'saving-db' | 'success' | 'error' | 'batch-processing';

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
  
  const [archiveSearch, setArchiveSearch] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTags, setNewTags] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const [validationError, setValidationError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const convertPdfToSrgbImage = async (file: File): Promise<Blob | null> => {
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) return null;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      
      const viewport = page.getViewport({ scale: 3.0 }); 
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return null;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ 
        canvasContext: context, 
        viewport: viewport,
        intent: 'display'
      }).promise;
      
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
      });
    } catch (e) {
      console.error("PDF Processing Error:", e);
      return null;
    }
  };

  const sanitizeImageFile = async (file: File | Blob, originalName: string): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { 
          resolve(file instanceof File ? file : new File([file], originalName)); 
          return; 
        }
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], originalName.replace(/\.[^/.]+$/, "") + "_web.jpg", { type: 'image/jpeg' }));
          } else {
            resolve(file instanceof File ? file : new File([file], originalName));
          }
        }, 'image/jpeg', 0.95);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const startEditing = (comic: ComicEntry) => {
    setActiveTab('single');
    setEditModeId(comic.id);
    setNewTitle(comic.title);
    setNewDesc(comic.description || '');
    setNewTags(comic.tags.join(', '));
    setSelectedFolder(comic.folderid || '');
    setPreviewUrl(comic.thumbnailurl || comic.imageurl);
    setFileObject(null);
    setIsCreatingNewFolder(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditModeId(null);
    setNewTitle('');
    setNewDesc('');
    setNewTags('');
    setPreviewUrl(null);
    setFileObject(null);
    setSelectedFolder('');
    setIsCreatingNewFolder(false);
    setNewFolderName('');
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
      return;
    }

    setPublishStep('optimizing-color');
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

      const existingComic = editModeId ? comics.find(c => c.id === editModeId) : null;
      let imageUrl = existingComic?.imageurl || '';
      let thumbnailUrl = existingComic?.thumbnailurl || null;

      if (fileObject) {
        if (fileObject.type === 'application/pdf') {
          setPublishStep('uploading-file');
          const pdfFileName = `${tempId}-original.pdf`;
          const { error: pdfUploadError } = await supabase.storage.from('comics').upload(pdfFileName, fileObject);
          if (pdfUploadError) throw pdfUploadError;
          const { data: { publicUrl: pdfPublicUrl } } = supabase.storage.from('comics').getPublicUrl(pdfFileName);
          imageUrl = pdfPublicUrl; 

          setPublishStep('extracting-pdf');
          const pdfImageBlob = await convertPdfToSrgbImage(fileObject);
          if (pdfImageBlob) {
            const fixedImageFile = await sanitizeImageFile(pdfImageBlob, 'preview.jpg');
            const fixedName = `${tempId}-preview.jpg`;
            
            setPublishStep('uploading-thumb');
            const { error: thumbError } = await supabase.storage.from('comics').upload(fixedName, fixedImageFile);
            if (thumbError) throw thumbError;
            
            const { data: { publicUrl: thumbPublicUrl } } = supabase.storage.from('comics').getPublicUrl(fixedName);
            thumbnailUrl = thumbPublicUrl; 
          }
        } else {
          const mainFileToUpload = await sanitizeImageFile(fileObject, fileObject.name);
          setPublishStep('uploading-file');
          const fileName = `${tempId}-${fileObject.name}`;
          const { error: fileError } = await supabase.storage.from('comics').upload(fileName, mainFileToUpload);
          if (fileError) throw fileError;
          const { data: { publicUrl } } = supabase.storage.from('comics').getPublicUrl(fileName);
          imageUrl = publicUrl;
          thumbnailUrl = publicUrl;
        }
      }

      setPublishStep('saving-db');
      const payload = {
        title: newTitle,
        description: newDesc,
        imageurl: imageUrl,
        thumbnailurl: thumbnailUrl || imageUrl,
        mimetype: fileObject ? fileObject.type : (existingComic?.mimetype || 'image/jpeg'),
        tags: newTags.split(',').map(t => t.trim()).filter(t => t),
        folderid: finalFolderId || null,
        date: new Date().toISOString()
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
      setTimeout(() => { setPublishStep('idle'); cancelEdit(); }, 1500);
    } catch (err: any) {
      setPublishStep('error');
      setErrorMessage(err.message);
      setTimeout(() => setPublishStep('idle'), 3000);
    }
  };

  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) return;
    setPublishStep('batch-processing');
    setBatchProgress({ current: 0, total: bulkFiles.length });

    try {
      let finalFolderId = selectedFolder;

      // Create folder if requested during bulk upload
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

      for (let i = 0; i < bulkFiles.length; i++) {
        const file = bulkFiles[i];
        setBatchProgress(prev => ({ ...prev, current: i + 1 }));
        try {
          const tempId = `${Date.now()}-${i}`;
          const finalFile = await sanitizeImageFile(file, file.name);
          const fileName = `${tempId}-${file.name}`;
          const { error: sError } = await supabase.storage.from('comics').upload(fileName, finalFile);
          if (sError) continue;
          const { data: { publicUrl } } = supabase.storage.from('comics').getPublicUrl(fileName);
          const { data: created, error: dbError } = await supabase.from('comics').insert([{
            title: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
            imageurl: publicUrl,
            thumbnailurl: publicUrl,
            mimetype: file.type,
            tags: newTags.split(',').map(t => t.trim()).filter(t => t),
            folderid: finalFolderId || null,
            date: new Date().toISOString()
          }]).select();
          
          if (!dbError && created && created.length > 0) {
            onAdd(created[0]);
          }
        } catch (err) { console.error(err); }
      }
      setPublishStep('success');
      setBulkFiles([]);
      setTimeout(() => setPublishStep('idle'), 2000);
    } catch (err: any) {
      setPublishStep('error');
      setErrorMessage(err.message);
      setTimeout(() => setPublishStep('idle'), 3000);
    }
  };

  const filteredArchives = useMemo(() => {
    return comics.filter(c => c.title.toLowerCase().includes(archiveSearch.toLowerCase()));
  }, [comics, archiveSearch]);

  const folderSelectionUI = (
    <div className="space-y-2">
      <div className="flex gap-2">
        {!isCreatingNewFolder ? (
          <>
            <select 
              value={selectedFolder} 
              onChange={(e) => setSelectedFolder(e.target.value)} 
              className="flex-grow border-2 border-black p-3 font-black text-[10px] uppercase outline-none focus:ring-4 ring-yellow-400"
            >
              <option value="">Standalone / No Series</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button 
              type="button" 
              onClick={() => setIsCreatingNewFolder(true)}
              className="bg-white border-2 border-black px-4 font-black text-[10px] uppercase hover:bg-yellow-400 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none"
            >
              New
            </button>
          </>
        ) : (
          <>
            <input 
              type="text" 
              placeholder="NEW SERIES NAME" 
              value={newFolderName} 
              onChange={(e) => setNewFolderName(e.target.value)} 
              className="flex-grow border-2 border-black p-3 font-black text-[10px] uppercase outline-none focus:ring-4 ring-yellow-400"
              autoFocus
            />
            <button 
              type="button" 
              onClick={() => {setIsCreatingNewFolder(false); setNewFolderName('');}}
              className="bg-white border-2 border-black px-4 font-black text-[10px] uppercase hover:bg-red-400 hover:text-white transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-fadeIn">
      <div className="flex flex-col lg:flex-row gap-8">
        
        <div className="flex-grow space-y-8">
          <header className="flex flex-col md:flex-row md:items-end gap-6 justify-between border-b-2 border-black pb-4">
            <h1 className="comic-title text-5xl text-black">THE <span className="text-red-600">ATELIER</span></h1>
            <div className="flex border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden h-10">
               <button onClick={() => setActiveTab('single')} className={`px-4 font-black uppercase text-xs transition-colors ${activeTab === 'single' ? 'bg-black text-white' : 'hover:bg-yellow-100'}`}>Single</button>
               <button onClick={() => setActiveTab('bulk')} className={`px-4 font-black uppercase text-xs transition-colors ${activeTab === 'bulk' ? 'bg-black text-white' : 'hover:bg-yellow-100'}`}>Bulk</button>
            </div>
          </header>

          <div className="bg-white border-2 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-visible">
            {publishStep !== 'idle' && (
              <div className="absolute inset-0 z-50 bg-white/95 flex flex-col items-center justify-center p-12 text-center">
                <h2 className="comic-title text-3xl uppercase animate-pulse">{publishStep.replace('-', ' ')}...</h2>
                {publishStep === 'batch-processing' && (
                  <div className="mt-4 w-full max-w-xs">
                    <div className="h-2 w-full bg-slate-200 border border-black">
                      <div 
                        className="h-full bg-blue-600" 
                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                      ></div>
                    </div>
                    <p className="mt-2 text-[10px] font-black uppercase">Processing {batchProgress.current} of {batchProgress.total}</p>
                  </div>
                )}
                {publishStep === 'error' && <p className="text-red-600 font-black mt-4">{errorMessage}</p>}
              </div>
            )}

            {activeTab === 'single' ? (
              <form onSubmit={handlePublish} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-black p-6 text-center cursor-pointer bg-slate-50 hover:bg-yellow-50 min-h-[300px] flex items-center justify-center relative">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                    {previewUrl ? <img src={previewUrl} className="max-h-[280px] object-contain border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" /> : <div className="font-black text-[10px] uppercase opacity-40">Drop Art Here</div>}
                  </div>
                  <div className="space-y-4">
                    <input type="text" placeholder="TITLE" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full border-2 border-black p-3 font-black text-xs outline-none focus:ring-4 ring-yellow-400" />
                    
                    {folderSelectionUI}

                    <input type="text" placeholder="TAGS (COMMA SEPARATED)" value={newTags} onChange={(e) => setNewTags(e.target.value)} className="w-full border-2 border-black p-3 font-black text-[10px] outline-none focus:ring-4 ring-yellow-400" />
                    <textarea placeholder="ARTIST NOTE" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full border-2 border-black p-3 h-24 font-bold text-[10px] outline-none focus:ring-4 ring-yellow-400" />
                  </div>
                </div>
                <div className="flex gap-4">
                  {editModeId && <button type="button" onClick={cancelEdit} className="flex-grow border-2 border-black font-black uppercase py-4 text-xs">Cancel</button>}
                  <button type="submit" className="flex-grow bg-black text-white border-2 border-black font-black uppercase py-4 text-xs tracking-widest shadow-[4px_4px_0px_0px_rgba(234,179,8,1)] active:shadow-none">Archive Entry</button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="bg-slate-50 border-2 border-black p-6 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest border-b border-black pb-2">Batch Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase opacity-60">Target Series</label>
                      {folderSelectionUI}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase opacity-60">Common Tags</label>
                      <input type="text" placeholder="TAGS (COMMA SEPARATED)" value={newTags} onChange={(e) => setNewTags(e.target.value)} className="w-full border-2 border-black p-3 font-black text-[10px] outline-none focus:ring-4 ring-yellow-400" />
                    </div>
                  </div>
                </div>

                <div className="p-10 text-center border-4 border-dashed border-blue-600 bg-blue-50">
                  <input type="file" multiple ref={bulkInputRef} onChange={(e) => setBulkFiles(Array.from(e.target.files || []))} className="hidden" accept="image/*" />
                  <button onClick={() => bulkInputRef.current?.click()} className="bg-white border-2 border-black px-8 py-4 font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    {bulkFiles.length > 0 ? `${bulkFiles.length} FILES READY` : 'SELECT IMAGES'}
                  </button>
                  {bulkFiles.length > 0 && <button onClick={handleBulkUpload} className="block w-full mt-6 bg-blue-600 text-white border-2 border-black py-4 font-black uppercase text-xs">Start Mass Upload</button>}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="lg:w-80 space-y-6">
          <div className="bg-yellow-400 border-2 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] tilt-sm">
            <h3 className="comic-title text-xl uppercase mb-1">Hybrid Upload</h3>
            <p className="text-[9px] font-black leading-tight uppercase italic opacity-80">PDFs now keep their original file while generating high-res sRGB snapshots for the gallery! 🎨</p>
          </div>

          <div className="bg-white border-2 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] h-[300px] flex flex-col">
            <h2 className="comic-title text-xl border-b-2 border-black pb-2 mb-4">Feed Log</h2>
            <div className="flex-grow overflow-y-auto space-y-2 custom-scrollbar pr-2">
              {filteredArchives.map(comic => (
                <div key={comic.id} className="p-2 border border-black bg-slate-50 flex gap-3 items-center group">
                  <div className="w-10 h-10 border border-black bg-white overflow-hidden flex-shrink-0">
                    <img src={comic.thumbnailurl || comic.imageurl} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-grow">
                    <h4 className="font-black text-[9px] uppercase truncate">{comic.title}</h4>
                    <div className="flex gap-2">
                      <button onClick={() => startEditing(comic)} className="text-[8px] font-black text-blue-600 uppercase">Edit</button>
                      <button onClick={() => confirm(`Delete ${comic.title}?`) && onDelete(comic.id)} className="text-[8px] font-black text-red-600 uppercase">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border-2 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] h-[250px] flex flex-col">
            <h2 className="comic-title text-xl border-b-2 border-black pb-2 mb-4 uppercase">Manage Collections</h2>
            <div className="flex-grow overflow-y-auto space-y-2 custom-scrollbar pr-2">
              {folders.length === 0 ? (
                <p className="text-[10px] font-bold text-slate-400 uppercase italic">No series collections found.</p>
              ) : (
                folders.map(folder => (
                  <div key={folder.id} className="p-3 border border-black bg-slate-50 flex justify-between items-center hover:bg-yellow-50 transition-colors">
                    <div className="min-w-0 flex-grow">
                      <h4 className="font-black text-[10px] uppercase truncate">{folder.name}</h4>
                      <p className="text-[8px] font-bold opacity-40 uppercase">
                        {comics.filter(c => c.folderid === folder.id).length} Entries
                      </p>
                    </div>
                    <button 
                      onClick={() => confirm(`Permanently delete the collection "${folder.name}"?\nAssociated comics will become standalone.`) && onDeleteFolder(folder.id)} 
                      className="text-[8px] font-black text-red-600 uppercase border border-red-600 px-2 py-1 hover:bg-red-600 hover:text-white transition-colors"
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
    </div>
  );
};

export default AdminPortal;
