
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from '../../../lib/use-router';
import { GlassCard, NeoButton, NeoInput } from '../../../components/GlassUI';
import { getAdminData, deleteFile, deleteToken, createCustomToken, updateFileMetadata, listAllR2Files, deleteR2File, getR2FileUrl, updateTokenMetadata, deleteExpiredTokens, createFolder, getFolders, assignTokenToFolder, removeTokenFromFolder } from '../../../services/mockApi';
import { R2FileManager } from './R2FileManager';
import { TokenRecord, FileRecord, ActivityLog, FolderRecord } from '../../../types';
import {
  LogOut,
  Trash2,
  Copy,
  FileText,
  Key,
  Activity,
  Plus,
  RefreshCw,
  Image as ImageIcon,
  Film,
  FileBox,
  AlertCircle,
  Edit2,
  Check,
  Search as SearchIcon,
  X,
  HardDrive,
  Download,
  FolderOpen,
  Folder,
  UploadCloud,
  Share2,
  Link as LinkIcon,
  Shield,
  Upload,
  PlusCircle,
  Maximize2,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ShareManager } from './ShareManager';
import { QRManager } from './QRManager';

type Tab = 'tokens' | 'uploads' | 'create' | 'logs' | 'r2' | 'folders' | 'share' | 'qr' | 'device_logs';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('device_logs'); // Set as default for visibility for now, or keep 'tokens'
  // Actually, let's keep 'tokens' as default but I'll switch to 'device_logs' after render if I could, but simple adding is enough.
  // I will just update the type.
  const [searchQuery, setSearchQuery] = useState(''); // Global Search
  const [data, setData] = useState<{ tokens: TokenRecord[], files: FileRecord[], logs: ActivityLog[], folders: FolderRecord[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [masterToken, setMasterToken] = useState('');

  // Token Editing State
  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [editedTokenUses, setEditedTokenUses] = useState<string>('');
  const [editedTokenMaxUses, setEditedTokenMaxUses] = useState<string>('');
  const [editedTokenExpiry, setEditedTokenExpiry] = useState<string>('');

  // R2 Files State
  const [r2Files, setR2Files] = useState<Array<{ key: string, size: number, lastModified: Date, etag: string }>>([]);
  const [r2Loading, setR2Loading] = useState(false);
  const [selectedR2Files, setSelectedR2Files] = useState<string[]>([]);

  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  // File Editing State
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editedFileName, setEditedFileName] = useState<string>('');

  // Download Limit Editing State
  const [editingDownloadLimitId, setEditingDownloadLimitId] = useState<string | null>(null);
  const [editedDownloadLimit, setEditedDownloadLimit] = useState<string>('');

  // Folder Management State
  const [newFolderName, setNewFolderName] = useState('');
  const [isAutoFolderId, setIsAutoFolderId] = useState(false);
  const [newFolderPassword, setNewFolderPassword] = useState(''); // New state
  const [assigningTokenId, setAssigningTokenId] = useState<string | null>(null);
  const [selectedFolderForToken, setSelectedFolderForToken] = useState<string>('');

  // Custom Token Form
  const [customTokenCode, setCustomTokenCode] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPurpose, setCustomPurpose] = useState('');
  const [customExpiry, setCustomExpiry] = useState('60');
  const [customMaxUses, setCustomMaxUses] = useState('1');
  const [customPermission, setCustomPermission] = useState<'upload' | 'download' | 'both'>('both');
  const [customAllowedFolders, setCustomAllowedFolders] = useState<string[]>([]);
  const [customMaxUploadSize, setCustomMaxUploadSize] = useState<number | null>(524288000); // Default 500MB in bytes
  const [creatingToken, setCreatingToken] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const result = await getAdminData();
      setData(result);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      // Keep existing data if fetch fails
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔍 Dashboard mounted');
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
      router.push('/admin');
      return;
    }
    setMasterToken(token);
    fetchData();

    // Set up intervals
    const dataFetchInterval = setInterval(() => fetchData(false), 10000); // Refresh data every 10 seconds
    const tokenCleanupInterval = setInterval(() => deleteExpiredTokens(), 5 * 60 * 1000); // Clean up expired tokens every 5 minutes

    return () => {
      clearInterval(dataFetchInterval);
      clearInterval(tokenCleanupInterval);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'r2') {
      fetchR2Files();
    }
  }, [activeTab]);

  const fetchR2Files = async () => {
    setR2Loading(true);
    try {
      const files = await listAllR2Files();
      setR2Files(files);
    } catch (err) {
      console.error("Failed to fetch R2 files:", err);
    } finally {
      setR2Loading(false);
    }
  };

  const handleLogout = () => {
    // Clear authentication token
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminAuthenticated'); // Cleanup old
    localStorage.removeItem('adminAuthenticated');
    // Force navigation
    window.location.href = '/admin';
  };

  const handleCreateToken = async () => {
    setCreatingToken(true);
    setCreateError(null);
    try {
      await createCustomToken(
        customTokenCode,
        customName || 'Admin',
        customPurpose || 'Manual Creation',
        parseInt(customExpiry) || 60,
        parseInt(customMaxUses) || 1,
        customPermission,
        customAllowedFolders, // Pass the selected folders
        customMaxUploadSize // Pass the upload size limit
      );
      setCustomTokenCode('');
      setCustomName('');
      setCustomPurpose('');
      setCustomExpiry('60');
      setCustomMaxUses('1');
      setCustomAllowedFolders([]);
      setCustomMaxUploadSize(524288000); // Reset to default 500MB

      await fetchData(false);
      setActiveTab('tokens');
    } catch (err: any) {
      setCreateError(err.message || "Failed to create token");
    } finally {
      setCreatingToken(false);
    }
  };

  const handleDeleteToken = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this token?")) {
      await deleteToken(id);
      fetchData(false);
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    if (window.confirm("Delete this file from storage? This will delete from both database and R2.")) {
      try {
        await deleteFile(fileId);
        fetchData(false);
      } catch (err) {
        alert("Failed to delete file: " + (err as Error).message);
      }
    }
  }

  const handleDeleteR2File = async (key: string) => {
    const confirmed = window.confirm('Delete "' + key + '" from R2 storage? This cannot be undone.');
    if (confirmed) {
      try {
        await deleteR2File(key);
        fetchR2Files();
      } catch (err) {
        alert("Failed to delete: " + (err as Error).message);
      }
    }
  };

  const handleDownloadR2File = async (key: string) => {
    try {
      const url = await getR2FileUrl(key);
      window.open(url, '_blank');
    } catch (err) {
      alert("Failed to get download URL: " + (err as Error).message);
    }
  };

  const handleBulkDeleteR2Files = async () => {
    const confirmed = window.confirm("Are you sure you want to delete " + selectedR2Files.length + " selected R2 files? This cannot be undone.");
    if (confirmed) {
      setR2Loading(true);
      try {
        for (const key of selectedR2Files) {
          await deleteR2File(key);
        }
        setSelectedR2Files([]);
        fetchR2Files();
      } catch (err: any) {
        alert("Failed to delete R2 files: " + err.message);
      } finally {
        setR2Loading(false);
      }
    }
  };



  const handleSelectFile = (fileId: string) => {
    setSelectedFiles(prev =>
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  const handleSelectAllFiles = () => {
    if (data?.files && selectedFiles.length === data.files.length) {
      setSelectedFiles([]);
    } else if (data?.files) {
      setSelectedFiles(data.files.map(file => file.file_id));
    }
  };

  const handleBulkDeleteFiles = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedFiles.length} selected files ? This will delete from both database and R2.`)) {
      try {
        for (const fileId of selectedFiles) {
          await deleteFile(fileId);
        }
        setSelectedFiles([]); // Clear selection after deletion
        fetchData(false); // Refresh the list of files
      } catch (err) {
        alert("Failed to bulk delete files: " + (err as Error).message);
      }
    }
  };

  const handleEditToken = (tokenId: string, currentUses: number, currentMaxUses: number, currentExpiry: string) => {
    setEditingTokenId(tokenId);
    setEditedTokenUses(String(currentUses));
    setEditedTokenMaxUses(String(currentMaxUses));
    setEditedTokenExpiry(currentExpiry);
  };

  const handleSaveTokenEdits = async (tokenId: string) => {
    try {
      const uses = parseInt(editedTokenUses);
      const maxUses = parseInt(editedTokenMaxUses);

      if (isNaN(uses) || uses < 0) {
        alert("Please enter a valid number for uses");
        return;
      }
      if (isNaN(maxUses) || maxUses < 0) {
        alert("Please enter a valid number for max uses");
        return;
      }

      await updateTokenMetadata(tokenId, masterToken, {
        uses: uses,
        max_uses: maxUses,
        expires_at: editedTokenExpiry
      });

      await fetchData(false);
    } catch (err) {
      alert("Failed to update token: " + (err as Error).message);
    } finally {
      setEditingTokenId(null);
      setEditedTokenUses('');
      setEditedTokenMaxUses('');
      setEditedTokenExpiry('');
    }
  };

  const handleEditFileName = (fileId: string, currentName: string, currentTitle: string) => {
    setEditingFileId(fileId);
    setEditedFileName(currentTitle || currentName);
  };

  const handleSaveFileName = async (fileId: string) => {
    if (!editedFileName || editedFileName === data?.files.find(f => f.file_id === fileId)?.title) {
      setEditingFileId(null);
      return;
    }
    try {
      console.log("Updating file metadata:", { fileId, title: editedFileName });
      await updateFileMetadata(fileId, "5419810", { title: editedFileName });

    } catch (error) {
      console.error("Failed to update file name:", error);
      alert("Failed to update file name: " + (error as Error).message);
    } finally {
      console.log("Resetting editing state for file name.");
      setEditingFileId(null);
      setEditedFileName('');
    }
  };

  const handleEditDownloadLimit = (fileId: string, currentLimit: number | null) => {
    setEditingDownloadLimitId(fileId);
    setEditedDownloadLimit(currentLimit !== null ? String(currentLimit) : '10');
  };

  const handleSaveDownloadLimit = async (fileId: string) => {
    const newLimit = parseInt(editedDownloadLimit);
    if (isNaN(newLimit) || newLimit < 0) {
      alert("Please enter a valid number");
      return;
    }
    try {
      await updateFileMetadata(fileId, "5419810", { download_limit: newLimit });
    } catch (error) {
      console.error("Failed to update download limit:", error);
      alert("Failed to update limit: " + (error as Error).message);
    } finally {
      setEditingDownloadLimitId(null);
      setEditedDownloadLimit('');
    }
  };

  const handleCreateFolder = async () => {
    try {
      if (!isAutoFolderId && !newFolderName) {
        alert("Please enter a folder name");
        return;
      }
      await createFolder(newFolderName, isAutoFolderId, newFolderPassword || undefined);
      setNewFolderName('');
      setNewFolderPassword('');
      fetchData(false);
    } catch (err: any) {
      alert("Failed to create folder: " + err.message);
    }
  };

  const handleAssignToken = async () => {
    if (!assigningTokenId || !selectedFolderForToken) return;
    try {
      await assignTokenToFolder(assigningTokenId, selectedFolderForToken);
      setAssigningTokenId(null);
      setSelectedFolderForToken('');
      fetchData(false);
    } catch (err: any) {
      alert("Failed to assign token: " + err.message);
    }
  };

  const handleRemoveTokenFromFolder = async (tokenId: string, folderId: string) => {
    if (window.confirm(`Remove access to folder "${folderId}" for this token?`)) {
      try {
        await removeTokenFromFolder(tokenId, folderId);
        fetchData(false);
      } catch (err: any) {
        alert("Failed to remove token from folder: " + err.message);
      }
    }
  };

  const TokenTable = () => (
    <div className="overflow-x-auto overflow-y-auto h-full pb-4 custom-scrollbar">
      <table className="text-left text-sm font-mono">
        <thead className="bg-white/5 text-gray-400 uppercase text-xs sticky top-0 backdrop-blur-md z-10">
          <tr>
            <th className="p-4 min-w-[120px]">Token</th>
            <th className="p-4 min-w-[120px]">Name</th>
            <th className="p-4 min-w-[150px]">Purpose</th>
            <th className="p-4 min-w-[100px]">Uses</th>
            <th className="p-4 min-w-[180px]">Expires</th>
            <th className="p-4 min-w-[120px]">Upload Size</th>
            <th className="p-4 min-w-[200px]">Allowed Folders</th>
            <th className="p-4 min-w-[100px]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {data?.tokens
            .filter(t =>
              t.display_token.toLowerCase().includes(searchQuery.toLowerCase()) ||
              t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              t.temp_purpose?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              t.ip_address?.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map(t => (
              <tr key={t.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 text-white font-bold flex items-center gap-2">
                  {t.display_token}
                  <button
                    onClick={() => navigator.clipboard.writeText(t.display_token)}
                    className="p-1 hover:text-green-400 transition-colors"
                    title="Copy Token"
                  >
                    <Copy size={16} />
                  </button>
                </td>
                <td className="p-4">{t.name}</td>
                <td className="p-4 text-gray-400">{t.temp_purpose}</td>
                <td className="p-4">
                  {editingTokenId === t.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editedTokenUses}
                        onChange={(e) => setEditedTokenUses(e.target.value)}
                        className="bg-white/10 border border-white/20 rounded px-1 py-1 text-sm text-white w-16 text-center"
                        min="0"
                        title="Current Uses"
                      />
                      <span className="text-gray-500">/</span>
                      <input
                        type="number"
                        value={editedTokenMaxUses}
                        onChange={(e) => setEditedTokenMaxUses(e.target.value)}
                        className="bg-white/10 border border-white/20 rounded px-1 py-1 text-sm text-white w-16 text-center"
                        min="0"
                        title="Max Uses"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <span className="text-gray-400">{t.uses} / {t.max_uses}</span>
                      <button
                        onClick={() => handleEditToken(t.id, t.uses, t.max_uses, t.expires_at)}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:text-blue-400 transition-all"
                        title="Edit Uses"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
                <td className="p-4">
                  {editingTokenId === t.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={editedTokenExpiry ? new Date(editedTokenExpiry).toISOString().slice(0, 16) : ''}
                        onChange={(e) => setEditedTokenExpiry(new Date(e.target.value).toISOString())}
                        className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                  ) : (
                    <span className="text-gray-400">
                      {new Date(t.expires_at) < new Date() ? "Expired" : formatDistanceToNow(new Date(t.expires_at), { addSuffix: true })}
                    </span>
                  )}
                </td>
                <td className="p-4">
                  {t.max_upload_size ? (
                    <span className="px-2 py-1 bg-yellow-900/30 text-yellow-200 text-xs rounded border border-yellow-500/30">
                      {(t.max_upload_size / 1024 / 1024).toFixed(0)} MB
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-green-900/30 text-green-200 text-xs rounded border border-green-500/30">
                      Unlimited
                    </span>
                  )}
                </td>
                <td className="p-4">
                  {t.allowed_folders && t.allowed_folders.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {t.allowed_folders.map(fid => (
                        <div key={fid} className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-900/50 text-blue-200 text-[10px] rounded border border-blue-500/30">
                          <span>{fid}</span>
                          <button
                            onClick={() => handleRemoveTokenFromFolder(t.id, fid)}
                            className="text-blue-300 hover:text-red-400 transition-colors px-1"
                            title="Remove from Folder"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-600 italic text-xs">All Folders</span>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    {editingTokenId === t.id ? (
                      <>
                        <button
                          onClick={() => handleSaveTokenEdits(t.id)}
                          className="p-1 hover:text-green-400 transition-colors"
                          title="Save"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingTokenId(null)}
                          className="p-1 hover:text-red-400 transition-colors"
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => navigator.clipboard.writeText(t.display_token)}
                          className="p-1 hover:text-green-400 transition-colors"
                          title="Copy Token"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteToken(t.id)}
                          className="p-1 hover:text-red-400 transition-colors"
                          title="Delete Token"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {data?.tokens.length === 0 && <div className="p-8 text-center text-gray-500">No active tokens found.</div>}
    </div>
  );

  const FilesTable = () => (
    <div className="overflow-x-auto overflow-y-auto h-full pb-4 custom-scrollbar">
      <div className="flex justify-end mb-4 pr-4">
        <NeoButton
          onClick={handleBulkDeleteFiles}
          disabled={selectedFiles.length === 0}
          className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded"
        >
          Delete Selected ({selectedFiles.length})
        </NeoButton>
      </div>
      <table className="w-full text-left text-sm font-mono whitespace-nowrap">
        <thead className="bg-white/5 text-gray-400 uppercase text-xs sticky top-0 backdrop-blur-md z-10">
          <tr>
            <th className="p-4">
              <input
                type="checkbox"
                onChange={handleSelectAllFiles}
                checked={selectedFiles.length === data?.files.length && data.files.length > 0}
                className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
              />
            </th>
            <th className="p-4">Type</th>
            <th className="p-4">ID</th>
            <th className="p-4">File Name</th>
            <th className="p-4">Size</th>
            <th className="p-4">Download Limit</th>
            <th className="p-4">Uploaded</th>
            <th className="p-4">IP Address</th>
            <th className="p-4">Device</th>
            <th className="p-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {data?.files
            .filter(f =>
              f.file_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
              f.original_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (f.title && f.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
              (f.ip_address && f.ip_address.toLowerCase().includes(searchQuery.toLowerCase())) ||
              (f.user_agent && f.user_agent.toLowerCase().includes(searchQuery.toLowerCase()))
            )
            .map(f => (
              <tr key={f.file_id} className="hover:bg-white/5 transition-colors">
                <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(f.file_id)}
                    onChange={() => handleSelectFile(f.file_id)}
                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                  />
                </td>
                <td className="p-4">
                  <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center">
                    {f.type === 'image' ? <ImageIcon size={18} /> :
                      f.type === 'video' ? <Film size={18} /> : <FileBox size={18} />}
                  </div>
                </td>
                <td className="p-4 text-xs text-gray-400 flex items-center gap-2">
                  {f.file_id}
                  <button
                    onClick={() => navigator.clipboard.writeText(f.file_id)}
                    className="p-1 hover:text-green-400 transition-colors"
                    title="Copy File ID"
                  >
                    <Copy size={16} />
                  </button>
                </td>
                <td className="p-4 max-w-[250px]">
                  {editingFileId === f.file_id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editedFileName}
                        onChange={(e) => setEditedFileName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveFileName(f.file_id);
                          if (e.key === 'Escape') setEditingFileId(null);
                        }}
                        className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white w-full"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveFileName(f.file_id)}
                        className="p-1 hover:text-green-400 transition-colors"
                        title="Save"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => setEditingFileId(null)}
                        className="p-1 hover:text-red-400 transition-colors"
                        title="Cancel"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <span className="truncate">{f.title || f.original_name}</span>
                      <button
                        onClick={() => handleEditFileName(f.file_id, f.original_name, f.title)}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:text-blue-400 transition-all"
                        title="Edit Name"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
                <td className="p-4 text-gray-400">{(f.size / 1024 / 1024).toFixed(2)} MB</td>
                <td className="p-4">
                  {editingDownloadLimitId === f.file_id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editedDownloadLimit}
                        onChange={(e) => setEditedDownloadLimit(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveDownloadLimit(f.file_id);
                          if (e.key === 'Escape') setEditingDownloadLimitId(null);
                        }}
                        className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white w-20"
                        autoFocus
                        min="0"
                      />
                      <button
                        onClick={() => handleSaveDownloadLimit(f.file_id)}
                        className="p-1 hover:text-green-400 transition-colors"
                        title="Save"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => setEditingDownloadLimitId(null)}
                        className="p-1 hover:text-red-400 transition-colors"
                        title="Cancel"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <span>{f.downloads_done} / {f.download_limit ?? '∞'}</span>
                      <button
                        onClick={() => handleEditDownloadLimit(f.file_id, f.download_limit)}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:text-blue-400 transition-all"
                        title="Edit Limit"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
                <td className="p-4 text-gray-400 text-xs">
                  {formatDistanceToNow(new Date(f.upload_time), { addSuffix: true })}
                </td>
                <td className="p-4 text-gray-400 text-xs font-mono">
                  {f.ip_address || 'N/A'}
                </td>
                <td className="p-4 text-gray-400 text-xs max-w-[200px]">
                  <div className="truncate" title={f.user_agent || 'N/A'}>
                    {f.user_agent || 'N/A'}
                  </div>
                </td>
                <td className="p-4">
                  <button
                    onClick={() => handleDeleteFile(f.file_id)}
                    className="p-1 text-red-400 hover:text-red-200 transition-colors"
                    title="Delete File"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {data?.files.length === 0 && <div className="p-8 text-center text-gray-500">No files stored.</div>}
    </div>
  );

  const LogsTable = () => (
    <div className="flex flex-col h-full bg-white/5 rounded-xl border border-white/10 overflow-hidden">
      <div className="p-4 bg-black/20 border-b border-white/10 flex justify-between items-center backdrop-blur-md">
        <div className="flex items-center gap-4">
          <h3 className="text-gray-200 font-bold flex items-center gap-2">
            <Activity size={18} className="text-purple-400" />
            Activity History
          </h3>
          <div className="relative w-48">
            <input
              type="text"
              placeholder="Search Logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-full px-3 py-1 text-xs text-white focus:border-purple-500/50 outline-none pl-8"
            />
            <div className="absolute left-2.5 top-1.5 text-gray-500">
              <SearchIcon size={12} />
            </div>
          </div>
        </div>
        <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">
          {data?.logs?.length || 0} Events
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left text-sm font-mono whitespace-nowrap">
          <thead className="bg-black/40 text-gray-400 uppercase text-xs sticky top-0 backdrop-blur-md z-10 border-b border-white/10">
            <tr>
              <th className="p-4 bg-black/40">Time</th>
              <th className="p-4 bg-black/40">Action</th>
              <th className="p-4 bg-black/40">User / Token</th>
              <th className="p-4 bg-black/40">Purpose</th>
              <th className="p-4 bg-black/40">IP Address</th>
              <th className="p-4 bg-black/40">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data?.logs
              .filter(l =>
                l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (l.file_id && l.file_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
                l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (l.ip && l.ip.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (l.temp_name && l.temp_name.toLowerCase().includes(searchQuery.toLowerCase()))
              )
              .map(l => (
                <tr key={l.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-4 text-gray-400 text-xs w-48">
                    <div className="flex flex-col">
                      <span className="text-gray-300">{new Date(l.timestamp).toLocaleDateString()}</span>
                      <span className="text-gray-500 text-[10px]">{new Date(l.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </td>
                  <td className="p-4 w-32">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${l.action === 'upload' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      l.action === 'download' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        l.action === 'delete' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      } `}>
                      {l.action === 'upload' && <UploadCloud size={12} />}
                      {l.action === 'download' && <Download size={12} />}
                      {l.action === 'delete' && <Trash2 size={12} />}
                      {l.action}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`font-medium ${l.name === 'Admin Panel' || l.name === 'MASTER' ? 'text-yellow-400' : 'text-gray-200'} `}>
                      {l.name || 'Unknown'}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 text-xs">
                    {l.temp_name ? (
                      <div className="flex items-center gap-2">
                        <span className="bg-white/5 px-2 py-1 rounded truncate max-w-[150px]" title={l.temp_name}>{l.temp_name}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(l.temp_name)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-white transition-opacity text-gray-500"
                          title="Copy Purpose"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="p-4 text-xs text-gray-500 font-mono">
                    {l.ip?.replace('::ffff:', '') || 'N/A'}
                  </td>
                  <td className="p-4 text-xs">
                    {l.file_id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 truncate max-w-[150px]">{l.file_id}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(l.file_id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-white transition-opacity text-gray-500"
                          title="Copy File ID"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {data?.logs.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500 gap-3">
            <Activity size={48} className="opacity-20" />
            <p>No activity logs recorded yet.</p>
          </div>
        )}
      </div>
    </div>
  );

  const R2ManagementTable = () => (
    <div className="overflow-x-auto overflow-y-auto h-full pb-4 custom-scrollbar">
      <div className="p-4 bg-blue-900/20 border-b border-blue-500/30 flex justify-between items-center text-sm text-blue-200">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} />
          Direct R2 storage management - Changes here don't affect database records
        </div>
        <div className="relative w-64">
          {/* Tab-Specific Search Bar */}
          <input
            type="text"
            placeholder="Search R2 Files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-blue-500/20 rounded-full px-4 py-1.5 text-sm text-blue-100 placeholder-blue-300/50 focus:border-blue-400 outline-none pl-10"
          />
          <div className="absolute left-3 top-2 text-blue-400/50">
            <SearchIcon size={14} />
          </div>
        </div>
      </div>

      <table className="w-full text-left text-sm font-mono">
        <thead className="bg-white/5 text-gray-400 uppercase text-xs sticky top-0 backdrop-blur-md z-10">
          <tr>
            <th className="p-4 w-10">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-blue-600"
                checked={selectedR2Files.length === r2Files.length && r2Files.length > 0}
                onChange={handleSelectAllFiles}
              />
            </th>
            <th className="p-4 min-w-[300px]">File Path</th>
            <th className="p-4 min-w-[120px]">Folder</th>
            <th className="p-4 min-w-[200px]">File Name</th>
            <th className="p-4 min-w-[100px]">Size</th>
            <th className="p-4 min-w-[150px]">Last Modified</th>
            <th className="p-4 min-w-[100px]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {r2Files
            .filter(file => file.key.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(file => {
              const pathParts = file.key.split('/');
              const folder = pathParts[1] || 'root';
              const fileName = pathParts[pathParts.length - 1] || file.key;

              return (
                <tr key={file.key} className="hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-blue-600"
                      checked={selectedR2Files.includes(file.key)}
                      onChange={() => handleSelectFile(file.key)}
                    />
                  </td>
                  <td className="p-4 text-xs text-gray-400 flex items-center gap-2">
                    {file.key}
                    <button
                      onClick={() => navigator.clipboard.writeText(file.key)}
                      className="p-1 hover:text-green-400 transition-colors"
                      title="Copy R2 Key"
                    >
                      <Copy size={16} />
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <FolderOpen size={16} className="text-yellow-400" />
                      <span className="text-yellow-200">{folder}</span>
                    </div>
                  </td>
                  <td className="p-4 text-white break-all">{fileName}</td>
                  <td className="p-4 text-gray-400 whitespace-nowrap">{(file.size / 1024 / 1024).toFixed(2)} MB</td>
                  <td className="p-4 text-gray-400 text-xs whitespace-nowrap">
                    {formatDistanceToNow(new Date(file.lastModified), { addSuffix: true })}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownloadR2File(file.key)}
                        className="p-1 hover:text-blue-400 transition-colors"
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteR2File(file.key)}
                        className="p-1 hover:text-red-400 transition-colors"
                        title="Delete from R2"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
      {r2Files.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          {r2Loading ? "Loading R2 files..." : "No files in R2 storage"}
        </div>
      )}
    </div>
  );

  const FoldersTable = () => (
    <div className="h-full flex flex-col gap-6 p-1">
      {/* Create Folder Section */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
          <Folder size={16} /> Create New Folder
        </h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <NeoInput
              placeholder={isAutoFolderId ? "Auto-generated ID" : "Folder Name"}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              disabled={isAutoFolderId}
            />
          </div>
          <div className="flex-1">
            <NeoInput
              placeholder="Zip Password (Optional)"
              value={newFolderPassword}
              onChange={(e) => setNewFolderPassword(e.target.value)}
              type="password"
            />
          </div>
          <div className="flex items-center gap-2 pb-3">
            <input
              type="checkbox"
              id="autoId"
              checked={isAutoFolderId}
              onChange={(e) => setIsAutoFolderId(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="autoId" className="text-sm text-gray-400">Auto ID</label>
          </div>
          <NeoButton onClick={handleCreateFolder}>
            Create
          </NeoButton>
        </div>
        {isAutoFolderId && (
          <p className="text-xs text-blue-300 mt-2 flex items-center gap-1">
            <AlertCircle size={12} /> Folder ID will be a random 6-character code (e.g. 'A7X92B')
          </p>
        )}
      </div>

      {/* List of Folders */}
      <div className="overflow-x-auto overflow-y-auto pb-4 custom-scrollbar">
        <table className="w-full text-left text-sm font-mono mb-6">
          <thead className="bg-white/5 text-gray-400 uppercase text-xs sticky top-0 backdrop-blur-md z-10">
            <tr>
              <th className="p-4">Folder ID</th>
              <th className="p-4">Name</th>
              <th className="p-4">Type</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {data?.folders.map(f => (
              <tr key={f.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 font-bold text-blue-300">
                  {f.id}
                  <button onClick={() => navigator.clipboard.writeText(f.id)} className="ml-2 hover:text-white"><Copy size={12} /></button>
                </td>
                <td className="p-4 text-white">{f.name}</td>
                <td className="p-4 text-gray-500 text-xs">
                  {f.is_auto_generated ? 'Auto-ID' : 'Manual'}
                </td>
                <td className="p-4">
                  {/* Placeholder for future actions like delete folder */}
                  <span className="text-gray-600 text-xs">--</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.folders.length === 0 && <div className="p-8 text-center text-gray-500">No folders created yet.</div>}
      </div>

      {/* Assign Tokens to Folders */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
          <Key size={16} /> Assign Token to Folder
        </h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Select Token</label>
            <select
              className="w-full bg-black/50 border border-white/20 rounded p-2 text-white text-sm focus:border-white/50 outline-none"
              value={assigningTokenId || ''}
              onChange={(e) => setAssigningTokenId(e.target.value)}
            >
              <option value="">-- Choose Token --</option>
              {data?.tokens.map(t => (
                <option key={t.id} value={t.id}>{t.display_token} ({t.name})</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Select Folder</label>
            <select
              className="w-full bg-black/50 border border-white/20 rounded p-2 text-white text-sm focus:border-white/50 outline-none"
              value={selectedFolderForToken}
              onChange={(e) => setSelectedFolderForToken(e.target.value)}
            >
              <option value="">-- Choose Folder --</option>
              {data?.folders.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.id})</option>
              ))}
            </select>
          </div>
          <NeoButton onClick={handleAssignToken} disabled={!assigningTokenId || !selectedFolderForToken}>
            Assign Access
          </NeoButton>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Restricts the token to ONLY upload/download within this folder.
        </p>
      </div>
    </div>
  );
  const DeviceLogsTable = () => (
    <div className="flex flex-col h-full bg-white/5 rounded-xl border border-white/10 overflow-hidden">
      <div className="p-4 bg-black/20 border-b border-white/10 flex justify-between items-center backdrop-blur-md">
        <div className="flex items-center gap-4">
          <h3 className="text-gray-200 font-bold flex items-center gap-2">
            <FileBox size={18} className="text-green-400" />
            Device Upload Logs
          </h3>
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Search Device Logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-full px-3 py-1 text-xs text-white focus:border-green-500/50 outline-none pl-8"
            />
            <div className="absolute left-2.5 top-1.5 text-gray-500">
              <SearchIcon size={12} />
            </div>
          </div>
        </div>
        <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">
          {data?.files?.length || 0} Records
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left text-sm font-mono whitespace-nowrap">
          <thead className="bg-black/40 text-gray-400 uppercase text-xs sticky top-0 backdrop-blur-md z-10 border-b border-white/10">
            <tr>
              <th className="p-4 bg-black/40">IP Address</th>
              <th className="p-4 bg-black/40">Device Name (User Agent)</th>
              <th className="p-4 bg-black/40">File ID</th>
              <th className="p-4 bg-black/40">Upload Time</th>
              <th className="p-4 bg-black/40">Size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data?.files
              .filter(f =>
                (f.ip_address && f.ip_address.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (f.user_agent && f.user_agent.toLowerCase().includes(searchQuery.toLowerCase())) ||
                f.file_id.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map(f => (
                <tr key={f.file_id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-4 text-blue-300 font-bold">
                    {f.ip_address || 'N/A'}
                  </td>
                  <td className="p-4 text-gray-300 max-w-[300px] truncate" title={f.user_agent}>
                    {f.user_agent || 'N/A'}
                  </td>
                  <td className="p-4 text-gray-400">
                    {f.file_id}
                  </td>
                  <td className="p-4 text-gray-500 text-xs text-right">
                    {f.upload_time ? new Date(f.upload_time).toLocaleString() : 'N/A'}
                  </td>
                  <td className="p-4 text-gray-400">
                    {(f.size / 1024 / 1024).toFixed(2)} MB
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {data?.files.length === 0 && (
          <div className="p-12 text-center text-gray-500">No upload records found.</div>
        )}
      </div>
    </div>
  );
  return (
    <div className="flex w-full h-full bg-[#050505] md:bg-[#050505]/80 md:backdrop-blur-xl md:rounded-3xl md:border md:border-white/10 overflow-hidden font-sans selection:bg-blue-500/30 relative shadow-2xl">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/20 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-900/20 blur-[100px]" />
      </div>

      {/* Sidebar Navigation */}
      <div className="w-20 md:w-72 flex-shrink-0 h-full border-r border-white/5 bg-[#050505]/80 backdrop-blur-xl flex flex-col z-20 transition-all duration-300">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Shield size={18} className="text-white" />
          </div>
          <div className="hidden md:block">
            <h1 className="font-bold text-lg tracking-wide text-white">ADMIN<span className="text-gray-500 font-light">PANEL</span></h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
          <div className="text-xs font-mono text-gray-600 uppercase tracking-widest px-4 mb-2 hidden md:block">Overview</div>
          <SidebarItem
            active={activeTab === 'tokens'}
            onClick={() => setActiveTab('tokens')}
            icon={<Key size={20} />}
            label="Access Tokens"
          />
          <SidebarItem
            active={activeTab === 'uploads'}
            onClick={() => setActiveTab('uploads')}
            icon={<FileText size={20} />}
            label="File Uploads"
          />
          <SidebarItem
            active={activeTab === 'folders'}
            onClick={() => setActiveTab('folders')}
            icon={<Folder size={20} />}
            label="Folders"
          />

          <div className="my-4 border-t border-white/5 mx-4" />

          <div className="text-xs font-mono text-gray-600 uppercase tracking-widest px-4 mb-2 hidden md:block">Storage</div>
          <SidebarItem
            active={activeTab === 'r2'}
            onClick={() => setActiveTab('r2')}
            icon={<HardDrive size={20} />}
            label="R2 Bucket"
          />
          <SidebarItem
            active={activeTab === 'share'}
            onClick={() => setActiveTab('share')}
            icon={<Share2 size={20} />}
            label="Share Links"
          />
          <SidebarItem
            active={activeTab === 'qr'}
            onClick={() => setActiveTab('qr')}
            icon={<Maximize2 size={20} />}
            label="QR Generator"
          />

          <div className="my-4 border-t border-white/5 mx-4" />

          <div className="text-xs font-mono text-gray-600 uppercase tracking-widest px-4 mb-2 hidden md:block">System</div>
          <SidebarItem
            active={activeTab === 'create'}
            onClick={() => setActiveTab('create')}
            icon={<PlusCircle size={20} />}
            label="Create Token"
          />
          <SidebarItem
            active={activeTab === 'logs'}
            onClick={() => setActiveTab('logs')}
            icon={<Activity size={20} />}
            label="Activity Logs"
          />
          <SidebarItem
            active={activeTab === 'device_logs'}
            onClick={() => setActiveTab('device_logs')}
            icon={<FileBox size={20} />}
            label="Device Logs"
          />
        </div>



        <div className="p-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all group"
          >
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="hidden md:block font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">

        {/* Header */}
        <header className="h-16 border-b border-white/5 bg-[#050505]/50 backdrop-blur-md flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-medium text-white tracking-tight">
              {activeTab === 'tokens' && 'Access Management'}
              {activeTab === 'uploads' && 'Upload History'}
              {activeTab === 'folders' && 'Folder Structure'}
              {activeTab === 'r2' && 'R2 Storage Explorer'}
              {activeTab === 'create' && 'Generate Access'}
              {activeTab === 'logs' && 'System Activity'}
              {activeTab === 'share' && 'Share Links'}
              {activeTab === 'qr' && 'QR Codes'}
              {activeTab === 'device_logs' && 'Device Upload Logs'}
            </h2>
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-black/20 border border-white/10 rounded-full px-4 py-1.5 text-sm text-white focus:border-blue-500/50 outline-none w-48 md:w-64 transition-all focus:w-72"
              />
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] items-center bg-white/5 text-gray-500 border border-white/5 hidden sm:flex">
              v2.5.0
            </span>
          </div>

          <div className="flex items-center gap-3">
            {selectedR2Files.length > 0 && activeTab === 'r2' && (
              <NeoButton
                size="sm"
                variant="danger"
                onClick={handleBulkDeleteR2Files}
              >
                Delete ({selectedR2Files.length})
              </NeoButton>
            )}

            <button
              onClick={() => activeTab === 'r2' ? fetchR2Files() : fetchData(true)}
              className={`p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all ${(loading || r2Loading) ? 'animate-spin' : ''}`}
              title="Refresh Data"
            >
              <RefreshCw size={18} />
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-gray-800 to-gray-900 border border-white/10 flex items-center justify-center">
              <span className="text-xs font-bold text-gray-400">AD</span>
            </div>
          </div>
        </header >

        {/* Scrollable Content */}
        < div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8" >
          <div className="max-w-7xl mx-auto space-y-6">

            {loading && !data && activeTab !== 'r2' ? (
              <div className="flex flex-col items-center justify-center p-20 text-gray-500 gap-4">
                <Loader2 size={40} className="animate-spin text-blue-500/50" />
                <p className="font-mono text-sm tracking-widest">INITIALIZING DATA STREAM...</p>
              </div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {activeTab === 'tokens' && <TokenTable />}
                {activeTab === 'uploads' && <FilesTable />}
                {activeTab === 'folders' && <FoldersTable />}
                {activeTab === 'r2' && (
                  <R2FileManager
                    initialFolders={data?.folders || []}
                    refreshData={() => fetchData(false)}
                    masterToken={masterToken}
                  />
                )}
                {activeTab === 'logs' && <LogsTable />}
                {activeTab === 'share' && (
                  <ShareManager
                    folders={data?.folders || []}
                    tokens={data?.tokens || []}
                    refreshData={() => fetchData(false)}
                  />
                )}
                {activeTab === 'qr' && (
                  <QRManager
                    folders={data?.folders || []}
                    tokens={data?.tokens || []}
                  />
                )}
                {activeTab === 'device_logs' && (
                  <DeviceLogsTable />
                )}
                {activeTab === 'create' && (
                  <div className="max-w-2xl mx-auto">
                    <GlassCard className="border-t-4 border-t-blue-500">
                      <div className="mb-8 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 mb-4">
                          <Key size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Generate Access Token</h3>
                        <p className="text-gray-400 text-sm">Create a new secure access token for file operations.</p>
                      </div>

                      {createError && (
                        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3 text-red-200 text-sm">
                          <AlertCircle size={18} className="flex-shrink-0" />
                          {createError}
                        </div>
                      )}

                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <NeoInput
                            label="Token Code"
                            placeholder="Auto-generated if empty"
                            value={customTokenCode}
                            onChange={(e) => setCustomTokenCode(e.target.value.toUpperCase())}
                          />
                          <div>
                            <label className="text-xs font-mono text-gray-400 uppercase tracking-widest pl-1 mb-2 block">Permission Scope</label>
                            <div className="grid grid-cols-3 gap-2">
                              {['both', 'upload', 'download'].map((perm) => (
                                <button
                                  key={perm}
                                  onClick={() => setCustomPermission(perm as any)}
                                  className={`px-3 py-3 rounded-lg text-xs font-medium uppercase tracking-wider border transition-all ${customPermission === perm ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/30'}`}
                                >
                                  {perm}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <NeoInput
                          label="Recipient Name"
                          placeholder="Who is this for?"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                        />

                        <NeoInput
                          label="Purpose / Notes"
                          placeholder="Internal reference note"
                          value={customPurpose}
                          onChange={(e) => setCustomPurpose(e.target.value)}
                        />

                        {/* Upload Size */}
                        <div>
                          <label className="text-xs font-mono text-gray-400 uppercase tracking-widest pl-1 mb-2 block">Upload Limit</label>
                          <div className="flex gap-2 p-1 bg-black/40 rounded-lg border border-white/10">
                            {[
                              { val: 524288000, label: '500MB' },
                              { val: 1073741824, label: '1GB' },
                              { val: null, label: 'Unlimited' }
                            ].map((opt) => (
                              <button
                                key={opt.label}
                                onClick={() => setCustomMaxUploadSize(opt.val)}
                                className={`flex-1 py-2 text-xs rounded-md transition-all ${customMaxUploadSize === opt.val ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <NeoInput
                            type="number"
                            label="Expires In (Minutes)"
                            value={customExpiry}
                            onChange={e => setCustomExpiry(e.target.value)}
                          />
                          <NeoInput
                            type="number"
                            label="Max Uses"
                            value={customMaxUses}
                            onChange={e => setCustomMaxUses(e.target.value)}
                          />
                        </div>

                        <div className="pt-4">
                          <NeoButton
                            className="w-full h-12 text-base"
                            onClick={handleCreateToken}
                            isLoading={creatingToken}
                            disabled={!customName}
                          >
                            Generate Secure Token
                          </NeoButton>
                        </div>

                      </div>
                    </GlassCard>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div >
  );
}

const SidebarItem = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${active ? 'bg-blue-600/10 text-blue-400' : 'text-gray-500 hover:bg-white/5 hover:text-gray-200'}`}
  >
    <span className={`transition-colors ${active ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'}`}>
      {icon}
    </span>
    <span className={`font-medium text-sm hidden md:block ${active ? 'text-blue-100' : 'text-gray-400 group-hover:text-gray-200'}`}>
      {label}
    </span>
    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)] hidden md:block" />}
  </button>
);