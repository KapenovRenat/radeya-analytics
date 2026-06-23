/**
 * Парсинг названия товара для сообщения поставщику.
 *
 * Вход:  "RADEYA Буйвол, 33x59x42 см, коричневый [ткань Milos16/Milos 02]"
 * Выход: { displayName: "RADEYA Буйвол, 33x59x42 см", fabric: "ткань Milos16/Milos 02" }
 *
 * Правила:
 *  - fabric = содержимое квадратных скобок [...]
 *  - displayName = часть до скобок, обрезанная по последнему «см» (цвет отбрасываем)
 */

export interface ParsedName {
  displayName: string;
  fabric: string | null;
}

export function parseProductName(full: string | null | undefined): ParsedName {
  const name = (full ?? "").trim();
  if (!name) return { displayName: "", fabric: null };

  // Ткань — то что в [ ]
  const bracket = name.match(/\[([^\]]+)\]/);
  const fabric = bracket ? bracket[1].trim() : null;

  // Убираем скобки из названия
  let base = name.replace(/\[[^\]]*\]/g, "").trim();

  // Обрезаем по последнему «см» (оставляем размеры, отбрасываем цвет после)
  const lower = base.toLowerCase();
  const smIdx = lower.lastIndexOf("см");
  if (smIdx !== -1) {
    base = base.slice(0, smIdx + 2).trim();
  }
  // Чистим хвостовую пунктуацию
  base = base.replace(/[,\s]+$/, "").trim();

  return { displayName: base, fabric };
}
