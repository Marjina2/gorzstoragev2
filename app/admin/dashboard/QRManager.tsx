import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { FolderRecord, ShareLinkRecord, TokenRecord } from '../../../types';
import { NeoButton, GlassCard } from '../../../components/GlassUI';
import { getShareLinksForFolder } from '../../../services/mockApi';
import { Download, UploadCloud, Printer, QrCode, Search, Copy } from 'lucide-react';

interface QRManagerProps {
    folders: FolderRecord[];
    tokens: TokenRecord[]; // To resolve token names if needed
}

export const QRManager: React.FC<QRManagerProps> = ({ folders, tokens }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [allLinks, setAllLinks] = useState<(ShareLinkRecord & { folderName: string })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllLinks = async () => {
            setLoading(true);
            const linksAcc: (ShareLinkRecord & { folderName: string })[] = [];

            for (const folder of folders) {
                try {
                    const links = await getShareLinksForFolder(folder.id);
                    links.forEach(l => {
                        linksAcc.push({ ...l, folderName: folder.name });
                    });
                } catch (e) {
                    console.error(`Failed to fetch links for ${folder.name}`, e);
                }
            }
            // Sort by newest
            linksAcc.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setAllLinks(linksAcc);
            setLoading(false);
        };

        if (folders.length > 0) {
            fetchAllLinks();
        } else {
            setLoading(false);
        }
    }, [folders]);

    const filteredLinks = allLinks.filter(link =>
        link.folderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        link.id.includes(searchTerm) ||
        link.token_display?.includes(searchTerm)
    );

    const downloadQR = (linkId: string) => {
        const canvas = document.getElementById(`qr-${linkId}`) as HTMLCanvasElement;
        if (canvas) {
            const pngUrl = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = `qr-${linkId}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    };

    return (
        <div className="flex flex-col h-full space-y-6 overflow-y-auto custom-scrollbar p-1">
            <GlassCard className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <QrCode className="text-purple-400" />
                            QR Codes
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">
                            Scan these codes to instantly access folders. Ideal for physical distribution or quick mobile access.
                        </p>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search folder, ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:border-purple-500 outline-none w-full md:w-64"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-gray-500 animate-pulse">Scanning for active links...</div>
                ) : filteredLinks.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 border-2 border-dashed border-white/5 rounded-xl">
                        <QrCode size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No active share links found.</p>
                        <p className="text-xs mt-2">Go to the "Share Links" tab to create one.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredLinks.map(link => {
                            const url = `${window.location.origin}/#/${link.type === 'upload' ? 'upload' : 'download'}?shareId=${link.id}`;

                            return (
                                <div key={link.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center hover:bg-white/10 transition-colors group">
                                    <div className="bg-white p-3 rounded-lg mb-4 shadow-lg shadow-purple-500/10">
                                        <QRCodeCanvas
                                            id={`qr-${link.id}`}
                                            value={url}
                                            size={160}
                                            level={"H"}
                                            includeMargin={true}
                                        />
                                    </div>

                                    <div className="w-full text-center space-y-1 mb-4">
                                        <div className="text-white font-bold truncate px-2" title={link.folderName}>
                                            {link.folderName}
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-mono">
                                            ID: {link.folder_id}
                                        </div>
                                        <div className="text-xs text-gray-400 flex items-center justify-center gap-2">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${link.type === 'upload' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'}`}>
                                                {link.type}
                                            </span>
                                            <span className="font-mono">{link.token_display}</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 w-full">
                                        <button
                                            onClick={() => downloadQR(link.id)}
                                            className="flex-1 flex items-center justify-center gap-2 bg-black/40 hover:bg-black/60 text-white text-xs py-2 rounded-lg border border-white/10 transition-all"
                                        >
                                            <Download size={14} /> PNG
                                        </button>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(url)}
                                            className="flex-none w-10 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white text-xs py-2 rounded-lg border border-white/10 transition-all"
                                            title="Copy URL"
                                        >
                                            <Copy size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </GlassCard>
        </div>
    );
};
