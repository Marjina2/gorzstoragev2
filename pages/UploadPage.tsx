import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, NeoButton, NeoInput } from '../components/GlassUI';
import { uploadFile } from '../services/mockApi';
import { Upload, X, File as FileIcon, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { MAX_FILE_SIZE } from '../constants';

const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [folderId, setFolderId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > MAX_FILE_SIZE) {
        setStatus('error');
        setMessage('File exceeds 500MB limit.');
        return;
      }
      setFile(selectedFile);
      setStatus('idle');
      setMessage('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.size > MAX_FILE_SIZE) {
        setStatus('error');
        setMessage('File exceeds 500MB limit.');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !token) return;
    setLoading(true);
    setStatus('idle');
    try {
      // Get user's real IP address
      let userIp = '127.0.0.1';
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        userIp = ipData.ip;
      } catch (ipError) {
        console.warn('Could not fetch IP address, using fallback:', ipError);
      }

      // Get user agent (browser/device info)
      const userAgent = navigator.userAgent;

      await uploadFile(file, token, userIp, userAgent, null, null, null, folderId || null);
      setStatus('success');
      setMessage('Encryption & Upload Complete.');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setToken('');
    // setFolderId(''); // Optional: keep folder ID for next upload? Maybe better to keep it.
    setStatus('idle');
    setMessage('');
  };

  return (
    <div className="w-full max-w-2xl">
      <GlassCard className="min-h-[500px] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-light tracking-widest uppercase">Secure Uplink</h2>
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
            </div>
            <div className="flex gap-4">
              <NeoButton onClick={reset}>Upload Another</NeoButton>
              <NeoButton variant="ghost" onClick={() => navigate('/download')}>Go to Downloads</NeoButton>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-6">
            <div className="grid md:grid-cols-2 gap-8 h-full">
              {/* Left: Inputs */}
              <div className="flex flex-col justify-center space-y-6">
                <div>
                  <p className="text-sm text-gray-400 mb-2">Authorization</p>
                  <NeoInput
                    label="Session Token"
                    placeholder="XXXXXX"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    maxLength={10}
                    className="text-center text-xl tracking-[0.3em]"
                  />
                </div>

                <div>
                  <p className="text-sm text-gray-400 mb-2">Destination</p>
                  <NeoInput
                    label="Folder ID (Optional)"
                    placeholder="Enter Folder ID"
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    className="text-center"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Leave empty for root upload (if allowed)</p>
                </div>

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
                className={`relative flex-1 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-6 text-center group ${file ? 'border-white/40 bg-white/5' : 'border-white/10 hover:border-white/30 hover:bg-white/5'}`}
              >
                {!file ? (
                  <>
                    <div className="w-12 h-12 mb-4 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload size={24} className="text-white/60" />
                    </div>
                    <p className="text-sm font-semibold text-white/80">Drag file here</p>
                    <p className="text-xs text-gray-500 mt-2 font-mono">Max 500MB</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4 text-xs uppercase tracking-wider border-b border-white/30 pb-0.5 hover:text-white hover:border-white transition-colors"
                    >
                      Browse Files
                    </button>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center relative">
                    <FileIcon size={40} className="text-white mb-3" />
                    <p className="text-sm font-mono truncate w-full px-4">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button
                      onClick={() => setFile(null)}
                      className="absolute top-0 right-0 p-2 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            <NeoButton
              className="w-full mt-auto"
              onClick={handleUpload}
              disabled={!file || !token || loading}
              isLoading={loading}
            >
              {loading ? 'Encrypting & Uploading...' : 'Initiate Upload'}
            </NeoButton>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export default UploadPage;