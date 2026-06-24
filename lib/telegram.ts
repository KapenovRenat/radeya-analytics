/**
 * Telegram Bot API helper.
 */

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: html,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      },
    );
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description ?? "Telegram error" };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Отправить фото с подписью (для карточки товара поставщику).
 * photoUrl должен быть публично доступен (Cloudinary).
 */
export async function sendTelegramPhoto(
  botToken: string,
  chatId: string,
  photoUrl: string,
  caption: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendPhoto`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          photo: photoUrl,
          caption,
          parse_mode: "HTML",
        }),
      },
    );
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description ?? "Telegram error" };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Отправить готовую картинку (PNG-буфер) как фото — без подписи.
 * Используется когда вся карточка отрендерена в одно изображение.
 */
export async function sendTelegramPhotoBuffer(
  botToken: string,
  chatId: string,
  png: Uint8Array,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const fd = new FormData();
    fd.append("chat_id", chatId.trim());
    fd.append("photo", new Blob([png as BlobPart], { type: "image/png" }), "card.png");
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description ?? "Telegram error" };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function tgFmt(n: number): string {
  return n.toLocaleString("ru-RU");
}
export function tgPct(n: number): string {
  return n.toFixed(1) + "%";
}
export function tgMoney(n: number): string {
  return tgFmt(Math.round(n)) + " тг";
}
export function tgDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}
export function tgWeekRange(weekStart: string, weekEnd: string): string {
  const s = new Date(weekStart).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
  const e = new Date(weekEnd).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return `${s} — ${e}`;
}
