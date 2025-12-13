// Consolidated TokenRecord
export interface TokenRecord {
  id: string;
  token_hash: string; // In real app, this is hashed. Display purposes: raw.
  display_token: string;
  name: string;
  temp_purpose: string;
  created_at: string;
  expires_at: string;
  max_uses: number;
  uses: number;
  ip_address: string;
  permission?: 'upload' | 'download' | 'both';
  allowed_folders?: string[]; // List of folder IDs this token can access
  max_upload_size?: number | null; // Maximum upload size in bytes (NULL = unlimited)
}

// Consolidated FileRecord
export interface FileRecord {
  file_id: string;
  r2_path: string;
  size: number;
  original_name: string;
  title?: string;
  upload_time: string;
  token_used: string;
  name: string; // Uploader name
  temp_name: string; // Purpose
  expiry: string | null;
  download_limit: number;
  downloads_done: number;
  type: 'image' | 'video' | 'other';
  collection_id?: string;
  folder_id?: string; // The folder this file belongs to
  filename?: string; // R2 Key
  ip_address?: string;
  user_agent?: string;
}

export interface ActivityLog {
  id: string;
  action: 'upload' | 'download' | 'delete';
  file_id: string;
  token: string;
  name: string;
  temp_name: string;
  timestamp: string;
  token_name: string; // Add this as it is used in AdminDashboard
  token_temp_name: string; // Add this as it is used in AdminDashboard
  ip: string; // Add this as it is used
}

export interface AdminSession {
  token: string;
  expiry: number;
}

export interface FolderRecord {
  id: string; // The folder ID (manual name or auto-generated)
  name: string; // Display name (same as ID for manual)
  created_at: string;
  is_auto_generated: boolean;
  zip_password?: string;
  is_paused_upload?: boolean; // New: Pause uploads to this folder
  is_paused_download?: boolean; // New: Pause downloads from this folder
}

export interface ShareLinkRecord {
  id: string; // The unique "shareId" exposed in URL
  folder_id: string;
  token_id: string;
  type: 'upload' | 'download';
  created_at: string;
  created_by?: string; // Admin?
  token_display?: string; // For UI display (joined)
  token_name?: string; // For UI display (joined)
}