import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, CopyObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BlobWriter, TextReader, ZipWriter, BlobReader } from '@zip.js/zip.js';
import { TokenRecord, FileRecord, ActivityLog, FolderRecord, ShareLinkRecord } from '../types';
import { FORBIDDEN_EXTENSIONS } from '../constants';
import { v4 as uuidv4 } from 'uuid';

// --- CONFIGURATION ---
const getEnv = () => {
  try {
    return (import.meta as any).env || {};
  } catch (e) {
    console.warn("Environment variables not accessible, falling back to mock.");
    return {};
  }
};

const env = getEnv();

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_KEY;
// Do NOT use service role key in client-side code - security risk!

const R2_ACCOUNT_ID = env.VITE_R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = env.VITE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = env.VITE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = env.VITE_R2_BUCKET_NAME;

// --- CLIENT INITIALIZATION ---

let supabase: any = null;
let r2Client: any = null;
let USE_MOCK = false;
const MASTER_TOKEN_HASH = "516d0d9866b17f3b57111b72840f0a526389b537ef1bed454dc28013ebcdc12f";

// --- UTILITIES ---
const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
const sha256Hex = async (str: string) => {
  const enc = new TextEncoder();
  const buf = enc.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return toHex(hash);
};

// Moved helper functions below initialization

// 1. Initialize Supabase (Metadata, Auth, Logs)
try {
  if (SUPABASE_URL && SUPABASE_URL.startsWith("http") && !SUPABASE_URL.includes("your_supabase")) {
    // Client configured for anonymous access with proper permissions
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          'apikey': SUPABASE_KEY
        }
      }
    });
    console.log("✅ Supabase initialized with anon key");
    console.log("💡 Make sure you ran the GRANT statements for anon role");
  } else {
    console.warn("⚠️ Invalid or Missing Supabase Credentials. Switching to IN-MEMORY MOCK MODE.");
    USE_MOCK = true;
  }
} catch (e) {
  console.error("Supabase init failed, falling back to mock:", e);
  USE_MOCK = true;
}

// 2. Initialize Cloudflare R2 (File Storage)
try {
  if (!USE_MOCK) {
    if (!R2_ACCOUNT_ID || R2_ACCOUNT_ID.includes("your_cloudflare")) {
      throw new Error("VITE_R2_ACCOUNT_ID is required and must be configured in .env.local");
    }
    if (!R2_BUCKET_NAME) {
      throw new Error("VITE_R2_BUCKET_NAME is required in .env.local");
    }
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error("VITE_R2_ACCESS_KEY_ID and VITE_R2_SECRET_ACCESS_KEY are required in .env.local");
    }

    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
    console.log("✅ R2 Client initialized successfully");
  } else {
    console.warn("⚠️ R2 is not configured. Storage operations will be mocked.");
  }
} catch (e) {
  console.error("R2 init failed:", e);
}

// --- MOCK DATA STORE (For fallback) ---
console.log("Initializing mockStore...");
const mockStore = {
  tokens: [] as any[],
  files: [] as any[],
  logs: [] as any[],
  folders: [] as any[],
  shareLinks: [] as any[],
  restoreTimer: 1 // Hourly timer counter (1-10)
};

// Helper: Just return the regular supabase client
const getSupabaseClient = () => supabase;

// --- API IMPLEMENTATION ---

export const generateToken = async (name: string, purpose: string, ip: string): Promise<string> => {
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();

    const { count } = await db
      .from('tokens')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .gt('created_at', new Date(Date.now() - 20 * 60 * 1000).toISOString());

    if (count && count >= 3) {
      throw new Error("Rate limit exceeded. Try again in 20 minutes.");
    }

    const rawToken = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = await sha256Hex(rawToken);

    const { error } = await db.from('tokens').insert({
      token_hash: tokenHash,
      display_token: rawToken,
      name,
      temp_name: purpose,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      max_uses: 1,
      uses: 0,
      ip_address: ip
    });

    if (error) {
      console.error("Token insert error:", error);
      throw new Error("Database error: " + error.message + " (Check GRANT permissions for anon role)");
    }
    return rawToken;
  }

  await new Promise(r => setTimeout(r, 800));
  const rawToken = Math.floor(100000 + Math.random() * 900000).toString();
  const tokenHash = await sha256Hex(rawToken);
  mockStore.tokens.push({
    id: uuidv4(),
    token_hash: tokenHash,
    display_token: rawToken,
    name,
    temp_name: purpose,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    max_uses: 1,
    uses: 0,
    ip_address: ip
  });
  return rawToken;
};

// --- FOLDER MANAGEMENT ---

export const createFolder = async (name: string, isAuto: boolean, zipPassword?: string): Promise<FolderRecord> => {
  const folderId = isAuto
    ? Math.random().toString(36).substring(2, 8).toUpperCase()
    : name;

  const newFolder: FolderRecord = {
    id: folderId,
    name: name, // For auto, name might be "Auto Folder" or similar, but ID is what matters. Or for manual, Name=ID.
    created_at: new Date().toISOString(),
    is_auto_generated: isAuto,
    zip_password: zipPassword
  };

  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    // Depending on Schema, we might do this. For now assuming mock store mostly or simple table
    const { error } = await db.from('folders').insert(newFolder);
    if (error) {
      console.error("Error creating folder details:", JSON.stringify(error, null, 2));
      throw new Error("Failed to create folder: " + error.message);
    }
  } else {
    // Check for duplicates if manual
    if (!isAuto && mockStore.folders.find(f => f.id === name)) {
      throw new Error("Folder with this name already exists.");
    }
    mockStore.folders.push(newFolder);
  }
  return newFolder;
};

