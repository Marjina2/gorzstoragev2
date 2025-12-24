
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from '../../lib/use-router';
import { GlassCard, NeoButton, NeoInput } from '../../components/GlassUI';
import { uploadFile, checkTokenIsMaster, resolveShareLink } from '../../services/mockApi';
import { Upload, X, File as FileIcon, CheckCircle2, AlertTriangle, ArrowLeft, Copy } from 'lucide-react';
import JSZip from 'jszip';
// Removed MAX_FILE_SIZE import - file size validation now handled by backend based on token limits

import { useLocation } from 'react-router-dom';

export default function UploadPage() {
  const router = useRouter();
  const location = useLocation();
  const [token, setToken] = useState('');
  const [folderId, setFolderId] = useState('');

  // Parse Query Params for Magic Links
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const qToken = queryParams.get('token');
    const qFolderId = queryParams.get('folderId');
    const qShareId = queryParams.get('shareId');

    if (qShareId) {
      // Resolve secure share link
      resolveShareLink(qShareId)
        .then(res => {
          setToken(res.token);
          setFolderId(res.folderId);
        })
        .catch(err => {
          setStatus('error');
          setMessage("Invalid or Expired Link: " + err.message);
        });
    } else {
      // Fallback to manual params
      if (qToken) setToken(qToken);
      if (qFolderId) setFolderId(qFolderId);
    }
  }, [location.search]);

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [downloadLimit, setDownloadLimit] = useState<number | undefined>(undefined);
  const [expiryTimeInput, setExpiryTimeInput] = useState<string>('');
  const [isMasterToken, setIsMasterToken] = useState(false);
  const [zipFiles, setZipFiles] = useState(false);
  const [fileTitle, setFileTitle] = useState('');
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [uploadedCollectionId, setUploadedCollectionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload progress tracking
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0);

  useEffect(() => {
    checkTokenIsMaster(token).then(setIsMasterToken);
  }, [token]);

  const [clientIp, setClientIp] = useState('0.0.0.0');

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setClientIp(data.ip))
      .catch(() => setClientIp('0.0.0.0')); // Fallback
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
      setStatus('idle');
      setMessage('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const selectedFiles = Array.from(e.dataTransfer.files);
      setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
      setStatus('idle');
      setMessage('');
    }
  };

  // Simulate realistic upload progress
  const simulateProgress = (totalSize: number, onComplete: () => void) => {
    const startTime = Date.now();
    let uploaded = 0;

    // Simulate realistic upload speed (tuned to avoid 95% stall - assume 10 Mbps average)
    const simulatedSpeedBytesPerSec = (10 * 1024 * 1024) / 8; // 10 Mbps in bytes/sec
    const incrementBytes = simulatedSpeedBytesPerSec * 0.5; // Update every 500ms

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000; // seconds
      uploaded = Math.min(uploaded + incrementBytes, totalSize * 0.95); // Cap at 95% until actual upload completes

      const progress = (uploaded / totalSize) * 100;
      const speed = uploaded / elapsed; // bytes per second
      const remaining = totalSize - uploaded;
      const timeRemaining = remaining / speed; // seconds

      setUploadProgress(progress);
      setUploadedBytes(uploaded);
      setTotalBytes(totalSize);
      setUploadSpeed(speed);
      setEstimatedTimeRemaining(isFinite(timeRemaining) ? timeRemaining : 0);
    }, 500); // Update every 500ms for smoother animation

    return () => {
      clearInterval(interval);
      // Complete the progress
      setUploadProgress(100);
      setUploadedBytes(totalSize);
      onComplete();
    };
  };

  const initiateUpload = async () => {
    if (!token || files.length === 0) return;
    setLoading(true);
    setStatus('idle');

    // Reset progress
    setUploadProgress(0);
    setUploadedBytes(0);
    setUploadSpeed(0);
    setEstimatedTimeRemaining(0);

    try {
      let filesToUpload = files;
      if (zipFiles && files.length > 1) {
        const zip = new JSZip();
        files.forEach(file => {
          zip.file(file.name, file);
        });
        const zippedBlob = await zip.generateAsync({ type: "blob" });
        const zippedFile = new File([zippedBlob], "archive.zip", { type: "application/zip" });
        filesToUpload = [zippedFile];
      }

      let finalExpiryTime: string | undefined = undefined;
      if (expiryTimeInput) {
        const minutes = parseInt(expiryTimeInput);
        if (!isNaN(minutes) && minutes > 0) {
          const futureDate = new Date();
          futureDate.setMinutes(futureDate.getMinutes() + minutes);
          finalExpiryTime = futureDate.toISOString();
        }
      }

      let lastUploadedFileId: string | null = null;
      let currentCollectionId: string | null = null;

      if (!zipFiles && files.length > 1) {
        currentCollectionId = self.crypto.randomUUID();
      }

      // Calculate total size
      const totalSize = filesToUpload.reduce((sum, file) => sum + file.size, 0);
      setTotalBytes(totalSize);

      // Tracking for progress
      const progressMap = new Map<number, number>(); // Index -> Bytes Loaded

      const updateProgress = () => {
        let loaded = 0;
        progressMap.forEach((bytes) => loaded += bytes);

        setUploadedBytes(loaded);
        if (totalSize > 0) {
          setUploadProgress((loaded / totalSize) * 100);
        }

        // Simple speed estimation (total / time)
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > 0) setUploadSpeed(loaded / elapsed);
      };

      const startTime = Date.now();

      try {
        // PARALLEL UPLOAD (Optimize Speed)
        const BATCH_SIZE = 10;

        for (let i = 0; i < filesToUpload.length; i += BATCH_SIZE) {
          const batch = filesToUpload.slice(i, i + BATCH_SIZE);

          await Promise.all(batch.map(async (file, batchIndex) => {
            const globalIndex = i + batchIndex;

            const result = await uploadFile(
              file,
              token,
              clientIp,
              fileTitle,
              currentCollectionId,
              downloadLimit,
              finalExpiryTime,
              folderId || null,
              navigator.userAgent,
              (bytesLoaded) => {
                progressMap.set(globalIndex, bytesLoaded);
                updateProgress();
              }
            );
            // We just need one ID for reference
            lastUploadedFileId = result.file_id;

            // Ensure 100% for this file on completion
            progressMap.set(globalIndex, file.size);
            updateProgress();
          }));
        }

        console.log("Last uploaded file ID:", lastUploadedFileId);
        setStatus('success');
        setMessage('File uploaded successfully!');
        setUploadedFileId(lastUploadedFileId);
        if (currentCollectionId) {
          setUploadedCollectionId(currentCollectionId);
        } else {
          setUploadedFileId(lastUploadedFileId);
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message);
      } finally {
        setLoading(false);
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setToken('');
    setStatus('idle');
    setMessage('');
    setDownloadLimit(undefined);
    setExpiryTimeInput('');
    setIsMasterToken(false);
    setUploadedFileId(null);
  };

  return (
    <div className="w-full max-w-2xl">
      <GlassCard className="flex flex-col h-full md:h-auto md:min-h-[500px]">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg md:text-xl font-light tracking-widest uppercase">Secure Uplink</h2>
          <div className="w-5" /> {/* Spacer */}
        </div>

        {status === 'success' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(0,255,0,0.2)]">
              <CheckCircle2 size={40} className="text-green-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Transmission Successful</h3>
              <p className="text-gray-400 font-mono text-sm">File stored securely in R2 Vault.</p>
              {isMasterToken && (uploadedFileId || uploadedCollectionId) && (
                <p className="text-gray-400 font-mono text-sm flex items-center gap-2">
                  {uploadedCollectionId ? 'Collection ID' : 'File ID'}: <span className="text-white">{uploadedCollectionId || uploadedFileId}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(uploadedCollectionId || uploadedFileId || '')}
                    className="p-1 hover:text-green-400 transition-colors"
                    title="Copy ID"
                  >
                    <Copy size={16} />
                  </button>
                </p>
              )}
            </div>
            <div className="flex gap-4">
              <NeoButton onClick={reset}>Upload Another</NeoButton>
              <NeoButton variant="ghost" onClick={() => {
                if (uploadedCollectionId) {
                  router.push(`/download?collectionId=${uploadedCollectionId}`);
                } else if (uploadedFileId) {
                  router.push(`/download?id=${uploadedFileId}`);
                } else {
                  router.push('/download');
                }
              }}>Go to Downloads</NeoButton>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 h-full">
              {/* Left: Token Input */}
              <div className="flex flex-col justify-center space-y-4 order-2 md:order-1">
                <p className="text-sm text-gray-400 text-center md:text-left">Enter session token to authorize.</p>
                <NeoInput
                  label="Session Token"
                  placeholder="••••••••••"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  maxLength={10}
                  className="text-center text-xl tracking-[0.3em]"
                />
                <NeoInput
                  label="File Title (optional)"
                  placeholder="My Awesome File"
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  className="text-center"
                  disabled={files.length > 1}
                />
                {files.length > 1 && (
                  <p className="text-[10px] text-yellow-500 mt-1 text-center">Title disabled for multiple files</p>
                )}

                <div className="border-t border-white/10 pt-4 mt-2">
                  <NeoInput
                    label="Folder ID (Optional)"
                    placeholder="Enter Folder ID"
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    className="text-center"
                  />
                  <p className="text-[10px] text-gray-500 mt-1 text-center">Leave empty for root/default upload</p>
                </div>
                {isMasterToken && (
                  <>
                    <NeoInput
                      label="Download Limit (optional)"
                      placeholder="e.g., 5"
                      type="number"
                      value={downloadLimit === undefined ? '' : downloadLimit}
                      onChange={(e) => setDownloadLimit(e.target.value ? parseInt(e.target.value) : undefined)}
                      className="text-center"
                    />
                    <NeoInput
                      label="Expiry Time (minutes, optional)"
                      placeholder="e.g., 60"
                      type="number"
                      value={expiryTimeInput}
                      onChange={(e) => setExpiryTimeInput(e.target.value)}
                      className="text-center"
                    />
                    {files.length > 1 && (
                      <div className="flex items-center justify-center mt-4">
                        <input
                          type="checkbox"
                          id="zipFiles"
                          checked={zipFiles}
                          onChange={(e) => setZipFiles(e.target.checked)}
                          className="mr-2"
                        />
                        <label htmlFor="zipFiles" className="text-sm text-gray-400">Zip multiple files before upload</label>
                      </div>
                    )}
                  </>
                )}
                {status === 'error' && (
                  <div className="text-red-400 text-xs bg-red-900/10 p-3 rounded border border-red-500/20 flex items-center gap-2">
                    <AlertTriangle size={14} /> {message}
                  </div>
                )}
              </div>

              {/* Right: Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className={`order-1 md:order-2 relative min-h-[200px] md:min-h-0 flex-1 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-6 text-center group ${files.length ? 'border-white/40 bg-white/5' : 'border-white/10 hover:border-white/30 hover:bg-white/5'}`}>{!files.length ? (
                  <>
                    <div className="w-12 h-12 mb-4 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload size={24} className="text-white/60" />
                    </div>
                    <p className="text-sm font-semibold text-white/80">Drag files here</p>
                    <p className="text-xs text-gray-500 mt-2 font-mono">Max 500MB per file</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4 text-xs uppercase tracking-wider border-b border-white/30 pb-0.5 hover:text-white hover:border-white transition-colors"
                    >
                      Browse Files
                    </button>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col relative p-4 overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-white/80 text-sm font-bold uppercase tracking-wider">Selected Files ({files.length})</h3>
                      <button
                        onClick={() => setFiles([])}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar -mr-2 pr-2 max-h-[180px] md:max-h-[300px]">
                      <div className="grid grid-cols-1 gap-2 pb-2">
                        {files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white/5 hover:bg-white/10 p-2 rounded-md border border-white/5 transition-colors group">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="w-8 h-8 rounded bg-black/20 flex items-center justify-center flex-shrink-0 text-blue-400">
                                <FileIcon size={16} />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs text-gray-200 font-medium truncate w-full" title={file.name}>{file.name}</span>
                                <span className="text-[10px] text-gray-500 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                              </div>
                            </div>
                            <button
                              onClick={() => setFiles(files.filter((_, i) => i !== index))}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center text-xs text-gray-500 font-mono">
                      <span>Total Size: {(files.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)} MB</span>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-white hover:text-blue-400 transition-colors flex items-center gap-1"
                      >
                        <Upload size={12} /> Add More
                      </button>
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  multiple
                />
              </div>
            </div>

            {/* Upload Progress Indicator */}
            {loading && uploadProgress > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Upload Progress</span>
                  <span className="text-white font-bold">{uploadProgress.toFixed(1)}%</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-black/50 rounded-full h-3 overflow-hidden border border-white/20">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>

                {/* Upload Stats */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-gray-500 mb-1">Uploaded</div>
                    <div className="text-white font-mono">
                      {(uploadedBytes / 1024 / 1024).toFixed(2)} MB / {(totalBytes / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Speed</div>
                    <div className="text-white font-mono">
                      {(uploadSpeed / 1024 / 1024).toFixed(2)} MB/s
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Time Remaining</div>
                    <div className="text-white font-mono">
                      {estimatedTimeRemaining > 60
                        ? `${Math.floor(estimatedTimeRemaining / 60)}m ${Math.floor(estimatedTimeRemaining % 60)}s`
                        : `${Math.floor(estimatedTimeRemaining)}s`
                      }
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Status</div>
                    <div className="text-green-400 font-semibold">
                      {uploadProgress >= 100 ? 'Complete' : 'Uploading...'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <NeoButton
              onClick={initiateUpload}
              disabled={loading || files.length === 0 || !token}
              className="w-full"
            >
              {loading ? 'Uploading...' : 'Initiate Upload'}
            </NeoButton>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
