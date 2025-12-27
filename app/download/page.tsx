
import React, { useState, useEffect } from 'react';
import { useRouter } from '../../lib/use-router';
import { useLocation } from 'react-router-dom';
import { GlassCard, NeoButton, NeoInput } from '../../components/GlassUI';
import { downloadFile, downloadFolderAsZip, resolveShareLink } from '../../services/mockApi';
import { Download, ArrowLeft, Lock, FileSearch, Folder, FileArchive } from 'lucide-react';

type DownloadMode = 'file' | 'folder';

export default function DownloadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<DownloadMode>('file');
  const [fileId, setFileId] = useState('');
  const [folderId, setFolderId] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const queryId = queryParams.get('id');
  const queryCollectionId = queryParams.get('collectionId'); // Support legacy link if any
  const queryFolderId = queryParams.get('folderId'); // New param
  const queryToken = queryParams.get('token');

  useEffect(() => {
    if (queryFolderId) {
      setMode('folder');
      setFolderId(queryFolderId);
    } else if (queryCollectionId) {
      // Fallback for legacy collection links -> treat as folder
      setMode('folder');
      setFolderId(queryCollectionId);
    } else if (queryId) {
      setMode('file');
      setFileId(queryId);
    }

    // Auto-fill token
    if (queryToken) {
      setToken(queryToken);
    }

    // Resolve Secure Share Link
    const qShareId = queryParams.get('shareId');
    if (qShareId) {
      resolveShareLink(qShareId).then(res => {
        setToken(res.token);
        setFolderId(res.folderId);
        if (res.type === 'download') {
          setMode('folder'); // Share links are always folder-based for now? Or depends.
          // Actually share link type 'download' implies folder download usually in this context
          // But resolving function returns 'upload' or 'download'.
          // If it is 'download', it is likely for the folder.
        }
      }).catch(err => {
        setError("Invalid Link: " + err.message);
      });
    }
  }, [queryId, queryCollectionId, queryFolderId, queryToken]);

  const handleDownload = async () => {
    if (!token) return;
    if (mode === 'file' && !fileId) return;
    if (mode === 'folder' && !folderId) return;

    setLoading(true);
    setError('');
    setProgress({ current: 0, total: 0, status: '' });

    try {
      if (mode === 'file') {
        const { url } = await downloadFile(fileId, token, '127.0.0.1');
        window.open(url, '_blank');
      } else {
        const downloadUrl = await downloadFolderAsZip(folderId, token, (current, total, status) => {
          setProgress({ current, total, status });
        });

        // Check if it's a blob URL or R2 URL
        const isBlobUrl = downloadUrl.startsWith('blob:');

        if (isBlobUrl) {
          // For blob URLs (smaller files), use the traditional download method
          const link = document.createElement('a');
          link.href = downloadUrl;
          const timestamp = Date.now();
          const random = Math.floor(Math.random() * 1000);
          link.download = `archive-${folderId}-${timestamp}-${random}.zip`;
          link.style.display = 'none';

          document.body.appendChild(link);
          link.click();

          // Cleanup after delay
          setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
          }, 5000);
        } else {
          // For R2 URLs (large files), use link download to avoid popup blockers
          // The R2 URL already has the correct Content-Disposition header
          console.log('📥 Large file detected, downloading from R2:', downloadUrl.substring(0, 100) + '...');

          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `archive-${folderId}.zip`; // R2 URL has Content-Disposition, but set download anyway
          link.style.display = 'none';
          link.target = '_blank';

          document.body.appendChild(link);
          link.click();

          // Cleanup after delay
          setTimeout(() => {
            document.body.removeChild(link);
          }, 1000);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 0, status: '' });
    }
  };

  return (
    <div className="w-full max-w-md">
      <GlassCard>
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white transition-colors">
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

          {/* Progress Bar */}
          {loading && mode === 'folder' && progress.total > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>{progress.status}</span>
                <span>{Math.round((progress.current / progress.total) * 100)}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <div className="text-[10px] text-gray-500 text-center font-mono">
                Batch {progress.current} of {progress.total}
              </div>
            </div>
          )}

          <NeoButton
            className="w-full"
            onClick={handleDownload}
            isLoading={loading}
            disabled={(!fileId && mode === 'file') || (!folderId && mode === 'folder') || !token}
          >
            {loading ? (progress.total > 0 ? `Processing Batch ${progress.current}/${progress.total}...` : 'Processing...') : (mode === 'file' ? 'Download File' : 'Download Zip Archive')}
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
}