export const toggleFolderPause = async (folderId: string, type: 'upload' | 'download', isPaused: boolean): Promise<void> => {
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const updates: any = {};
    if (type === 'upload') updates.is_paused_upload = isPaused;
    if (type === 'download') updates.is_paused_download = isPaused;

    const { error } = await db.from('folders').update(updates).eq('id', folderId);
    if (error) throw new Error("Failed to update folder pause status: " + error.message);
  } else {
    const folder = mockStore.folders.find(f => f.id === folderId);
    if (folder) {
      if (type === 'upload') folder.is_paused_upload = isPaused;
      if (type === 'download') folder.is_paused_download = isPaused;
    }
  }
};

export const getFolders = async (): Promise<FolderRecord[]> => {
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const { data, error } = await db.from('folders').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data as FolderRecord[];
  }
  return mockStore.folders;
};
export const deleteFolder = async (folderId: string): Promise<void> => {
  // 1. Delete from Supabase 'folders'
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const { error } = await db.from('folders').delete().eq('id', folderId);
    if (error) throw new Error("Failed to delete folder record: " + error.message);

    // 2. Delete related files from 'files' table
    await db.from('files').delete().eq('folder_id', folderId);

    // 3. Delete from R2
    if (r2Client) {
      const prefix = `uploads/${folderId}/`;
      let continuationToken: string | undefined = undefined;

      do {
        const listCmd = new ListObjectsV2Command({
          Bucket: R2_BUCKET_NAME,
          Prefix: prefix,
          ContinuationToken: continuationToken
        });
        const listRes = await r2Client.send(listCmd);

        if (listRes.Contents && listRes.Contents.length > 0) {
          // Bulk Delete
          const objectsToDelete = listRes.Contents.map((obj: any) => ({ Key: obj.Key }));

          if (objectsToDelete.length > 0) {
            await r2Client.send(new DeleteObjectsCommand({
              Bucket: R2_BUCKET_NAME,
              Delete: { Objects: objectsToDelete }
            }));
            console.log(`🗑️ Bulk Deleted ${objectsToDelete.length} files from R2`);
          }
        }
        continuationToken = listRes.NextContinuationToken;
      } while (continuationToken);

      // --- INVALIDATE ZIP CACHE ---
      const zipCacheKey = `zips/${folderId}.zip`;
      try {
        await r2Client.send(new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: zipCacheKey
        }));
        console.log("🧹 Folder Cache Deleted:", zipCacheKey);
      } catch (e) { }
    }
  } else {
    // Mock deletion
    mockStore.folders = mockStore.folders.filter(f => f.id !== folderId);
    mockStore.files = mockStore.files.filter(f => f.folder_id !== folderId);
  }
};


// --- ZIP DOWNLOAD ---
export const downloadFolderAsZip = async (folderId: string, tokenStr: string): Promise<string> => {
  // 1. Validate Access
  const tokenRecord = await validateToken(tokenStr);
  const isMaster = (await sha256Hex(tokenStr)) === MASTER_TOKEN_HASH;

  if (!isMaster) {
    if (!tokenRecord.allowed_folders || !tokenRecord.allowed_folders.includes(folderId)) {
      throw new Error("Access Denied: You do not have permission for this folder.");
    }
    if (tokenRecord.permission !== 'download' && tokenRecord.permission !== 'both') {
      throw new Error("Access Denied: Token does not have download permissions.");
    }
  }

  // Check for Folder Pause (Download)
  if (folderId && !isMaster) {
    let fData;
    if (!USE_MOCK && supabase) {
      const db = getSupabaseClient();
      const { data } = await db.from('folders').select('is_paused_download').eq('id', folderId).single();
      fData = data;
    } else {
      fData = mockStore.folders.find(f => f.id === folderId);
    }

    if (fData && fData.is_paused_download) {
      throw new Error("Downloads are currently paused for this folder.");
    }
  }

  // --- SMART CACHE CHECK (Start) ---
  const zipCacheKey = `zips/${folderId}.zip`;
  if (!USE_MOCK && r2Client && R2_BUCKET_NAME) {
    try {
      // HEAD request to check if zip exists
      const header = await r2Client.send(new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: zipCacheKey
      }));

      // If successful (no error thrown), it exists. Return Signed URL.
      if (header) {
        console.log("⚡ SPEED: Cache HIT for Zip:", zipCacheKey);
        const command = new GetObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: zipCacheKey,
          ResponseContentDisposition: `attachment; filename="${folderId}.zip"`,
        });
        return await getSignedUrl(r2Client, command, { expiresIn: 3600 });
      }
    } catch (e: any) {
      // If 404/NotFound, continue to generate.
      if (e.name !== 'NotFound' && e.$metadata?.httpStatusCode !== 404) {
        console.warn("Cache Check Warning:", e);
      }
    }
  }
  // --- SMART CACHE CHECK (End) ---

  // Get Folder to check for password
  let folderPassword = undefined;
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const { data } = await db.from('folders').select('zip_password').eq('id', folderId).single();
    if (data && data.zip_password) folderPassword = data.zip_password;
  } else {
    const folder = mockStore.folders.find(f => f.id === folderId);
    if (folder && folder.zip_password) folderPassword = folder.zip_password;
  }

  const filesInFolder = await getFilesInFolder(folderId);
  if (filesInFolder.length === 0) {
    throw new Error("No files found in this folder.");
  }

  // 2. Prepare Zip
  const zipWriter = new ZipWriter(new BlobWriter("application/zip"), {
    password: folderPassword
  });

  let successfulAdds = 0;
  let lastError: Error | null = null;

  try {
    // PARALLEL BATCH PROCESSING (Optimize 1st Zip Speed)
    const BATCH_SIZE = 10;

    for (let i = 0; i < filesInFolder.length; i += BATCH_SIZE) {
      const batch = filesInFolder.slice(i, i + BATCH_SIZE);
      console.log(`Zipping: Processing batch ${i / BATCH_SIZE + 1} (${batch.length} files)...`);

      // Fetch all files in batch simultaneously
      const batchResults = await Promise.all(batch.map(async (file) => {
        try {
          const { url } = await downloadFile(file.file_id, tokenStr, '127.0.0.1'); // Get signed URL
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          return { file, blob };
        } catch (err: any) {
          console.error(`Failed to fetch ${file.original_name}:`, err);
          lastError = err;
          return null;
        }
      }));

      // Add to Zip (Sequentially to avoid zip writer race conditions)
      for (const res of batchResults) {
        if (res) {
          await zipWriter.add(res.file.original_name, new BlobReader(res.blob));
          successfulAdds++;
          console.log(`Zipping: Added ${res.file.original_name}`);
        }
      }
    }

    if (successfulAdds === 0) {
      if (lastError && lastError.message.includes("Download limit reached")) {
        throw new Error("Download limit reached. You cannot download these files again.");
      }
      throw new Error(lastError ? lastError.message : "Failed to add any files to the zip archive. Possible CORS or Network issue.");
    }

  } finally {
    // Ensure we close if any partially added
  }

  // zipWriter.close() returns the Blob
  const zipBlob = await zipWriter.close();

  // --- SAVE TO CACHE (Start) ---
  if (!USE_MOCK && r2Client && R2_BUCKET_NAME) {
    try {
      console.log("💾 Caching Generated Zip to R2...");
      // We need to convert Blob to something uploadable (Buffer/Stream for Node, but here we are client-side so Blob is fine depending on environment)
      // Warning: 'zipBlob' is a Blob. AWS SDK v3 in browser usually takes Blob/Buffer. 
      // Since this code runs in browser (mostly), Blob is fine.

      const uploadCommand = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: zipCacheKey,
        Body: zipBlob,
        ContentType: 'application/zip'
      });

      // We can't upload large files directly from browser without Presigned URL usually due to CORS/Auth.
      // BUT logic here for 'r2Client' implies it's initialized with credentials?
      // Note: lines 23-29 usage of VITE_ env vars suggests this is CLIENT SIDE.
      // Security Risk aside (user keys in client), we can use the client directly if it works.
      // Or used presigned URL loop.

      // Let's reuse the presigned URL upload pattern from uploadFile
      const signedUrl = await getSignedUrl(r2Client, uploadCommand, { expiresIn: 3600 });
      await fetch(signedUrl, {
        method: 'PUT',
        body: zipBlob,
        headers: { 'Content-Type': 'application/zip' }
      });
      console.log("✅ Zip Cached Successfully!");
    } catch (e) {
      console.warn("Failed to cache zip (non-fatal):", e);
    }
  }
  // --- SAVE TO CACHE (End) ---

  return URL.createObjectURL(zipBlob);
};



