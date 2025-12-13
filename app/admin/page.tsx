'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from '../../lib/use-router';
import { GlassCard, NeoButton } from '../../components/GlassUI';
import { adminLogin } from '../../services/mockApi';
import { ShieldCheck, Delete } from 'lucide-react';

export default function AdminLogin() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);

  useEffect(() => {
    // If auth was successful, navigate after a brief moment
    if (authSuccess) {
      console.log('✅ Auth successful, navigating...');
      const timer = setTimeout(() => {
        router.push('/admin/dashboard');
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [authSuccess, router]);

  const handleNumClick = (num: string) => {
    if (pin.length < 7) setPin(prev => prev + num);
    setError('');
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleLogin = async () => {
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      console.log('🔐 Attempting login...');
      await adminLogin(pin);

      console.log('✅ Login successful!');

      // Try to set sessionStorage, but don't fail if it doesn't work
      try {
        sessionStorage.setItem('adminToken', pin);
        console.log('✅ SessionStorage set');
      } catch (storageErr) {
        console.warn('⚠️ SessionStorage blocked, using state only');
      }

      // Set success state which will trigger navigation
      setAuthSuccess(true);

    } catch (err: any) {
      console.error('❌ Login failed:', err);
      setError('Access Denied');
      setPin('');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <GlassCard className="flex flex-col items-center text-center">
        <div className="w-full mb-6">
          <div className="text-xs uppercase tracking-[0.35em] text-white/60">GORZ STORAGE</div>
          <div className="text-[10px] font-mono text-white/30 mt-1">SYSADMIN CONSOLE</div>
        </div>

        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
          <ShieldCheck size={32} className="text-white" />
        </div>

        <h2 className="text-lg tracking-[0.3em] font-light mb-4">SYSTEM ACCESS</h2>
        <p className="text-[10px] font-mono text-white/40 mb-6 tracking-widest">ENTER 7-DIGIT ADMIN PIN</p>

        <div className="flex gap-3 mb-6 justify-center">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${i < pin.length ? 'bg-white shadow-[0_0_10px_white]' : 'bg-gray-800'}`}
            />
          ))}
        </div>

        {error && (
          <div className="w-full max-w-xs bg-red-900/20 border border-red-500/30 text-red-300 text-xs font-mono px-3 py-2 rounded mb-4 tracking-widest">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 w-full max-w-[240px] mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumClick(num.toString())}
              className="w-16 h-16 rounded-xl bg-white/5 hover:bg-white/20 hover:scale-105 transition-all flex items-center justify-center text-xl font-mono text-white"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleNumClick('0')}
            className="w-16 h-16 rounded-xl bg-white/5 hover:bg-white/20 hover:scale-105 transition-all flex items-center justify-center text-xl font-mono text-white"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="w-16 h-16 rounded-xl bg-transparent hover:bg-red-900/20 text-red-400 hover:text-red-200 transition-all flex items-center justify-center"
          >
            <Delete size={20} />
          </button>
        </div>

        <NeoButton
          className="w-full"
          onClick={handleLogin}
          disabled={pin.length !== 7 || loading}
          isLoading={loading}
        >
          Authenticate
        </NeoButton>

        <div className="w-full mt-6 flex items-center justify-between text-[10px] font-mono text-white/30">
          <span>OS: GORZ-SYS v1.0</span>
          <button
            onClick={() => router.push('/')}
            className="text-white/40 hover:text-white transition-colors"
          >
            EXIT
          </button>
        </div>
      </GlassCard>
    </div>
  );
}