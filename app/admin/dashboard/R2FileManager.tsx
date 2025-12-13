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
                // Root View: Show Folders ONLY
                filteredFiles = [];
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
        <div className="h-full flex flex-col bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 bg-black/20 border-b border-white/10 flex justify-between items-center backdrop-blur-md">
                <div className="flex items-center gap-3">
                    {currentPath && (
                        <button onClick={handleGoUp} className="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white">
                            <ArrowLeft size={18} />
                        </button>
                    )}
                    <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                        {currentPath ? (
                            <>
                                <FolderOpen size={20} className="text-yellow-400" />
                                <span className="text-white">{currentFolder?.name || currentPath}</span>
                            </>
                        ) : (
                            <>
                                <HardDrive size={20} className="text-blue-400" />
                                R2 Storage
                            </>
                        )}
                    </h2>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={loadContent} className="p-2 text-gray-400 hover:text-white transition">
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </button>

                    {currentPath === null && (
                        <div className="flex items-center gap-2">
                            {isCreatingFolder ? (
                                <div className="flex items-center gap-2 bg-black/40 rounded px-2 py-1 border border-blue-500/50">
                                    <input
                                        autoFocus
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        placeholder="Folder Name"
                                        className="bg-transparent text-white text-sm outline-none w-32"
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFolderAction()}
                                    />
                                    <button onClick={handleCreateFolderAction} className="text-green-400 hover:text-green-300"><Plus size={16} /></button>
                                    <button onClick={() => setIsCreatingFolder(false)} className="text-red-400 hover:text-red-300"><X size={16} /></button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsCreatingFolder(true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition"
                                >
                                    <Plus size={16} /> New Folder
                                </button>
                            )}
                        </div>
                    )}

                    {currentPath && (
                        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-bold cursor-pointer transition">
                            <UploadCloud size={16} />
                            Upload File
                            <input type="file" className="hidden" onChange={handleFileUpload} />
                        </label>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {loading && <div className="text-center p-8 text-gray-500">Loading contents...</div>}

                {!loading && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {/* Folders (Only show in Root) */}
                        {currentPath === null && initialFolders.map(folder => (
                            <div
                                key={folder.id}
                                className="group relative p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl cursor-pointer transition flex flex-col items-center gap-3"
                                onClick={() => handleEnterFolder(folder.id)}
                            >
                                <Folder size={48} className="text-yellow-500/80 group-hover:text-yellow-400 transition" fill="currentColor" fillOpacity={0.2} />
                                {/* Improved Name Visibility */}
                                <span className="text-sm text-white font-bold truncate w-full text-center px-2 bg-black/20 rounded py-0.5">{folder.name}</span>

                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                                        className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-full"
                                        title="Delete Folder"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Files (Only show in Folder) */}
                        {currentPath !== null && viewFiles.map(file => {
                            const fileName = file.key.split('/').pop();

                            return (
                                <div key={file.key} className="group relative p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl transition flex flex-col gap-2">
                                    <div className="aspect-square rounded-lg bg-black/40 overflow-hidden flex items-center justify-center relative">
                                        {file.isImage && file.previewUrl ? (
                                            <img src={file.previewUrl} alt={fileName} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
                                        ) : (
                                            <FileText size={32} className="text-gray-500" />
                                        )}

                                        {/* Overlay Actions */}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => window.open(file.previewUrl || '#', '_blank')}
                                                className="p-2 bg-blue-600/80 text-white rounded-full hover:bg-blue-500"
                                                title="View"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteFile(file.key)}
                                                className="p-2 bg-red-600/80 text-white rounded-full hover:bg-red-500"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-200 font-medium truncate" title={fileName}>{fileName}</span>
                                        <span className="text-[10px] text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                    </div>
                                </div>
                            );
                        })}

                        {currentPath !== null && viewFiles.length === 0 && (
                            <div className="col-span-full py-12 flex flex-col items-center text-gray-500 gap-2">
                                <FileBox size={48} className="opacity-20" />
                                <p>This folder is empty.</p>
                            </div>
                        )}
                    </div>
                )}

                {currentPath === null && initialFolders.length === 0 && (
                    <div className="py-12 flex flex-col items-center text-gray-500 gap-2">
                        <FolderOpen size={48} className="opacity-20" />
                        <p>No folders found. Create one to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