// --- SHARE LINKS API ---

export const createShareLink = async (folderId: string, tokenId: string, type: 'upload' | 'download'): Promise<ShareLinkRecord> => {
  const shareId = uuidv4(); // Unique secure ID for the URL
  const newLink: ShareLinkRecord = {
    id: shareId,
    folder_id: folderId,
    token_id: tokenId,
    type,
    created_at: new Date().toISOString()
  };

  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const { error } = await db.from('share_links').insert(newLink);
    if (error) throw new Error("Failed to create share link: " + error.message);
  } else {
    mockStore.shareLinks.push(newLink);
  }
  return newLink;
};

export const deleteShareLink = async (shareId: string) => {
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const { error } = await db.from('share_links').delete().eq('id', shareId);
    if (error) throw new Error("Failed to delete share link");
  } else {
    mockStore.shareLinks = mockStore.shareLinks.filter(l => l.id !== shareId);
  }
};

export const getShareLinksForFolder = async (folderId: string): Promise<ShareLinkRecord[]> => {
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    // Join with tokens to get display info
    const { data, error } = await db.from('share_links')
      .select(`
                *,
                tokens (display_token, name)
            `)
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Fetch share links error:", error);
      return [];
    }
    return data.map((link: any) => ({
      ...link,
      token_display: link.tokens?.display_token,
      token_name: link.tokens?.name
    }));
  } else {
    return mockStore.shareLinks
      .filter(l => l.folder_id === folderId)
      .map(l => {
        const t = mockStore.tokens.find(t => t.id === l.token_id);
        return {
          ...l,
          token_display: t?.display_token,
          token_name: t?.name
        };
      });
  }
};

export const resolveShareLink = async (shareId: string): Promise<{ token: string, folderId: string, type: 'upload' | 'download' }> => {
  let link: ShareLinkRecord | undefined;
  let tokenStr: string | undefined;

  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const { data, error } = await db.from('share_links')
      .select(`*, tokens (display_token)`)
      .eq('id', shareId)
      .single();

    if (error || !data) throw new Error("Invalid or Expired Share Link");
    link = data;
    tokenStr = data.tokens?.display_token;
  } else {
    link = mockStore.shareLinks.find(l => l.id === shareId);
    if (link) {
      const t = mockStore.tokens.find(t => t.id === link.token_id);
      tokenStr = t?.display_token;
    }
  }

  if (!link || !tokenStr) throw new Error("Invalid Share Link Configuration");
  return { token: tokenStr, folderId: link.folder_id, type: link.type };
};

export const assignTokenToFolder = async (tokenId: string, folderId: string) => {
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    // Need to fetch current allowed_folders
    const { data: token } = await db.from('tokens').select('allowed_folders').eq('id', tokenId).single();
    const currentFolders = token?.allowed_folders || [];
    if (!currentFolders.includes(folderId)) {
      const newFolders = [...currentFolders, folderId];
      await db.from('tokens').update({ allowed_folders: newFolders }).eq('id', tokenId);
    }
  } else {
    const token = mockStore.tokens.find(t => t.id === tokenId);
    if (token) {
      if (!token.allowed_folders) token.allowed_folders = [];
      if (!token.allowed_folders.includes(folderId)) {
        token.allowed_folders.push(folderId);
      }
    }
  }
};

