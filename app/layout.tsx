
'use client';

import React from 'react';
import Background from '../components/Background';
import { FOOTER_TEXT } from '../constants';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative w-full h-[100dvh] overflow-hidden text-white selection:bg-white selection:text-black font-sans bg-black">
      <Background />
      
      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Main Content Area */}
        <div className="flex-1 flex items-center justify-center p-3 sm:p-4 md:p-8 overflow-y-auto md:overflow-hidden">
            {children}
        </div>

        {/* Footer */}
        <div className="absolute bottom-2 md:bottom-4 left-0 w-full text-center pointer-events-none hidden sm:block">
          <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-white drop-shadow-[0_0_20px_rgba(255,255,255,1)]">
            {FOOTER_TEXT}
          </p>
        </div>
      </div>
    </div>
  );
}
