import React, { useState, useEffect } from 'react';
import { FolderRecord, TokenRecord, ShareLinkRecord } from '../../../types';
import { NeoButton, NeoInput, GlassCard } from '../../../components/GlassUI';
import { toggleFolderPause, createShareLink, getShareLinksForFolder, deleteShareLink } from '../../../services/mockApi';
import { Share2, PauseCircle, PlayCircle, Copy, Check, Lock, UploadCloud, Download, Trash2, Link as LinkIcon, ChevronDown, ChevronUp } from 'lucide-react';

interface ShareManagerProps {
    folders: FolderRecord[];
    tokens: TokenRecord[];
    refreshData: () => void;
}

export const ShareManager: React.FC<ShareManagerProps> = ({ folders, tokens, refreshData }) => {
    const [loadingFolderId, setLoadingFolderId] = useState<string | null>(null);
    const [generatedLink, setGeneratedLink] = useState<{ url: string, type: 'upload' | 'download' } | null>(null);
    const [generatingLinkFor, setGeneratingLinkFor] = useState<string | null>(null);

    // State for creating new link
    const [selectedTokenId, setSelectedTokenId] = useState<string>('');

    // State for viewing existing links
    const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
    const [folderLinks, setFolderLinks] = useState<ShareLinkRecord[]>([]);
    const [loadingLinks, setLoadingLinks] = useState(false);

    useEffect(() => {
        if (expandedFolderId) {
            fetchLinks(expandedFolderId);
        }
    }, [expandedFolderId]);

    const fetchLinks = async (folderId: string) => {
        setLoadingLinks(true);
        try {
            const links = await getShareLinksForFolder(folderId);
            setFolderLinks(links);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingLinks(false);
        }
    };

    const handleTogglePause = async (folderId: string, type: 'upload' | 'download', currentStatus: boolean) => {
        setLoadingFolderId(folderId);
        try {
            await toggleFolderPause(folderId, type, !currentStatus);
            refreshData();
        } catch (err: any) {
            alert("Failed to toggle pause: " + err.message);
        } finally {
            setLoadingFolderId(null);
        }
    };

    const handleGenerateLink = async (folder: FolderRecord, type: 'upload' | 'download') => {
        if (!selectedTokenId) {
            alert("Please select a token to secure this link.");
            return;
        }

        setGeneratingLinkFor(folder.id + type);
        try {
            const link = await createShareLink(folder.id, selectedTokenId, type);

            // Construct Link
            const baseUrl = window.location.origin;
            const path = type === 'upload' ? 'upload' : 'download';
            // Secure Link Format (HashRouter): /#/upload?shareId=XYZ
            const url = `${baseUrl}/#/${path}?shareId=${link.id}`;

            setGeneratedLink({ url, type });

            // Refresh list if open
            if (expandedFolderId === folder.id) {
                fetchLinks(folder.id);
            }

        } catch (err: any) {
            alert("Failed to generate link: " + err.message);
        } finally {
            setGeneratingLinkFor(null);
        }
    };

    const handleDeleteLink = async (shareId: string) => {
        if (!confirm("Are you sure you want to revoke this link? Users with this URL will no longer be able to access the folder.")) return;
        try {
            await deleteShareLink(shareId);
            if (expandedFolderId) fetchLinks(expandedFolderId);
        } catch (err: any) {
            alert("Failed to delete link: " + err.message);
        }
    };

    return (
        <div className="flex flex-col h-full space-y-6 overflow-y-auto custom-scrollbar p-1">
            <GlassCard className="p-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                    <Share2 className="text-blue-400" />
                    Secure Link Manager
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                    Create secure, unique links for clients. These links use a unique ID (`shareId`) so your internal Token and Folder IDs are never exposed in the URL.
                    You can revoke any link at any time.
                </p>

                {/* Token Selector (Global for this view, or per row? Global is easier UI) */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8">
                    <label className="text-xs text-blue-300 font-bold uppercase tracking-wider mb-2 block">
                        1. Select Authorized Token
                    </label>
                    <div className="flex gap-4">
                        <select
                            value={selectedTokenId}
                            onChange={(e) => setSelectedTokenId(e.target.value)}
                            className="flex-1 bg-black/50 border border-white/20 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                        >
                            <option value="">-- Choose Token --</option>
                            {tokens.filter(t => new Date(t.expires_at) > new Date()).map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.name} ({t.display_token}) - {t.uses}/{t.max_uses} Uses
                                </option>
                            ))}
                        </select>
                        <div className="text-xs text-gray-500 w-1/3 flex items-center">
                            Select the token that will be used for authentication when the link is opened.
                        </div>
                    </div>
                </div>

                {generatedLink && (
                    <div className="mb-8 p-4 bg-green-500/10 border border-green-500/30 rounded-xl animate-in fade-in slide-in-from-top-4">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-green-400 font-bold flex items-center gap-2">
                                <Check size={18} />
                                Link Generated Successfully!
                            </h3>
                            <button onClick={() => setGeneratedLink(null)} className="text-gray-500 hover:text-white"><Share2 size={16} /></button>
                        </div>
                        <div className="flex gap-2">
                            <input
                                readOnly
                                value={generatedLink.url}
                                className="flex-1 bg-black/30 border border-green-500/20 rounded px-3 py-2 text-sm text-white font-mono"
                                onClick={(e) => e.currentTarget.select()}
                            />
                            <NeoButton onClick={() => navigator.clipboard.writeText(generatedLink.url)}>
                                <Copy size={16} /> Copy
                            </NeoButton>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                    {folders.map(folder => (
                        <div key={folder.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-colors">

                            <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                                {/* Folder Info */}
                                <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                                    <div className={`p-3 rounded-lg ${folder.is_auto_generated ? 'bg-purple-500/20 text-purple-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                        <Lock size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-lg">{folder.name}</h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                            ID: {folder.id}
                                            <button
                                                onClick={() => setExpandedFolderId(expandedFolderId === folder.id ? null : folder.id)}
                                                className="ml-2 text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                            >
                                                {expandedFolderId === folder.id ? 'Hide Links' : 'View Active Links'}
                                                {expandedFolderId === folder.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">

                                    {/* Upload Controls */}
                                    <div className="flex flex-col items-center gap-2 p-2 rounded bg-black/20 w-full sm:w-auto border border-white/5">
                                        <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider font-bold">
                                            <UploadCloud size={12} /> Uploads
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleTogglePause(folder.id, 'upload', !!folder.is_paused_upload)}
                                                disabled={loadingFolderId === folder.id}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${folder.is_paused_upload
                                                    ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'
                                                    : 'bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30'
                                                    }`}
                                            >
                                                {folder.is_paused_upload ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                                                {folder.is_paused_upload ? 'PAUSED' : 'ACTIVE'}
                                            </button>
                                            <button
                                                onClick={() => handleGenerateLink(folder, 'upload')}
                                                disabled={generatingLinkFor === folder.id + 'upload'}
                                                className="p-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded-md border border-blue-600/30"
                                                title="Create Secure Upload Link"
                                            >
                                                <Share2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Download Controls */}
                                    <div className="flex flex-col items-center gap-2 p-2 rounded bg-black/20 w-full sm:w-auto border border-white/5">
                                        <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider font-bold">
                                            <Download size={12} /> Downloads
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleTogglePause(folder.id, 'download', !!folder.is_paused_download)}
                                                disabled={loadingFolderId === folder.id}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${folder.is_paused_download
                                                    ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'
                                                    : 'bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30'
                                                    }`}
                                            >
                                                {folder.is_paused_download ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                                                {folder.is_paused_download ? 'PAUSED' : 'ACTIVE'}
                                            </button>
                                            <button
                                                onClick={() => handleGenerateLink(folder, 'download')}
                                                disabled={generatingLinkFor === folder.id + 'download'}
                                                className="p-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded-md border border-blue-600/30"
                                                title="Create Secure Download Link"
                                            >
                                                <Share2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* Expandable Link List */}
                            {expandedFolderId === folder.id && (
                                <div className="border-t border-white/10 bg-black/20 p-4 animate-in slide-in-from-top-2">
                                    <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Active Links</h4>
                                    {loadingLinks ? (
                                        <div className="text-center text-gray-500 text-xs py-2">Loading links...</div>
                                    ) : folderLinks.length === 0 ? (
                                        <div className="text-center text-gray-600 text-xs py-2 italic">No active share links found for this folder.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {folderLinks.map(link => (
                                                <div key={link.id} className="flex items-center justify-between bg-white/5 p-2 rounded border border-white/5 hover:border-white/10">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-1.5 rounded ${link.type === 'upload' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                                            {link.type === 'upload' ? <UploadCloud size={14} /> : <Download size={14} />}
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-white font-mono flex items-center gap-2">
                                                                <span className="text-gray-500">ID:</span> {link.id.substring(0, 8)}...
                                                                <span className="text-gray-600">|</span>
                                                                <span className="text-gray-500">Token:</span> {link.token_display || '???'}
                                                            </div>
                                                            <div className="text-[10px] text-gray-500">
                                                                Created: {new Date(link.created_at).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <button
                                                            onClick={() => {
                                                                const url = `${window.location.origin}/#/${link.type === 'upload' ? 'upload' : 'download'}?shareId=${link.id}`;
                                                                navigator.clipboard.writeText(url);
                                                                alert("Link copied to clipboard!");
                                                            }}
                                                            className="text-blue-400/50 hover:text-blue-400 hover:bg-blue-900/20 p-1.5 rounded transition-all mr-1"
                                                            title="Copy Link"
                                                        >
                                                            <Copy size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteLink(link.id)}
                                                            className="text-red-400/50 hover:text-red-400 hover:bg-red-900/20 p-1.5 rounded transition-all"
                                                            title="Revoke Link"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    ))}

                    {folders.length === 0 && (
                        <div className="text-center p-12 text-gray-500">
                            No folders found. Create one in the "R2 Management" tab first.
                        </div>
                    )}
                </div>
            </GlassCard>
        </div>
    );
};