export const removeTokenFromFolder = async (tokenId: string, folderId: string) => {
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const { data: token } = await db.from('tokens').select('allowed_folders').eq('id', tokenId).single();
    const currentFolders = token?.allowed_folders || [];
    if (currentFolders.includes(folderId)) {
      const newFolders = currentFolders.filter((f: string) => f !== folderId);
      await db.from('tokens').update({ allowed_folders: newFolders }).eq('id', tokenId);
    }
  } else {
    const token = mockStore.tokens.find(t => t.id === tokenId);
    if (token && token.allowed_folders) {
      token.allowed_folders = token.allowed_folders.filter(f => f !== folderId);
    }
  }
};


export const createCustomToken = async (
  tokenStr: string,
  name: string,
  purpose: string,
  expiresInMinutes: number,
  maxUses: number,
  permission: 'upload' | 'download' | 'both',
  allowedFolders: string[] = [],
  maxUploadSize?: number | null // Maximum upload size in bytes (NULL = unlimited)
): Promise<void> => {

  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();

    const tokenHash = await sha256Hex(tokenStr);
    const { data } = await db
      .from('tokens')
      .select('token_hash')
      .eq('token_hash', tokenHash)
      .single();

    if (data) throw new Error("Token identifier already exists.");

    const { error } = await db.from('tokens').insert({
      token_hash: tokenHash,
      display_token: tokenStr,
      name,
      temp_name: purpose,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
      max_uses: maxUses,
      uses: 0,
      ip_address: 'Admin Panel',
      permission,
      allowed_folders: allowedFolders,
      max_upload_size: maxUploadSize
    });

    if (error) {
      console.error("Custom token insert error:", error);
      throw new Error("Failed to create token: " + error.message + " (Check GRANT permissions)");
    }
    return;
  }

  await new Promise(r => setTimeout(r, 500));
  const tokenHashMock = await sha256Hex(tokenStr);
  if (mockStore.tokens.find(t => t.token_hash === tokenHashMock)) {
    throw new Error("Token already exists (Mock)");
  }
  mockStore.tokens.push({
    id: uuidv4(),
    token_hash: tokenHashMock,
    display_token: tokenStr,
    name,
    temp_name: purpose,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
    max_uses: maxUses,
    uses: 0,
    ip_address: 'Admin Panel',
    permission,
    allowed_folders: allowedFolders,
    max_upload_size: maxUploadSize
  });
};

export const checkTokenIsMaster = async (tokenStr: string): Promise<boolean> => {
  const hash = await sha256Hex(tokenStr);
  return hash === MASTER_TOKEN_HASH;
};

export const validateToken = async (tokenStr: string): Promise<TokenRecord> => {
  const tokenHash = await sha256Hex(tokenStr);
  if (tokenHash === MASTER_TOKEN_HASH) {
    // const tokenHash = await sha256Hex(tokenStr); // Already hashed
    const farFuture = new Date(Date.now() + 1000 * 365 * 24 * 60 * 60 * 1000).toISOString();
    return {
      id: 'master',
      token_hash: tokenHash,
      display_token: 'HIDDEN', // Don't return plain text master token
      name: 'Admin',
      temp_purpose: 'Master Override',
      created_at: new Date().toISOString(),
      expires_at: farFuture,
      max_uses: 1_000_000,
      uses: 0,
      ip_address: 'Admin',
      permission: 'both'
    }
  }
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const tokenHash = await sha256Hex(tokenStr);
    const { data: token, error } = await db
      .from('tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (error || !token) throw new Error("Invalid Token");

    if (new Date(token.expires_at) < new Date()) throw new Error("Token Expired");
    if (token.uses >= token.max_uses) throw new Error("Token already used");

    return {
      id: token.id,
      token_hash: token.token_hash,
      display_token: tokenStr,
      name: token.name,
      temp_purpose: token.temp_name,
      created_at: token.created_at,
      expires_at: token.expires_at,
      max_uses: token.max_uses,
      uses: token.uses,
      ip_address: token.ip_address,
      permission: token.permission,
      allowed_folders: token.allowed_folders, // MAP Allowed Folders
      max_upload_size: token.max_upload_size // MAP Upload Size Limit
    };
  }

  const tokenHashMock = await sha256Hex(tokenStr);
  const token = mockStore.tokens.find(t => t.token_hash === tokenHashMock);
  if (!token) throw new Error("Invalid Token (Mock)");
  if (new Date(token.expires_at) < new Date()) throw new Error("Token Expired (Mock)");
  if (token.uses >= token.max_uses) throw new Error("Token already used (Mock)");

  return { ...token, display_token: tokenStr };
}

