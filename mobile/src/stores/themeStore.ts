import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'light' | 'dark' | 'system';

type ThemeState = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system' as ThemePreference,
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: 'orbit-appearance',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
