import React, { useState, useEffect } from 'react';
import { FolderRecord, FileRecord } from '../../../types';
import { NeoButton, NeoInput } from '../../../components/GlassUI';
import { listAllR2Files, deleteR2File, deleteFolder, uploadFile, createFolder, getR2FileUrl } from '../../../services/mockApi';
import {
    Folder,
    FileText,
    Trash2,
    Download,
    FolderOpen,
    Image as ImageIcon,
    Film,
    FileBox,
    ArrowLeft,
    Plus,
    RefreshCw,
    Search,
    UploadCloud,
    X,
    Eye,
    HardDrive
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface R2FileManagerProps {
    initialFolders: FolderRecord[];
    refreshData: () => void;
    masterToken: string; // Needed for upload
}

export const R2FileManager: React.FC<R2FileManagerProps> = ({ initialFolders, refreshData, masterToken }) => {
    const [currentPath, setCurrentPath] = useState<string | null>(null); // null = root, string = folderId
    const [viewFiles, setViewFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [newFolderName, setNewFolderName] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    // Preview State
    const [previewFile, setPreviewFile] = useState<{ url: string, type: 'image' | 'video' | 'other', name: string } | null>(null);

    useEffect(() => {
        loadContent();
    }, [currentPath, initialFolders]);

    const loadContent = async () => {
        setLoading(true);
        try {
            const allFiles = await listAllR2Files();

            let filteredFiles = [];

            if (currentPath === null) {
                // Root View: Show Folders AND Uncategorized Files
                // Uncategorized = files that are NOT in a known folder's path (uploads/{folderId}/...)

                const knownFolderIds = new Set(initialFolders.map(f => f.id));

                filteredFiles = allFiles.filter(file => {
                    const parts = file.key.split('/');
                    // Check if file follows uploads/{folderId}/ pattern
                    if (parts.length >= 3 && parts[0] === 'uploads') {
                        const folderId = parts[1];
                        if (knownFolderIds.has(folderId)) {
                            return false; // Belongs to a known folder, hide from root
                        }
                    }
                    return true; // Show in root (either root file or orphan folder)
                });
            } else {
                // Folder View
                const prefix = `uploads/${currentPath}/`;
                const rawFiles = allFiles.filter(f => f.key.startsWith(prefix));

                // Fetch previews
                filteredFiles = await Promise.all(rawFiles.map(async (file) => {
                    const fileName = file.key.split('/').pop();
                    const ext = fileName?.split('.').pop()?.toLowerCase();
                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');

                    let previewUrl = '';
                    if (isImage) {
                        try {
                            previewUrl = await getR2FileUrl(file.key);
                        } catch (e) {
                            console.warn("Preview fetch failed", e);
                        }
                    }

                    return { ...file, previewUrl, isImage };
                }));
            }

            // Fetch previews for Root files as well (if any found)
            if (currentPath === null && filteredFiles.length > 0) {
                filteredFiles = await Promise.all(filteredFiles.map(async (file) => {
                    const fileName = file.key.split('/').pop();
                    const ext = fileName?.split('.').pop()?.toLowerCase();
                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');

                    let previewUrl = '';
                    if (isImage) {
                        try {
                            previewUrl = await getR2FileUrl(file.key);
                        } catch (e) {
                            console.warn("Preview fetch failed", e);
                        }
                    }
                    return { ...file, previewUrl, isImage };
                }));
            }

            setViewFiles(filteredFiles);
        } catch (err) {
            console.error("Failed to list files:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFolderAction = async () => {
        if (!newFolderName.trim()) return;
        try {
            await createFolder(newFolderName, false); // Manual creation
            setNewFolderName('');
            setIsCreatingFolder(false);
            refreshData();
        } catch (err: any) {
            alert("Failed to create folder: " + err.message);
        }
    };

    // Share function removed.

    const handleEnterFolder = (folderId: string) => {
        setCurrentPath(folderId);
    };

    const handleGoUp = () => {
        setCurrentPath(null);
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!confirm('Are you sure? This will delete the folder and ALL files inside it permanently.')) return;
        try {
            await deleteFolder(folderId);
            refreshData(); // Refresh DB folders list
            loadContent(); // Refresh view
        } catch (err: any) {
            alert("Delete failed: " + err.message);
        }
    };

    const handleDeleteFile = async (key: string) => {
        if (!confirm(`Delete ${key}?`)) return;
        try {
            await deleteR2File(key);
            loadContent();
        } catch (err: any) {
            alert("Failed to delete file: " + err.message);
        }
    };

    const currentFolder = initialFolders.find(f => f.id === currentPath);

    // Upload Logic
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!currentPath) {
            alert("Please select a folder to upload to.");
            return;
        }

        setLoading(true);
        try {
            await uploadFile(file, masterToken, 'Admin Panel', null, null, null, null, currentPath);
            alert("Upload successful!");
            loadContent();
        } catch (err: any) {
            alert("Upload failed: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#0A0A0A]/40 rounded-xl border border-white/5 overflow-hidden ring-1 ring-white/5 shadow-2xl">
            {/* Toolbar */}
            <div className="p-4 bg-black/40 border-b border-white/5 flex justify-between items-center backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    {currentPath && (
                        <button onClick={handleGoUp} className="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white group">
                            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                    )}
                    <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                        {currentPath ? (
                            <>
                                <FolderOpen size={20} className="text-blue-400" />
                                <span className="text-white font-mono tracking-tight">{currentFolder?.name || currentPath}</span>
                            </>
                        ) : (
                            <>
                                <HardDrive size={20} className="text-purple-400" />
                                <span className="tracking-wide">R2 Storage</span>
                            </>
                        )}
                    </h2>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={loadContent}
                        className={`p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition ${loading ? "animate-spin text-blue-400" : ""}`}
                        title="Refresh"
                    >
                        <RefreshCw size={18} />
                    </button>

                    {currentPath === null && (
                        <div className="flex items-center gap-2">
                            {isCreatingFolder ? (
                                <div className="flex items-center gap-2 bg-black/40 rounded-lg p-1 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                                    <input
                                        autoFocus
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        placeholder="Folder Name"
                                        className="bg-transparent text-white text-xs outline-none w-32 px-2 font-mono"
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFolderAction()}
                                    />
                                    <button onClick={handleCreateFolderAction} className="p-1 hover:bg-green-500/20 text-green-400 rounded transition"><Plus size={14} /></button>
                                    <button onClick={() => setIsCreatingFolder(false)} className="p-1 hover:bg-red-500/20 text-red-400 rounded transition"><X size={14} /></button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsCreatingFolder(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-gray-300 text-xs font-medium transition active:scale-95"
                                >
                                    <Plus size={14} /> New Folder
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                        <div className="flex flex-col items-center gap-2">
                            <RefreshCw className="animate-spin text-blue-500" size={32} />
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                    {/* Folders (Only show in Root) */}
                    {currentPath === null && initialFolders.map(folder => (
                        <div
                            key={folder.id}
                            className="group relative h-40 bg-[#0F0F0F] hover:bg-[#151515] border border-white/5 hover:border-blue-500/30 rounded-2xl cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 overflow-hidden shadow-lg hover:shadow-blue-900/10"
                            onClick={() => handleEnterFolder(folder.id)}
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="relative">
                                <Folder size={56} className="text-blue-500/20 group-hover:text-blue-500 transition-colors duration-300" fill="currentColor" fillOpacity={0.1} />
                                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-200/50 group-hover:text-white transition-colors">
                                    {folder.name.substring(0, 2).toUpperCase()}
                                </div>
                            </div>

                            <div className="flex flex-col items-center w-full px-4 text-center z-10">
                                <span className="text-sm text-gray-200 font-medium truncate w-full group-hover:text-white transition-colors">{folder.name}</span>
                                <span className="text-[10px] text-gray-500 font-mono mt-0.5">
                                    {folder.created_at ? formatDistanceToNow(new Date(folder.created_at), { addSuffix: true }) : 'Unknown date'}
                                </span>
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                                className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/20 text-red-500 rounded-lg transform translate-y-2 group-hover:translate-y-0"
                                title="Delete Folder"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}

                    {/* Add File Card (In Folder) */}
                    {currentPath !== null && (
                        <label className="group relative h-40 border-2 border-dashed border-white/10 hover:border-blue-500/50 rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2 hover:bg-blue-500/5">
                            <div className="p-3 rounded-full bg-white/5 group-hover:bg-blue-500/20 transition-colors">
                                <UploadCloud size={24} className="text-gray-400 group-hover:text-blue-400" />
                            </div>
                            <span className="text-xs font-bold text-gray-400 group-hover:text-blue-300 uppercase tracking-widest">Upload File</span>
                            <input type="file" className="hidden" onChange={handleFileUpload} />
                        </label>
                    )}

                    {/* Files (Show in Folder OR Root if orphaned) */}
                    {viewFiles.map(file => {
                        const fileName = file.key.split('/').pop();
                        const isVideo = ['mp4', 'webm', 'mov'].some(ext => fileName?.toLowerCase().endsWith(ext));

                        return (
                            <div key={file.key} className="group relative h-40 bg-[#0F0F0F] border border-white/5 hover:border-white/20 rounded-2xl overflow-hidden shadow-lg transition-all hover:-translate-y-1">
                                <div className="absolute inset-0 bg-black/40 z-0" />

                                {file.isImage && file.previewUrl ? (
                                    <img src={file.previewUrl} alt={fileName} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                                ) : isVideo ? (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover:opacity-60 transition-opacity">
                                        <Film size={40} className="text-purple-400" />
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-30 group-hover:opacity-50 transition-opacity">
                                        <FileText size={40} className="text-gray-400" />
                                    </div>
                                )}

                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80" />

                                <div className="absolute bottom-0 left-0 w-full p-3 z-10">
                                    <div className="text-xs font-medium text-gray-200 truncate pr-6" title={fileName}>{fileName}</div>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-[10px] text-gray-500 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                        {isVideo && <span className="text-[9px] uppercase tracking-wider text-purple-400 bg-purple-500/10 px-1 rounded">Video</span>}
                                        {file.isImage && <span className="text-[9px] uppercase tracking-wider text-blue-400 bg-blue-500/10 px-1 rounded">IMG</span>}
                                    </div>
                                </div>

                                {/* Overlay Actions */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all flex flex-col gap-1 z-20 transform translate-x-2 group-hover:translate-x-0">
                                    <button
                                        onClick={() => window.open(file.previewUrl || '#', '_blank')}
                                        className="p-1.5 bg-black/60 text-white rounded-lg hover:bg-blue-600 backdrop-blur-md border border-white/10"
                                        title="Preview"
                                    >
                                        <Eye size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteFile(file.key)}
                                        className="p-1.5 bg-black/60 text-red-400 rounded-lg hover:bg-red-600 hover:text-white backdrop-blur-md border border-white/10"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {currentPath === null && initialFolders.length === 0 && viewFiles.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4 opacity-50">
                        <FolderOpen size={64} strokeWidth={1} />
                        <p className="font-light tracking-wide">Secure Storage Vault is Empty</p>
                    </div>
                )}

                {currentPath !== null && viewFiles.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-600 gap-2 opacity-50 absolute inset-0 -z-10 mt-20">
                        <UploadCloud size={48} strokeWidth={1} />
                        <p className="text-sm">Drag and drop or click upload to add files</p>
                    </div>
                )}
            </div>
        </div>
    );
};