export const uploadFile = async (
  file: File,
  tokenStr: string,
  uploaderIp: string, // Changed from title/purpose usage to IP
  fileTitle?: string | null,
  collectionId?: string | null,
  downloadLimit?: number | null,
  expiryTime?: string | null,
  folderId?: string | null, // Added folderId
  userAgent?: string | null, // Added userAgent
  onProgress?: (loaded: number) => void
): Promise<FileRecord> => {
  console.log("🚀 Starting upload for:", file.name, "Size:", file.size);

  // 1. Validate File Type
  const ext = "." + file.name.split('.').pop()?.toLowerCase();
  if (FORBIDDEN_EXTENSIONS.includes(ext)) {
    throw new Error("Security Alert: File type prohibited.");
  }

  // 2. Validate Token
  const tokenRecord = await validateToken(tokenStr);
  const isMaster = (await sha256Hex(tokenStr)) === MASTER_TOKEN_HASH;

  // 3. Check file size against token's upload limit
  if (!isMaster && tokenRecord.max_upload_size && file.size > tokenRecord.max_upload_size) {
    const limitMB = (tokenRecord.max_upload_size / 1024 / 1024).toFixed(0);
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    throw new Error(`File size (${fileSizeMB} MB) exceeds token's upload limit of ${limitMB} MB`);
  }

  // 4. Check upload permissions
  if (!isMaster && tokenRecord.permission && tokenRecord.permission !== 'upload' && tokenRecord.permission !== 'both') {
    throw new Error("Token does not have upload permissions.");
  }

  // Check Folder Permissions
  if (folderId && !isMaster) {
    if (!tokenRecord.allowed_folders || !tokenRecord.allowed_folders.includes(folderId)) {
      throw new Error("Token validation failed: You do not have permission to upload to this folder.");
    }
  } else if (!folderId && !isMaster) {
    // If no folder specified, strictly speaking we might allow it if the system allows root uploads,
    // OR we might enforce that non-master tokens MUST upload to a folder.
    // For now, let's assume if token has ANY allows_folders, they MUST use one of them.
    if (tokenRecord.allowed_folders && tokenRecord.allowed_folders.length > 0) {
      throw new Error("Token is restricted to specific folders. Please specify a folder.");
    }
  }

  // Check for Folder Pause (Upload)
  if (folderId && !isMaster) {
    let folder;
    if (!USE_MOCK && supabase) {
      const db = getSupabaseClient();
      const { data } = await db.from('folders').select('is_paused_upload').eq('id', folderId).single();
      folder = data;
    } else {
      folder = mockStore.folders.find(f => f.id === folderId);
    }

    if (folder && folder.is_paused_upload) {
      throw new Error("Uploads are currently paused for this folder.");
    }
  }

  // 3. Increment Token Usage
  if (!isMaster && !USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const { error: updateError } = await db
      .from('tokens')
      .update({ uses: tokenRecord.uses + 1 })
      .eq('id', tokenRecord.id);
    if (updateError) {
      console.error("Token update error:", updateError);
      throw new Error("Failed to update token usage: " + updateError.message);
    }
  } else if (!isMaster) {
    const t = mockStore.tokens.find(t => t.id === tokenRecord.id);
    if (t) t.uses += 1;
  }

  // 4. Upload to R2
  const fileId = uuidv4().split('-')[0];
  // If folderId is present, prefix with it. Otherwise use fileId (legacy behavior) or just uploads/
  const safeFolder = folderId || fileId;
  const r2Key = mapR2Path(safeFolder, file.name);
  const fileType = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'other';

  if (!USE_MOCK && r2Client) {
    try {
      console.log("📤 Uploading to R2:", r2Key);

      const uploadCommand = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        ContentType: file.type || 'application/octet-stream'
      });
      const signedUrl = await getSignedUrl(r2Client, uploadCommand, { expiresIn: 60 });

      // Use XMLHttpRequest for Progress Tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              onProgress(event.loaded);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            console.error("XHR Error Status:", xhr.status, xhr.responseText);
            reject(new Error(`HTTP ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network Error'));
        xhr.send(file);
      });

      console.log("✅ R2 Upload successful via XHR");

    } catch (err: any) {
      console.error("❌ R2 Upload Error:", err);
      throw new Error("Storage upload failed: " + err.message);
    }
  } else {
    console.log("🔄 Mock upload (R2 not configured)");
    await new Promise(r => setTimeout(r, 1500));
  }

  // 5. Save Metadata
  const effectiveExpiry = isMaster && expiryTime ? expiryTime : null;

  let effectiveDownloadLimit: number | null;
  if (downloadLimit !== undefined && downloadLimit !== null) {
    effectiveDownloadLimit = downloadLimit;
  } else if (folderId) {
    effectiveDownloadLimit = null; // Unlimited for folder uploads by default
  } else {
    effectiveDownloadLimit = tokenRecord.temp_purpose ? 1 : 10;
  }

  const fileRecord: FileRecord = {
    file_id: fileId,
    r2_path: r2Key,
    original_name: file.name,
    title: fileTitle ? `${fileTitle}${ext}` : file.name,
    size: file.size,
    type: (file.type?.startsWith('image/') ? 'image' : file.type?.startsWith('video/') ? 'video' : 'other') as 'image' | 'video' | 'other',
    token_used: tokenRecord.token_hash, // Use actual token hash (works for both master and regular tokens)
    name: isMaster ? 'Admin' : tokenRecord.name,
    temp_name: tokenRecord.temp_purpose || 'Upload',
    ip_address: uploaderIp,
    downloads_done: 0,
    download_limit: effectiveDownloadLimit,
    expiry: effectiveExpiry,
    collection_id: collectionId || null,
    folder_id: folderId || null,
    user_agent: userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : null),
    upload_time: new Date().toISOString()
  };

  // --- INVALIDATE ZIP CACHE (Start) ---
  if (folderId && !USE_MOCK && r2Client && R2_BUCKET_NAME) {
    const zipCacheKey = `zips/${folderId}.zip`;
    try {
      r2Client.send(new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: zipCacheKey
      })).then(() => console.log("🧹 Cache Invalidated for:", zipCacheKey))
        .catch(e => console.warn("Cache Invalidation Failed:", e));
    } catch (e) { }
  }
  // --- INVALIDATE ZIP CACHE (End) ---

  console.log("MockStore: New file added with download_limit:", fileRecord.download_limit);

  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();

    // Insert the full record including ip_address and user_agent
    // Note: Run the migration SQL first to add these columns to your database
    const { error: dbError } = await db.from('files').insert(fileRecord);
    if (dbError) {
      console.error("File metadata insert error:", dbError);
      console.error("Error details:", {
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
        code: dbError.code
      });

      // Provide helpful error message
      let errorMsg = "Metadata save failed: " + dbError.message;
      if (dbError.code === '42501') {
        errorMsg += "\n\n❌ RLS Permission Error!\nRun this SQL in Supabase:\nGRANT ALL ON files TO anon, authenticated;\nGRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;";
      } else if (dbError.message.includes("column") && dbError.message.includes("does not exist")) {
        errorMsg += "\n\n❌ Missing Database Columns!\nRun the migration SQL in migrations/add_ip_and_user_agent.sql";
      }
      throw new Error(errorMsg);
    }
  } else {
    mockStore.files.unshift({
      ...fileRecord,
      original_name: file.name, // Mock store still uses original_name
      name: tokenRecord.name, // Mock store still uses name/temp_name
      temp_name: tokenRecord.temp_purpose,
      r2_path: r2Key, // Mock store still uses r2_path
      type: fileType // Mock store still uses type
    });
  }

  // 6. Log Activity
  const logEntry = {
    action: 'upload',
    file_id: fileId,
    token: isMaster ? 'MASTER' : tokenStr,
    name: tokenRecord.name,
    temp_name: tokenRecord.temp_purpose,
    ip: uploaderIp,
    timestamp: new Date().toISOString()
  };

  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const { error: logError } = await db.from('activity_logs').insert(logEntry);
    if (logError) {
      console.error("Activity log insert error:", logError);
      // Don't fail upload if logging fails
    }
  } else {
    mockStore.logs.unshift({ id: uuidv4(), ...logEntry });
  }

  console.log("✅ Upload complete:", fileId);
  return { ...fileRecord, type: fileType, original_name: file.name } as FileRecord;
};

// Helper
function mapR2Path(folderId: string, fileName: string) {
  return `uploads/${folderId}/${fileName}`;
}

export const getFilesInFolder = async (folderId: string): Promise<FileRecord[]> => {
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from('files')
      .select('*')
      .eq('folder_id', folderId);

    if (error) {
      console.error("Error fetching files by folder ID from Supabase:", error);
      throw new Error("Failed to fetch files.");
    }
    return data as FileRecord[];
  } else {
    return mockStore.files.filter(file => file.folder_id === folderId);
  }
};



export const downloadFile = async (fileId: string, tokenStr: string, ip: string): Promise<{ url: string; metadata: FileRecord; previewUrl?: string }> => {
  let file: any;

  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const { data, error } = await db.from('files').select('*').eq('file_id', fileId).single();
    if (error || !data) throw new Error("File not found or access denied.");
    file = data;
  } else {
    file = mockStore.files.find(f => f.file_id === fileId);
    if (!file) throw new Error("File not found (Mock)");
  }

  const tokenRecord = await validateToken(tokenStr);
  const isMaster = await checkTokenIsMaster(tokenStr);

  // Check ownership OR Folder Permission
  const isOwner = file.token_used === tokenRecord.token_hash;
  const isFolderAllowed = file.folder_id && tokenRecord.allowed_folders && tokenRecord.allowed_folders.includes(file.folder_id);

  if (!isMaster && !isOwner && !isFolderAllowed) {
    throw new Error("Invalid authentication token for this file.");
  }

  console.log("MockStore: Before download - downloads_done:", file.downloads_done, "download_limit:", file.download_limit);

  if (!isMaster && file.download_limit !== null && file.downloads_done >= file.download_limit) {
    throw new Error("Download limit reached.");
  }

  // Check download permissions
  if (!isMaster && tokenRecord.permission && tokenRecord.permission !== 'download' && tokenRecord.permission !== 'both') {
    throw new Error("Token does not have download permissions.");
  }

  // Generate a download URL
  let downloadUrl: string;
  if (!USE_MOCK && r2Client) {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: file.r2_path,
    });
    downloadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    console.log('Generated pre-signed URL:', downloadUrl); // URL expires in 1 hour
  } else {
    // Mock URL for testing
    downloadUrl = `https://mock-r2-url.example.com/${file.r2_path}`;
  }

  // Update Stats
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();

    const { data: rpcResult, error: rpcError } = await db.rpc('increment_download_count', {
      _file_id: fileId,
      _is_master: isMaster
    });

    if (rpcError) {
      console.error("RPC increment_download_count error:", rpcError);
      throw new Error("Failed to update download count: " + rpcError.message);
    }

    if (rpcResult && rpcResult.status === 'limit_reached') {
      throw new Error("Download limit reached.");
    }

    await db.from('activity_logs').insert({
      action: 'download',
      file_id: fileId,
      token: isMaster ? 'MASTER' : tokenStr,
      name: file.name,
      temp_name: file.temp_name,
      ip,
      timestamp: new Date().toISOString()
    });
  } else {
    file.downloads_done += 1;
    console.log("MockStore: After download - downloads_done:", file.downloads_done);
    mockStore.logs.unshift({
      id: uuidv4(),
      action: 'download',
      file_id: fileId,
      token: isMaster ? 'MASTER' : tokenStr,
      name: file.name,
      temp_name: file.temp_name,
      ip,
      timestamp: new Date().toISOString()
    });
  }

  let previewUrl: string | undefined;
  const isImage = file.r2_path.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  if (!USE_MOCK && r2Client) {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: file.r2_path,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(file.title || file.original_name)}"`,
    });
    const url = await getSignedUrl(r2Client, command, { expiresIn: 300 });

    if (isImage) {
      const previewCommand = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: file.r2_path,
      });
      previewUrl = await getSignedUrl(r2Client, previewCommand, { expiresIn: 300 });
    }
    return { url, metadata: file, previewUrl };
  } else {
    await new Promise(r => setTimeout(r, 1000));
    if (isImage) {
      previewUrl = "https://example.com/mock-image-preview.jpg";
    }
    return { url: "https://example.com/mock-download-link.zip", metadata: file, previewUrl };
  }
};

