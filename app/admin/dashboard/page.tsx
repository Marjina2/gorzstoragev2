
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from '../../../lib/use-router';
import { GlassCard, NeoButton, NeoInput } from '../../../components/GlassUI';
import { getAdminData, deleteFile, deleteToken, createCustomToken, updateFileMetadata, listAllR2Files, deleteR2File, getR2FileUrl, updateTokenMetadata, deleteExpiredTokens, updateRestoreTimer, createFolder, getFolders, assignTokenToFolder } from '../../../services/mockApi';
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
  Maximize2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ShareManager } from './ShareManager';
import { QRManager } from './QRManager';

type Tab = 'tokens' | 'uploads' | 'create' | 'logs' | 'r2' | 'folders' | 'share' | 'qr';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('tokens');
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
    const restoreTimerInterval = setInterval(() => updateRestoreTimer(), 60 * 60 * 1000); // Update restore timer every hour

    return () => {
      clearInterval(dataFetchInterval);
      clearInterval(tokenCleanupInterval);
      clearInterval(restoreTimerInterval);
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

  const TokenTable = () => (
    <div className="overflow-x-auto h-full pb-4">
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
          {data?.tokens.map(t => (
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
                      <span key={fid} className="px-1.5 py-0.5 bg-blue-900/50 text-blue-200 text-[10px] rounded border border-blue-500/30">
                        {fid}
                      </span>
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
    <div className="overflow-x-auto h-full pb-4">
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
          {data?.files.map(f => (
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
        <h3 className="text-gray-200 font-bold flex items-center gap-2">
          <Activity size={18} className="text-purple-400" />
          Activity History
        </h3>
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
            {data?.logs.map(l => (
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
    <div className="overflow-x-auto h-full pb-4">
      <div className="p-4 bg-blue-900/20 border-b border-blue-500/30 flex items-center gap-2 text-sm text-blue-200">
        <AlertCircle size={16} />
        Direct R2 storage management - Changes here don't affect database records
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
          {r2Files.map(file => {
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
      <div className="overflow-x-auto pb-4">
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

  return (
    <div className="w-full md:h-[85vh] flex flex-col md:flex-row gap-4 md:gap-6">
      {/* Sidebar Nav */}
      <GlassCard className="w-full md:w-64 flex flex-col p-4 md:p-6 shrink-0 order-1 md:order-none">
        <h1 className="text-lg md:text-xl font-bold tracking-widest mb-4 md:mb-8 text-center md:text-left flex justify-between md:block items-center">
          <span>ADMIN<span className="font-light text-gray-400">PANEL</span></span>
          <button onClick={handleLogout} className="md:hidden text-red-400"><LogOut size={18} /></button>
        </h1>

        <nav className="grid grid-cols-2 sm:grid-cols-4 md:flex md:flex-col gap-2 md:space-y-2">
          <button
            onClick={() => setActiveTab('tokens')}
            className={`w-full flex items-center justify-center md:justify-start gap-2 p-2 md:p-3 rounded-lg text-xs md:text-sm transition-all ${activeTab === 'tokens' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:bg-white/10 hover:text-white'} `}
          >
            <Key size={16} /> Tokens
          </button>
          <button
            onClick={() => setActiveTab('folders')}
            className={`w-full flex items-center justify-center md:justify-start gap-2 p-2 md:p-3 rounded-lg text-xs md:text-sm transition-all ${activeTab === 'folders' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:bg-white/10 hover:text-white'} `}
          >
            <Folder size={16} /> Folders
          </button>
          <button
            onClick={() => setActiveTab('uploads')}
            className={`w-full flex items-center justify-center md:justify-start gap-2 p-2 md:p-3 rounded-lg text-xs md:text-sm transition-all ${activeTab === 'uploads' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:bg-white/10 hover:text-white'} `}
          >
            <FileText size={16} /> Uploads
          </button>
          <button
            onClick={() => setActiveTab('r2')}
            className={`w-full flex items-center justify-center md:justify-start gap-2 p-2 md:p-3 rounded-lg text-xs md:text-sm transition-all ${activeTab === 'r2' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:bg-white/10 hover:text-white'} `}
          >
            <HardDrive size={16} /> R2 Storage
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`w-full flex items-center justify-center md:justify-start gap-2 p-2 md:p-3 rounded-lg text-xs md:text-sm transition-all ${activeTab === 'create' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:bg-white/10 hover:text-white'} `}
          >
            <Plus size={16} /> Create
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center justify-center md:justify-start gap-2 p-2 md:p-3 rounded-lg text-xs md:text-sm transition-all ${activeTab === 'logs' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:bg-white/10 hover:text-white'} `}
          >
            <Activity size={16} /> History
          </button>
          <button
            onClick={() => setActiveTab('share')}
            className={`w-full flex items-center justify-center md:justify-start gap-2 p-2 md:p-3 rounded-lg text-xs md:text-sm transition-all ${activeTab === 'share' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:bg-white/10 hover:text-white'} `}
          >
            <LinkIcon size={16} /> Share Links
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`w-full flex items-center justify-center md:justify-start gap-2 p-2 md:p-3 rounded-lg text-xs md:text-sm transition-all ${activeTab === 'qr' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:bg-white/10 hover:text-white'} `}
          >
            <Maximize2 size={16} /> QR Codes
          </button>
        </nav>

        <button
          onClick={handleLogout}
          className="hidden md:flex mt-auto items-center gap-3 p-3 rounded-lg text-sm text-red-400 hover:bg-red-900/20 transition-all"
        >
          <LogOut size={16} /> Logout
        </button>
      </GlassCard>

      {/* Main Content Area */}
      <GlassCard className="flex-1 flex flex-col p-4 md:p-6 order-2 md:order-none md:min-h-0 md:overflow-hidden">
        <div className="flex items-center justify-between mb-4 md:mb-6 flex-shrink-0">
          <h2 className="text-base md:text-lg font-semibold uppercase tracking-wider">
            {activeTab === 'tokens' ? 'Tokens' :
              activeTab === 'uploads' ? 'Uploads' :
                activeTab === 'logs' ? 'Activity Logs' :
                  activeTab === 'folders' ? 'Folders' :
                    activeTab === 'create' ? 'Create Token' :
                      activeTab === 'share' ? 'Share Links' :
                        activeTab === 'qr' ? 'QR Codes' :
                          activeTab === 'r2' ? 'R2 Storage' : activeTab}
          </h2>
          <button
            onClick={() => activeTab === 'r2' ? fetchR2Files() : fetchData(true)}
            className={`text-gray-400 hover:text-white transition-all ${(loading || r2Loading) ? 'animate-spin' : ''} `}
          >
            <RefreshCw size={18} />
          </button>
          {selectedR2Files.length > 0 && (
            <NeoButton
              onClick={handleBulkDeleteR2Files}
              className="ml-2 bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Selected ({selectedR2Files.length})
            </NeoButton>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-0 min-h-0">
          {loading && !data && activeTab !== 'r2' ? (
            <div className="w-full h-full flex items-center justify-center text-gray-500">Loading Data...</div>
          ) : (
            <>
              {activeTab === 'tokens' && <TokenTable />}
              {activeTab === 'uploads' && <FilesTable />}
              {activeTab === 'logs' && <LogsTable />}
              {activeTab === 'r2' && (
                <GlassCard className="h-full flex flex-col overflow-hidden bg-black/40 backdrop-blur-xl border-white/10">
                  <R2FileManager
                    initialFolders={data?.folders || []}
                    refreshData={() => fetchData(false)}
                    masterToken={masterToken}
                  />
                </GlassCard>
              )}
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
              {activeTab === 'folders' && <FoldersTable />}
              {activeTab === 'create' && (
                <div className="p-4 md:p-8 max-w-2xl mx-auto w-full space-y-4 md:space-y-6">
                  <div className="text-center mb-4 md:mb-6">
                    <h3 className="text-lg md:text-xl tracking-widest uppercase mb-1">Custom Token</h3>
                    <p className="text-xs text-gray-500 font-mono">MANUAL OVERRIDE PROTOCOL</p>
                  </div>

                  {createError && (
                    <div className="bg-red-900/20 border border-red-500/30 p-3 rounded flex items-center gap-2 text-xs text-red-200">
                      <AlertCircle size={14} /> {createError}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <NeoInput
                          label="Token Code (Leave empty for auto)"
                          placeholder="e.g. MYSUPERTOKEN"
                          value={customTokenCode}
                          onChange={(e) => setCustomTokenCode(e.target.value.toUpperCase())}
                        />
                      </div>
                      <div className="w-1/3">
                        <label className="text-xs text-gray-500 mb-1 block">Permission</label>
                        <select
                          className="w-full bg-black/50 border border-white/20 rounded p-2 text-white text-sm focus:border-white/50 outline-none"
                          value={customPermission}
                          onChange={(e) => setCustomPermission(e.target.value as any)}
                        >
                          <option value="both">Upload & Download</option>
                          <option value="upload">Upload Only</option>
                          <option value="download">Download Only</option>
                        </select>
                      </div>
                    </div>

                    {/* Upload Size Limit */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Max Upload Size</label>
                      <select
                        className="w-full bg-black/50 border border-white/20 rounded p-2 text-white text-sm focus:border-white/50 outline-none"
                        value={customMaxUploadSize || ''}
                        onChange={(e) => setCustomMaxUploadSize(e.target.value ? parseInt(e.target.value) : null)}
                      >
                        <option value="524288000">500 MB (Default)</option>
                        <option value="">Unlimited</option>
                      </select>
                      <p className="text-[10px] text-gray-500 mt-1">Maximum file size that can be uploaded with this token</p>
                    </div>

                    <div className="flex gap-4">
                      <NeoInput
                        label="Token Name"
                        placeholder="e.g. Client X"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="flex-1"
                      />
                      <NeoInput
                        label="Purpose / Note"
                        placeholder="e.g. Project deliverable"
                        value={customPurpose}
                        onChange={(e) => setCustomPurpose(e.target.value)}
                        className="flex-1"
                      />
                    </div>

                    {/* Restrict to Folders - DISABLED */}
                    <div className="opacity-50 pointer-events-none">
                      <label className="text-xs text-gray-500 mb-1 block">Restrict to Folders (Disabled)</label>
                      <div className="flex flex-wrap gap-2 bg-black/50 border border-white/20 rounded p-2 min-h-[40px]">
                        {data?.folders.map(f => (
                          <button
                            key={f.id}
                            disabled
                            className={`px-2 py-1 rounded text-xs border ${customAllowedFolders.includes(f.id) ? 'bg-blue-600 border-blue-400 text-white' : 'bg-transparent border-gray-600 text-gray-400'}`}
                          >
                            {f.name}
                          </button>
                        ))}
                        {(!data?.folders || data.folders.length === 0) && <span className="text-gray-600 text-xs italic">No folders available</span>}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">Feature temporarily disabled</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <NeoInput
                        type="number"
                        label="Minutes"
                        value={customExpiry}
                        onChange={e => setCustomExpiry(e.target.value)}
                        min={1}
                      />
                      <NeoInput
                        label="Max Uses"
                        placeholder="e.g., 1"
                        type="number"
                        value={customMaxUses}
                        onChange={(e) => setCustomMaxUses(e.target.value)}
                        className="text-center"
                      />
                    </div>

                    <div className="pt-4">
                      <NeoButton
                        className="w-full"
                        onClick={handleCreateToken}
                        isLoading={creatingToken}
                        disabled={!customName}
                      >
                        Generate
                      </NeoButton>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </GlassCard>
    </div>
  );
}