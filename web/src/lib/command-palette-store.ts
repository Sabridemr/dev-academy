'use client';

import { create } from 'zustand';

/** ⌘K komut paleti açık/kapalı durumu (Header düğmesi ve klavye kısayolu paylaşır) */
interface CommandPaletteState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useCommandPalette = create<CommandPaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
