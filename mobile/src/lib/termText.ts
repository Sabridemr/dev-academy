/**
 * Tanım metnini kısaltır: ilk cümleyi alır; hâlâ uzunsa kelime sınırında keser ve "…" ekler.
 * Bildirim gövdesi ve oyun kartları gibi dar alanlarda kullanılır.
 */
export function shortDefinition(text: string, max = 130): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  // Cümle sonu: nokta/ünlem/soru + boşluk + büyük harf ("vb. ", "örn. " gibi kısaltmaları bölmemek için)
  const match = /^(.+?[.!?])\s+(?=[A-ZÇĞİÖŞÜ])/.exec(clean);
  const first = match ? match[1]! : clean;
  if (first.length <= max) return first;
  const cut = first.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:(-]+$/, '')}…`;
}
