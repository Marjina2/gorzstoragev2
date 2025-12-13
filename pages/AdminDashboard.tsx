import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, NeoButton, NeoInput } from '../components/GlassUI';
import { getAdminData, deleteFile, deleteToken, createCustomToken, createFolder, getFolders, assignTokenToFolder } from '../services/mockApi';
import { TokenRecord, FileRecord, ActivityLog, FolderRecord } from '../types';
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
  Folder,
  Shield // For Assign Access
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { updateFileToken } from '../services/mockApi';

type Tab = 'tokens' | 'uploads' | 'folders' | 'create' | 'logs';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('tokens');
  const [data, setData] = useState<{ tokens: TokenRecord[], files: FileRecord[], logs: ActivityLog[], folders: FolderRecord[] } | null>(null);
  const [loading, setLoading] = useState(true);

  // Custom Token Form
  const [customTokenCode, setCustomTokenCode] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPurpose, setCustomPurpose] = useState('');
  const [customExpiry, setCustomExpiry] = useState('60'); // Default 60 mins
  const [customMaxUses, setCustomMaxUses] = useState('1');
  const [creatingToken, setCreatingToken] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]); // For token creation

  // Folder Creation Form
  const [folderName, setFolderName] = useState('');
  const [isAutoFolder, setIsAutoFolder] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);

  // State for Change Token Modal
  const [showChangeTokenModal, setShowChangeTokenModal] = useState(false);
  const [fileToChangeToken, setFileToChangeToken] = useState<FileRecord | null>(null);
  const [newTokenInput, setNewTokenInput] = useState('');
  const [changingToken, setChangingToken] = useState(false);
  const [changeTokenError, setChangeTokenError] = useState<string | null>(null);

  // State for Assign Token Modal
  const [showAssignTokenModal, setShowAssignTokenModal] = useState(false);
  const [folderToAssign, setFolderToAssign] = useState<FolderRecord | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [assigningToken, setAssigningToken] = useState(false);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const adminData = await getAdminData();
    const foldersData = await getFolders();
    setData({ ...adminData, folders: foldersData });
    if (showLoading) setLoading(false);
  };

  useEffect(() => {
    fetchData(true); // Initial load with spinner
    const interval = setInterval(() => fetchData(false), 10000); // Background refresh without spinner
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    navigate('/admin');
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
        'both', // Default permission
        selectedFolderIds
      );
      // Reset form
      setCustomTokenCode('');
      setCustomName('');
      setCustomPurpose('');
      setCustomExpiry('60');
      setCustomMaxUses('1');
      setSelectedFolderIds([]);

      await fetchData(false); // Refresh list
      setActiveTab('tokens');
    } catch (err: any) {
      setCreateError(err.message || "Failed to create token");
    } finally {
      setCreatingToken(false);
    }
  };

  const handleCreateFolder = async () => {
    setCreatingFolder(true);
    setCreateFolderError(null);
    try {
      if (!isAutoFolder && !folderName) throw new Error("Folder name is required.");
      await createFolder(folderName, isAutoFolder);
      setFolderName('');
      setIsAutoFolder(false);
      await fetchData(false);
      setActiveTab('folders'); // Stay on folders tab
    } catch (err: any) {
      setCreateFolderError(err.message || "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleAssignToken = async () => {
    if (!folderToAssign || !selectedTokenId) return;
    setAssigningToken(true);
    try {
      await assignTokenToFolder(selectedTokenId, folderToAssign.id);
      setShowAssignTokenModal(false);
      setFolderToAssign(null);
      setSelectedTokenId('');
      fetchData(false);
    } catch (err: any) {
      alert('Failed to assign token: ' + err.message);
    } finally {
      setAssigningToken(false);
    }
  };

  const handleDeleteToken = async (id: string) => {
    await deleteToken(id);
    fetchData(false);
  }

  const handleDeleteFile = async (id: string) => {
    await deleteFile(id);
    fetchData(false);
  }

  const handleChangeTokenSubmit = async () => {
    if (!fileToChangeToken || !newTokenInput) return;

    setChangingToken(true);
    setChangeTokenError(null);
    try {
      await updateFileToken(fileToChangeToken.file_id, newTokenInput);
      await fetchData(false); // Refresh data
      setShowChangeTokenModal(false);
      setNewTokenInput('');
    } catch (err: any) {
      setChangeTokenError(err.message || "Failed to update token");
    } finally {
      setChangingToken(false);
    }
  };

  const toggleFolderSelection = (folderId: string) => {
    setSelectedFolderIds(prev =>
      prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]
    );
  };

  // --- SUB-COMPONENTS FOR TABLES ---

  const TokenTable = () => (
    <div className="overflow-x-auto overflow-y-auto h-full">
      <table className="w-full text-left text-sm font-mono">
        <thead className="bg-white/5 text-gray-400 uppercase text-xs sticky top-0 backdrop-blur-md z-10">
          <tr>
            <th className="p-4">Token</th>
            <th className="p-4">Name</th>
            <th className="p-4">Permissions</th>
            <th className="p-4">Uses</th>
            <th className="p-4">Expires</th>
            <th className="p-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {data?.tokens.map(t => (
            <tr key={t.id} className="hover:bg-white/5 transition-colors">
              <td className="p-4 text-white font-bold">{t.display_token}</td>
              <td className="p-4">{t.name}</td>
              <td className="p-4 text-gray-400">
                {t.allowed_folders && t.allowed_folders.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {t.allowed_folders.map(fid => (
                      <span key={fid} className="px-1.5 py-0.5 bg-blue-500/20 text-blue-200 text-[10px] rounded">{fid}</span>
                    ))}
                  </div>
                ) : <span className="opacity-50">Global</span>}
              </td>
              <td className="p-4 text-gray-400">{t.uses} / {t.max_uses}</td>
              <td className="p-4 text-gray-400">
                {formatDistanceToNow(new Date(t.expires_at), { addSuffix: true })}
              </td>
              <td className="p-4 flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(t.display_token)}
                  className="p-1 hover:text-green-400 transition-colors"
                  title="Copy"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => handleDeleteToken(t.id)}
                  className="p-1 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data?.tokens.length === 0 && <div className="p-8 text-center text-gray-500">No active tokens found.</div>}
    </div>
  );

  const FoldersTable = () => (
    <div className="overflow-x-auto h-full">
      {/* Create Folder Section Inline */}
      <div className="p-4 bg-white/5 border-b border-white/10 flex flex-col md:flex-row gap-4 items-end md:items-center">
        <div className="text-sm font-bold tracking-wider text-gray-400 w-full md:w-auto">NEW FOLDER:</div>
        <div className="flex-1 w-full md:w-auto">
          <NeoInput
            placeholder={isAutoFolder ? "Auto-Generated ID" : "Folder Name"}
            value={folderName}
            onChange={e => setFolderName(e.target.value)}
            disabled={isAutoFolder}
            className="mb-0"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={isAutoFolder} onChange={e => setIsAutoFolder(e.target.checked)} className="accent-blue-500" />
          <span className="text-sm text-gray-300">Auto-ID</span>
        </label>
        <NeoButton onClick={handleCreateFolder} isLoading={creatingFolder} disabled={!isAutoFolder && !folderName} size="sm">
          <Plus size={16} className="mr-1" /> Create
        </NeoButton>
      </div>

      {createFolderError && (
        <div className="bg-red-900/20 border-b border-red-500/30 p-2 text-center text-xs text-red-200">
          {createFolderError}
        </div>
      )}

      <table className="w-full text-left text-sm font-mono">
        <thead className="bg-white/5 text-gray-400 uppercase text-xs sticky top-0 backdrop-blur-md z-10">
          <tr>
            <th className="p-4">ID</th>
            <th className="p-4">Name</th>
            <th className="p-4">Created</th>
            <th className="p-4">Files</th>
            <th className="p-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {data?.folders.map(f => {
            const fileCount = data?.files.filter(file => file.folder_id === f.id).length || 0;
            return (
              <tr key={f.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 text-white font-bold">{f.id}</td>
                <td className="p-4">{f.name}</td>
                <td className="p-4 text-gray-400">{new Date(f.created_at).toLocaleDateString()}</td>
                <td className="p-4">{fileCount}</td>
                <td className="p-4">
                  <button
                    onClick={() => {
                      setFolderToAssign(f);
                      setShowAssignTokenModal(true);
                    }}
                    className="p-1 px-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 rounded text-xs flex items-center gap-1 transition-colors"
                  >
                    <Shield size={12} /> Access
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {(!data?.folders || data.folders.length === 0) && <div className="p-8 text-center text-gray-500">No custom folders created.</div>}
    </div>
  );

  const FilesTable = () => (
    <div className="overflow-x-auto h-full">
      <table className="w-full text-left text-sm font-mono">
        <thead className="bg-white/5 text-gray-400 uppercase text-xs sticky top-0 backdrop-blur-md z-10">
          <tr>
            <th className="p-4">Preview</th>
            <th className="p-4">Name</th>
            <th className="p-4">Folder</th>
            <th className="p-4">Size</th>
            <th className="p-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {data?.files.map(f => (
            <tr key={f.file_id} className="hover:bg-white/5 transition-colors">
              <td className="p-4">
                <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center">
                  {f.type === 'image' ? <ImageIcon size={18} /> :
                    f.type === 'video' ? <Film size={18} /> : <FileBox size={18} />}
                </div>
              </td>
              <td className="p-4 truncate max-w-[200px]">
                <div>{f.original_name}</div>
                <div className="text-[10px] text-gray-500">{f.file_id}</div>
              </td>
              <td className="p-4 text-gray-300 text-xs">
                {f.folder_id ? <span className="bg-white/5 px-2 py-1 rounded">{f.folder_id}</span> : '-'}
              </td>
              <td className="p-4 text-gray-400">{(f.size / 1024 / 1024).toFixed(2)} MB</td>
              <td className="p-4">
                <button
                  onClick={() => handleDeleteFile(f.file_id)}
                  className="p-1 text-red-400 hover:text-red-200 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  onClick={() => {
                    setFileToChangeToken(f);
                    setShowChangeTokenModal(true);
                  }}
                  className="p-1 text-blue-400 hover:text-blue-200 transition-colors ml-2"
                  title="Change Token"
                >
                  <Key size={16} />
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
    <div className="overflow-x-auto overflow-y-auto h-full">
      <table className="w-full text-left text-sm font-mono">
        <thead className="bg-white/5 text-gray-400 uppercase text-xs sticky top-0 backdrop-blur-md z-10">
          <tr>
            <th className="p-4">Time</th>
            <th className="p-4">Action</th>
            <th className="p-4">Folder</th>
            <th className="p-4">File ID</th>
            <th className="p-4">Token</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {data?.logs.map(l => {
            // Try to find folder info if possible, though logs might not have it directly
            // This is a simplification
            const file = data?.files.find(f => f.file_id === l.file_id);
            return (
              <tr key={l.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 text-gray-500">{new Date(l.timestamp).toLocaleTimeString()}</td>
                <td className={`p-4 font-bold uppercase ${l.action === 'upload' ? 'text-blue-400' : 'text-green-400'}`}>
                  {l.action}
                </td>
                <td className="p-4 text-xs text-gray-400">{file?.folder_id || '-'}</td>
                <td className="p-4 text-xs text-gray-600">{l.file_id}</td>
                <td className="p-4 text-xs">{l.token_name === 'MASTER' ? <span className="text-yellow-500">ADMIN</span> : l.token_name}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="w-full max-w-6xl h-[85vh] flex flex-col md:flex-row gap-6">
      {/* Sidebar Nav */}
      <GlassCard className="w-full md:w-64 flex flex-col p-4 md:p-6">
        <h1 className="text-xl font-bold tracking-widest mb-8 text-center md:text-left">ADMIN<span className="font-light text-gray-400">PANEL</span></h1>

        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setActiveTab('tokens')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-all ${activeTab === 'tokens' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
          >
            <Key size={18} /> Tokens
          </button>
          <button
            onClick={() => setActiveTab('folders')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-all ${activeTab === 'folders' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
          >
            <Folder size={18} /> Folders
          </button>
          <button
            onClick={() => setActiveTab('uploads')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-all ${activeTab === 'uploads' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
          >
            <FileText size={18} /> Uploads
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-all ${activeTab === 'create' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
          >
            <Plus size={18} /> Create Token
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-all ${activeTab === 'logs' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
          >
            <Activity size={18} /> History
          </button>
        </nav>

        <button
          onClick={handleLogout}
          className="mt-auto flex items-center gap-3 p-3 rounded-lg text-sm text-red-400 hover:bg-red-900/20 transition-all"
        >
          <LogOut size={18} /> Logout
        </button>
      </GlassCard>

      {/* Main Content Area */}
      <GlassCard className="flex-1 flex flex-col p-0 overflow-hidden relative">
        {/* Header inside Panel */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 backdrop-blur-xl">
          <h2 className="text-lg uppercase tracking-widest font-light">{activeTab}</h2>
          <button onClick={() => fetchData(true)} className={`text-gray-400 hover:text-white transition-all ${loading ? 'animate-spin' : ''}`}>
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
          {loading && !data ? (
            <div className="w-full h-full flex items-center justify-center text-gray-500">Loading Data...</div>
          ) : (
            <>
              {activeTab === 'tokens' && <TokenTable />}
              {activeTab === 'folders' && <FoldersTable />}
              {activeTab === 'uploads' && <FilesTable />}
              {activeTab === 'logs' && <LogsTable />}
              {activeTab === 'create' && (
                <div className="p-8 max-w-md mx-auto space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl tracking-widest uppercase mb-1">Custom Token</h3>
                    <p className="text-xs text-gray-500 font-mono">MANUAL OVERRIDE PROTOCOL</p>
                  </div>

                  {createError && (
                    <div className="bg-red-900/20 border border-red-500/30 p-3 rounded flex items-center gap-2 text-xs text-red-200">
                      <AlertCircle size={14} /> {createError}
                    </div>
                  )}

                  <NeoInput
                    label="Token Code"
                    placeholder="e.g. ALPHA-99 (Manual Entry)"
                    value={customTokenCode}
                    onChange={e => setCustomTokenCode(e.target.value)}
                  />

                  <NeoInput
                    label="Identity Name"
                    placeholder="Recipient Name"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                  />

                  <NeoInput
                    label="Purpose"
                    placeholder="Description (Optional)"
                    value={customPurpose}
                    onChange={e => setCustomPurpose(e.target.value)}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <NeoInput
                      type="number"
                      label="Duration (Minutes)"
                      value={customExpiry}
                      onChange={e => setCustomExpiry(e.target.value)}
                      min={1}
                    />
                    <NeoInput
                      type="number"
                      label="Max Uses"
                      value={customMaxUses}
                      onChange={e => setCustomMaxUses(e.target.value)}
                      min={1}
                    />
                  </div>

                  {/* Folder Selection for Token */}
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400 uppercase tracking-widest">Restrict to Folders (Optional)</label>
                    <div className="max-h-32 overflow-y-auto bg-black/20 rounded p-2 border border-white/5 space-y-1">
                      {data?.folders.map(f => (
                        <div
                          key={f.id}
                          onClick={() => toggleFolderSelection(f.id)}
                          className={`p-2 rounded text-xs cursor-pointer flex justify-between items-center transition-colors ${selectedFolderIds.includes(f.id) ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30' : 'hover:bg-white/5 text-gray-400'}`}
                        >
                          <span>{f.name} <span className="opacity-50 text-[10px]">({f.id})</span></span>
                          {selectedFolderIds.includes(f.id) && <div className="w-2 h-2 rounded-full bg-blue-400"></div>}
                        </div>
                      ))}
                      {(!data?.folders || data.folders.length === 0) && (
                        <div className="text-center text-gray-600 italic text-xs py-2">No folders available</div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4">
                    <NeoButton
                      className="w-full"
                      onClick={handleCreateToken}
                      isLoading={creatingToken}
                      disabled={!customTokenCode || !customName}
                    >
                      Generate Custom Token
                    </NeoButton>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </GlassCard>

      {/* Change Token Modal */}
      {showChangeTokenModal && fileToChangeToken && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <GlassCard className="p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Change Token</h3>
            {changeTokenError && (
              <div className="bg-red-900/20 border border-red-500/30 p-3 rounded flex items-center gap-2 text-xs text-red-200 mb-4">
                <AlertCircle size={14} /> {changeTokenError}
              </div>
            )}
            <NeoInput
              label="New Token"
              placeholder="Enter new token string"
              value={newTokenInput}
              onChange={(e) => setNewTokenInput(e.target.value)}
            />
            <div className="flex justify-end gap-4 mt-6">
              <NeoButton onClick={() => setShowChangeTokenModal(false)} variant="secondary">
                Cancel
              </NeoButton>
              <NeoButton
                onClick={handleChangeTokenSubmit}
                isLoading={changingToken}
                disabled={!newTokenInput}
              >
                Update Token
              </NeoButton>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Assign Token Modal */}
      {showAssignTokenModal && folderToAssign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <GlassCard className="p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-1">Manage Access</h3>
            <p className="text-xs text-gray-400 mb-4">Assign a token to folder: <span className="text-white">{folderToAssign.name}</span></p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest block mb-2">Select Token to Authorize</label>
                <div className="max-h-48 overflow-y-auto bg-black/20 rounded border border-white/5">
                  {data?.tokens.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTokenId(t.id)}
                      className={`p-3 border-b border-white/5 cursor-pointer flex items-center justify-between hover:bg-white/5 transition-colors ${selectedTokenId === t.id ? 'bg-blue-500/10' : ''}`}
                    >
                      <div>
                        <div className="text-sm font-bold">{t.display_token}</div>
                        <div className="text-[10px] text-gray-500">{t.name} • {t.temp_purpose}</div>
                      </div>
                      {selectedTokenId === t.id && <div className="w-2 h-2 rounded-full bg-blue-400"></div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <NeoButton onClick={() => setShowAssignTokenModal(false)} variant="secondary" size="sm">Cancel</NeoButton>
                <NeoButton onClick={handleAssignToken} isLoading={assigningToken} disabled={!selectedTokenId} size="sm">Grant Access</NeoButton>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;