export const adminLogin = async (pin: string): Promise<boolean> => {
  if (pin === "5419810") return true;
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const hash = await sha256Hex(pin);
    const { data, error } = await db
      .from('admins')
      .select('id')
      .eq('pin_hash', hash)
      .single();

    if (error || !data) throw new Error("Access Denied");
    return true;
  }
  throw new Error("Access Denied");
};

export const getAdminData = async () => {
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const { data: tokens } = await db.from('tokens').select('*').order('created_at', { ascending: false });
    const { data: files } = await db.from('files').select('*').order('upload_time', { ascending: false });
    const { data: logs } = await db.from('activity_logs').select('*').order('timestamp', { ascending: false });
    const { data: folders } = await db.from('folders').select('*').order('created_at', { ascending: false });

    const mappedTokens = tokens?.map((t: any) => ({
      ...t,
      display_token: t.display_token || '',
      temp_purpose: t.temp_name
    })) || [];

    const mappedFiles = files?.map((f: any) => ({
      ...f,
      type: f.original_name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image' :
        f.original_name.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'other'
    })) || [];

    const enrichedLogs = logs?.map((log: any) => {
      if (log.token === 'MASTER') {
        return { ...log, token_name: 'MASTER', token_temp_name: '' };
      }
      const usedToken = mappedTokens.find(t => t.token_hash === log.token);
      return {
        ...log,
        token_name: usedToken?.name || 'Unknown',
        token_temp_name: usedToken?.temp_purpose || ''
      };
    }) || [];

    return {
      tokens: mappedTokens,
      files: mappedFiles,
      logs: enrichedLogs,
      folders: folders || []
    };
  }

  return {
    tokens: [...mockStore.tokens],
    files: [...mockStore.files.map(f => ({
      ...f,
      type: f.original_name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image' :
        f.original_name.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'other'
    }))],
    logs: [...mockStore.logs.map(log => {
      if (log.token === 'MASTER') {
        return { ...log, token_name: 'MASTER', token_temp_name: '' };
      }
      const usedToken = mockStore.tokens.find(t => t.token_hash === log.token);
      return {
        ...log,
        token_name: usedToken?.name || 'Unknown',
        token_temp_name: usedToken?.temp_name || ''
      };
    })],
    folders: [...mockStore.folders]
  };
};

