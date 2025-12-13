import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, NeoButton } from '../components/GlassUI';
import { adminLogin } from '../services/mockApi';
import { ShieldCheck, Delete } from 'lucide-react';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNumClick = (num: string) => {
    if (pin.length < 7) setPin(prev => prev + num);
    setError('');
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      await adminLogin(pin);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError('Access Denied');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <GlassCard className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
           <ShieldCheck size={32} className="text-white" />
        </div>
        
        <h2 className="text-lg tracking-[0.2em] font-light mb-8">SYSTEM ACCESS</h2>

        <div className="flex gap-3 mb-8 justify-center">
           {[...Array(7)].map((_, i) => (
             <div 
               key={i} 
               className={`w-3 h-3 rounded-full transition-all duration-300 ${i < pin.length ? 'bg-white shadow-[0_0_10px_white]' : 'bg-gray-800'}`}
             />
           ))}
        </div>
        
        {error && <p className="text-red-500 text-xs mb-4 tracking-widest">{error}</p>}

        <div className="grid grid-cols-3 gap-4 w-full max-w-[240px] mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumClick(num.toString())}
              className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/20 hover:scale-105 transition-all flex items-center justify-center text-xl font-mono text-white"
            >
              {num}
            </button>
          ))}
          <div /> {/* Spacer */}
          <button
              onClick={() => handleNumClick('0')}
              className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/20 hover:scale-105 transition-all flex items-center justify-center text-xl font-mono text-white"
            >
              0
          </button>
          <button
              onClick={handleDelete}
              className="w-16 h-16 rounded-full bg-transparent hover:bg-red-900/20 text-red-400 hover:text-red-200 transition-all flex items-center justify-center"
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
        
        <button 
          onClick={() => navigate('/')} 
          className="mt-6 text-xs text-gray-600 hover:text-white transition-colors mx-auto text-center block"
        >
          Return Home
        </button>
      </GlassCard>
    </div>
  );
};

export default AdminLogin;