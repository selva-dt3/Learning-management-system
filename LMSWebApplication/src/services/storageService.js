import { getSupabaseClient } from '../lib/supabaseClient';
import { ApplicationError } from '../utils/errors';

const supabase = getSupabaseClient();

// PUBLIC_INTERFACE
export async function uploadLessonFile(bucket, path, file) {
  /** Upload a file to Supabase Storage; requires RLS/storage policy allowing auth users to upload */
  try {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    return `${bucket}/${path}`;
  } catch (e) {
    throw new ApplicationError(e.message || 'Upload failed', 'STORAGE_UPLOAD');
  }
}

// PUBLIC_INTERFACE
export async function getSignedUrl(storagePath, expiresInSeconds = 3600) {
  /** Create a signed URL for a given storage path (bucket/path) */
  const [bucket, ...rest] = (storagePath || '').split('/');
  const path = rest.join('/');
  if (!bucket || !path) throw new ApplicationError('Invalid storage path', 'STORAGE_PATH');
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw new ApplicationError(error.message || 'Could not create signed URL', 'STORAGE_SIGN');
  return data?.signedUrl;
}