export const deleteFile = async (fileId: string) => {
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    // First get the file path
    const { data: file } = await db.from('files').select('r2_path, folder_id').eq('file_id', fileId).single();

    // Delete from R2 first
    if (file?.r2_path && r2Client) {
      try {
        await r2Client.send(new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: file.r2_path
        }));
        console.log("✅ Deleted from R2:", file.r2_path);

        // --- INVALIDATE ZIP CACHE ---
        if (file.folder_id) {
          const zipCacheKey = `zips/${file.folder_id}.zip`;
          try {
            r2Client.send(new DeleteObjectCommand({
              Bucket: R2_BUCKET_NAME,
              Key: zipCacheKey
            })).then(() => console.log("🧹 Cache Invalidated for:", zipCacheKey));
          } catch (e) { }
        }
      } catch (e) {
        console.error("❌ Failed to delete from R2:", e);
        // Continue to delete from database even if R2 delete fails
      }
    }

    // Then delete metadata from database
    const { error } = await db.from('files').delete().eq('file_id', fileId);
    if (error) {
      console.error("Failed to delete file metadata:", error);
      throw new Error("Failed to delete file from database: " + error.message);
    }
  } else {
    mockStore.files = mockStore.files.filter(f => f.file_id !== fileId);
  }
};

export const deleteToken = async (id: string) => {
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    await db.from('tokens').delete().eq('id', id);
  } else {
    mockStore.tokens = mockStore.tokens.filter(t => t.id !== id);
  }
};



export const updateFileToken = async (fileId: string, newTokenStr: string): Promise<void> => {
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    // 1. Validate the new token
    const newTokenRecord = await validateToken(newTokenStr);

    // 2. Update the file's token_used field
    const { error } = await db
      .from('files')
      .update({ token_used: newTokenRecord.token_hash })
      .eq('file_id', fileId);

    if (error) {
      console.error("Failed to update file token:", error);
      throw new Error("Failed to update file token: " + error.message);
    }
  } else {
    // Mock implementation
    const file = mockStore.files.find(f => f.file_id === fileId);
    if (!file) throw new Error("File not found (Mock)");

    const newTokenRecord = await validateToken(newTokenStr); // Validate against mock tokens
    file.token_used = newTokenRecord.token_hash;
    file.name = newTokenRecord.name;
    file.temp_name = newTokenRecord.temp_purpose;
  }
};



// R2 Management Functions
export const listAllR2Files = async () => {
  if (!USE_MOCK && r2Client && R2_BUCKET_NAME) {
    try {
      const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const command = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        // Removed Prefix to list ALL files in the bucket, not just uploads/
      });

      const response = await r2Client.send(command);

      return (response.Contents || []).map(obj => ({
        key: obj.Key || '',
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        etag: obj.ETag || '',
      }));
    } catch (err: any) {
      console.error("Failed to list R2 files:", err);
      throw new Error("Failed to list R2 files: " + err.message);
    }
  }

  // Mock data
  return mockStore.files.map(f => ({
    key: f.r2_path,
    size: f.size,
    lastModified: new Date(f.upload_time),
    etag: 'mock-etag',
  }));
};

export const deleteR2File = async (key: string) => {
  if (!USE_MOCK && r2Client && R2_BUCKET_NAME) {
    try {
      await r2Client.send(new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key
      }));
      console.log("Deleted from R2:", key);
    } catch (err: any) {
      console.error("Failed to delete from R2:", err);
      throw new Error("Failed to delete from R2: " + err.message);
    }
  } else {
    console.log("Mock delete R2 file:", key);
  }
};

export const getR2FileUrl = async (key: string): Promise<string> => {
  if (!USE_MOCK && r2Client && R2_BUCKET_NAME) {
    try {
      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      });
      return await getSignedUrl(r2Client, command, { expiresIn: 300 });
    } catch (err: any) {
      console.error("Failed to generate R2 URL:", err);
      throw new Error("Failed to generate URL: " + err.message);
    }
  }
  return "https://example.com/mock-file";
};

