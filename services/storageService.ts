import { supabase } from '../libs/supabase';

export const uploadAvatar = async (
  base64Data: string,
  userId: string,
): Promise<{ publicUrl: string | null; error: { message: string } | null }> => {
  const byteChars = atob(base64Data);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNums)], { type: 'image/jpeg' });
  const fileName = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) return { publicUrl: null, error };
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return { publicUrl: urlData.publicUrl, error: null };
};

export const uploadImagemPost = async (
  base64Data: string,
  userId: string,
): Promise<{ publicUrl: string | null; error: { message: string } | null }> => {
  const byteChars = atob(base64Data);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNums)], { type: 'image/jpeg' });
  const fileName = `post_${userId}_${Date.now()}.jpg`;
  const { data: uploadData, error } = await supabase.storage.from('post-images').upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error || !uploadData) return { publicUrl: null, error: error ?? null };
  const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(fileName);
  return { publicUrl: urlData.publicUrl, error: null };
};

export const uploadImagemMensagem = async (
  base64Data: string,
  userId: string,
): Promise<{ publicUrl: string | null; error: { message: string } | null }> => {
  const byteChars = atob(base64Data);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNums)], { type: 'image/jpeg' });
  const fileName = `msg_${userId}_${Date.now()}.jpg`;
  const { data: uploadData, error } = await supabase.storage.from('post-images').upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error || !uploadData) return { publicUrl: null, error: error ?? null };
  const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(fileName);
  return { publicUrl: urlData.publicUrl, error: null };
};
