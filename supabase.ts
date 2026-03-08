import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = 'https://uhgltitmwhoxmszfkext.supabase.co';
// IMPORTANTE: Lembre-se de colar a sua Publishable key gigante de volta aqui embaixo
const supabaseAnonKey = 'sb_publishable_mC6IHBmsxWQz_l0HM5Oyqg_AYaGwv5t'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Aqui está a mágica: Ele só usa o AsyncStorage se o ambiente NÃO for a Web
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});