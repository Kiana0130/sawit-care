import * as SecureStore from 'expo-secure-store';

export const get = (key: string) => SecureStore.getItemAsync(key);
export const set = (key: string, value: string) => SecureStore.setItemAsync(key, value);
export const remove = (key: string) => SecureStore.deleteItemAsync(key);
