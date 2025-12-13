import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, NeoButton, NeoInput } from '../components/GlassUI';
import { generateToken } from '../services/mockApi';
import { Key, UploadCloud, DownloadCloud, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

const TokenPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // Mock IP fetch
      const token = await generateToken(name, purpose, '127.0.0.1');
      setGeneratedToken(token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
    }
  };

  return (
    <div className="w-full max-w-md">
      <GlassCard>
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-light tracking-tighter mb-2 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
            AETHER<span className="font-bold">VAULT</span>
          </h1>
          <p className="text-sm text-gray-400 font-mono tracking-wide">SECURE TEMPORARY STORAGE</p>
        </div>

        {!generatedToken ? (
          <div className="space-y-6">
            <NeoInput 
              label="Identity Name" 
              placeholder="Enter your alias" 
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <NeoInput 
              label="Purpose (Optional)" 
              placeholder="e.g. Project Alpha Assets" 
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
            
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/10 p-3 rounded border border-red-500/20">
                <ShieldAlert size={14} />
                {error}
              </div>
            )}

            <NeoButton 
              className="w-full" 
              onClick={handleGenerate} 
              isLoading={loading}
              disabled={!name}
            >
              Initialize Token
            </NeoButton>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="bg-white/5 border border-white/20 p-6 rounded-xl backdrop-blur-md relative overflow-hidden group">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Access Token</p>
              <h2 className="text-4xl font-mono tracking-[0.2em] text-white font-bold group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-400 transition-all">
                {generatedToken}
              </h2>
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={copyToClipboard}>
                <span className="text-xs uppercase tracking-widest font-bold">Click to Copy</span>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              This token expires in 10 minutes. It can only be used once for a single session upload.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <NeoButton variant="ghost" onClick={() => navigate('/upload')}>
                <UploadCloud size={16} /> Upload
              </NeoButton>
              <NeoButton variant="ghost" onClick={() => navigate('/download')}>
                <DownloadCloud size={16} /> Download
              </NeoButton>
            </div>
          </motion.div>
        )}

        <div className="mt-8 pt-6 border-t border-white/5 flex justify-between text-xs text-gray-500 font-mono">
           <button onClick={() => navigate('/upload')} className="hover:text-white transition-colors">Direct Upload</button>
           <button onClick={() => navigate('/download')} className="hover:text-white transition-colors">Retrieve</button>
           <button onClick={() => navigate('/admin')} className="hover:text-white transition-colors">SysAdmin</button>
        </div>
      </GlassCard>
    </div>
  );
};

export default TokenPage;