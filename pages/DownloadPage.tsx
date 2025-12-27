import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, NeoButton, NeoInput } from '../components/GlassUI';
import { downloadFile, downloadFolderAsZip } from '../services/mockApi';
import { Download, ArrowLeft, Lock, FileSearch, Folder, FileArchive } from 'lucide-react';

type DownloadMode = 'file' | 'folder';

const DownloadPage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<DownloadMode>('file');
  const [fileId, setFileId] = useState('');
  const [folderId, setFolderId] = useState('');
  const [token, setToken] = useState('');
  const [zipPassword, setZipPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDownload = async () => {
    if (!token) return;
    if (mode === 'file' && !fileId) return;
    if (mode === 'folder' && !folderId) return;

    setLoading(true);
    setError('');

    try {
      if (mode === 'file') {
        const { url } = await downloadFile(fileId, token, '127.0.0.1');
        window.open(url, '_blank');
      } else {
        const blobUrl = await downloadFolderAsZip(folderId, token);
        const link = document.createElement('a');
        link.href = blobUrl;
        // Add timestamp + random suffix to prevent "File already exists" error
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        link.download = `archive-${folderId}-${timestamp}-${random}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Revoke blob URL after a short delay to ensure download starts
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <GlassCard>
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-light tracking-widest uppercase">Retrieve Data</h2>
          <Lock size={20} className="text-gray-400" />
        </div>

        {/* Tabs */}
        <div className="flex mb-6 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setMode('file')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm transition-all ${mode === 'file' ? 'bg-white text-black shadow-lg font-bold' : 'text-gray-400 hover:text-white'}`}
          >
            <FileSearch size={16} /> Single File
          </button>
          <button
            onClick={() => setMode('folder')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm transition-all ${mode === 'folder' ? 'bg-white text-black shadow-lg font-bold' : 'text-gray-400 hover:text-white'}`}
          >
            <Folder size={16} /> Folder Archive
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            {mode === 'file' ? (
              <div className="relative animate-in fade-in slide-in-from-right-4 duration-300">
                <FileSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <NeoInput
                  placeholder="FILE ID"
                  value={fileId}
                  onChange={(e) => setFileId(e.target.value)}
                  className="pl-12"
                />
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="relative">
                  <Folder className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <NeoInput
                    placeholder="FOLDER ID"
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    className="pl-12"
                  />
                </div>
                <div className="relative">
                  <FileArchive className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <NeoInput
                    placeholder="ZIP PASSWORD (Optional)"
                    value={zipPassword}
                    onChange={(e) => setZipPassword(e.target.value)}
                    className="pl-12"
                    type="password"
                  />
                </div>
              </div>
            )}

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <NeoInput
                type="password"
                placeholder="SECURITY TOKEN"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="pl-12"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-xs text-center border-l-2 border-red-500 pl-3 py-1 bg-red-900/10 mb-4 rounded-r">
              {error}
            </div>
          )}

          <NeoButton
            className="w-full"
            onClick={handleDownload}
            isLoading={loading}
            disabled={(!fileId && mode === 'file') || (!folderId && mode === 'folder') || !token}
          >
            {loading ? 'Processing...' : (mode === 'file' ? 'Download File' : 'Download Zip Archive')}
          </NeoButton>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-gray-600 font-mono">
            SECURE LINK GENERATED UPON VALIDATION.
            <br />
            LINKS EXPIRE IN 30 SECONDS.
          </p>
        </div>
      </GlassCard>
    </div>
  );
};

export default DownloadPage;