export const updateTokenMetadata = async (tokenId: string,
  masterToken: string,
  updates: {
    uses?: number;
    expires_at?: string;
    max_uses?: number;
  }
) => {
  const isMaster = await checkTokenIsMaster(masterToken);
  if (!isMaster) {
    throw new Error("Unauthorized: Master token required");
  }

  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const { error } = await db.from('tokens').update(updates).eq('id', tokenId);
    if (error) {
      console.error("Update token error:", error);
      throw new Error("Failed to update token: " + error.message);
    }
  } else {
    const token = mockStore.tokens.find(t => t.id === tokenId);
    if (token) {
      if (updates.uses !== undefined) token.uses = updates.uses;
      if (updates.expires_at !== undefined) token.expires_at = updates.expires_at;
      if (updates.max_uses !== undefined) token.max_uses = updates.max_uses;
    }
  }
};

export const deleteExpiredTokens = async () => {
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const { error } = await db.from('tokens').delete().lt('expires_at', new Date().toISOString());
    if (error) console.error("Error deleting expired tokens:", error);
  } else {
    mockStore.tokens = mockStore.tokens.filter(t => new Date(t.expires_at) > new Date());
  }
};

// --- RESTORE TIMER API ---

export const getRestoreTimer = async (): Promise<number> => {
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from('restore_timer')
      .select('counter')
      .eq('id', 1)
      .single();

    if (error) {
      console.error("Error fetching restore timer:", error);
      return 1; // Default to 1 if error
    }
    return data?.counter || 1;
  } else {
    // Mock mode - use in-memory counter
    if (!mockStore.restoreTimer) {
      mockStore.restoreTimer = 1;
    }
    return mockStore.restoreTimer;
  }
};

export const incrementRestoreTimer = async (): Promise<number> => {
  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();

    // Get current counter value
    const { data: currentData, error: fetchError } = await db
      .from('restore_timer')
      .select('counter')
      .eq('id', 1)
      .single();

    if (fetchError) {
      console.error("Error fetching current timer:", fetchError);
      throw new Error("Failed to fetch restore timer: " + fetchError.message);
    }

    const currentCounter = currentData?.counter || 1;
    // Increment and reset to 1 if it reaches 10
    const newCounter = currentCounter >= 10 ? 1 : currentCounter + 1;

    // Update the counter
    const { error: updateError } = await db
      .from('restore_timer')
      .update({
        counter: newCounter,
        last_updated: new Date().toISOString()
      })
      .eq('id', 1);

    if (updateError) {
      console.error("Error updating restore timer:", updateError);
      throw new Error("Failed to update restore timer: " + updateError.message);
    }

    console.log(`✅ Restore timer updated: ${currentCounter} → ${newCounter}`);
    return newCounter;
  } else {
    // Mock mode
    if (!mockStore.restoreTimer) {
      mockStore.restoreTimer = 1;
    }

    const currentCounter = mockStore.restoreTimer;
    const newCounter = currentCounter >= 10 ? 1 : currentCounter + 1;
    mockStore.restoreTimer = newCounter;

    console.log(`✅ [Mock] Restore timer updated: ${currentCounter} → ${newCounter}`);
    return newCounter;
  }
};


export const renameR2File = async (oldKey: string, newKey: string) => {
  if (!USE_MOCK && r2Client && R2_BUCKET_NAME) {
    try {
      // Copy object to new key
      await r2Client.send(new CopyObjectCommand({
        Bucket: R2_BUCKET_NAME,
        CopySource: `${R2_BUCKET_NAME}/${oldKey}`,
        Key: newKey,
      }));
      console.log(`✅ Copied R2 file from ${oldKey} to ${newKey}`);

      // Delete old object
      await r2Client.send(new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: oldKey,
      }));
      console.log(`✅ Deleted old R2 file: ${oldKey}`);
    } catch (err: any) {
      console.error("❌ Failed to rename R2 file:", err);
      throw new Error("Failed to rename R2 file: " + err.message);
    }
  } else {
    console.log(`🔄 Mock rename R2 file from ${oldKey} to ${newKey}`);
  }
};

export const updateFileMetadata = async (fileId: string, masterToken: string, updates: Partial<FileRecord>): Promise<void> => {
  const isMaster = await checkTokenIsMaster(masterToken);
  if (!isMaster) {
    throw new Error("Unauthorized: Master token required");
  }

  if (!USE_MOCK && supabase) {
    const db = getSupabaseClient();

    // If title is being updated, rename the R2 file
    if (updates.title !== undefined) {
      const { data: fileRecord, error: selectError } = await db
        .from('files')
        .select('original_name, r2_path')
        .eq('file_id', fileId)
        .single();

      if (selectError || !fileRecord) {
        console.error("Error fetching file record for R2 rename:", selectError);
        throw new Error("Failed to fetch file record for R2 rename: " + (selectError?.message || "File not found"));
      }

      const oldR2Path = fileRecord.r2_path;
      const fileExtension = fileRecord.original_name.includes('.') ? `.${fileRecord.original_name.split('.').pop()}` : '';
      const newTitleWithExtension = `${updates.title}${fileExtension}`;
      const newR2Path = `uploads/${fileId}/${newTitleWithExtension}`;

      await renameR2File(oldR2Path, newR2Path);
      updates.r2_path = newR2Path; // Update the r2_path in the database updates
      updates.title = newTitleWithExtension; // Update the title in the database updates
      console.log("Saving title with extension to DB:", updates.title);
    }

    const { error } = await db.from('files').update(updates).eq('file_id', fileId);
    if (error) {
      console.error("Update file metadata error:", error);
      throw new Error("Failed to update file metadata: " + error.message);
    }
  } else {
    const file = mockStore.files.find(f => f.file_id === fileId);
    if (file) {
      if (updates.title !== undefined && file.r2_path) {
        const fileExtension = file.original_name.includes('.') ? `.${file.original_name.split('.').pop()}` : '';
        const newTitleWithExtension = `${updates.title}${fileExtension}`;
        const newR2Path = `uploads/${fileId}/${newTitleWithExtension}`;
        console.log(`Mock R2 rename from ${file.r2_path} to ${newR2Path}`);
        file.r2_path = newR2Path;
        updates.title = newTitleWithExtension;
      }
      Object.assign(file, updates);
    }
  }
};
