'use client';

import React, { useState } from 'react';
import { useRouter } from '../lib/use-router';
import { GlassCard, NeoButton, NeoInput } from '../components/GlassUI';
import { generateToken } from '../services/mockApi';
import { UploadCloud, DownloadCloud, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const router = useRouter();
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
            GORZ<span className="font-bold">STORAGE</span>
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
            <div className="bg-white/5 border border-white/20 p-6 rounded-xl backdrop-blur-md">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Token Initialized</p>
              <h2 className="text-xl font-light tracking-[0.3em] text-white">TOKEN SENT TO OWNER</h2>
              <p className="text-xs text-gray-400 mt-2">For security reasons, tokens are not shown publicly.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <NeoButton variant="ghost" onClick={() => router.push('/upload')}>
                <UploadCloud size={16} /> Upload
              </NeoButton>
              <NeoButton variant="ghost" onClick={() => router.push('/download')}>
                <DownloadCloud size={16} /> Download
              </NeoButton>
            </div>
          </motion.div>
        )}

        <div className="mt-8 pt-6 border-t border-white/5 flex justify-between text-xs text-gray-500 font-mono">
          <button onClick={() => router.push('/upload')} className="relative px-4 py-2 rounded-lg bg-white/10 text-white transition-all duration-300 hover:bg-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.5)]">Upload</button>
          <button onClick={() => router.push('/download')} className="relative px-4 py-2 rounded-lg bg-white/10 text-white transition-all duration-300 hover:bg-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.5)]">Download</button>
          <button onClick={() => router.push('/admin')} className="relative px-4 py-2 rounded-lg bg-white/10 text-white transition-all duration-300 hover:bg-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.5)]">Admin</button>
        </div>
      </GlassCard>
    </div>
  );
}
