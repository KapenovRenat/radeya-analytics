/**
 * Рендер карточки заказа поставщику в одно PNG-изображение (через next/og + Satori).
 * Фото товара сверху + тёмная панель с инфой снизу. Отправляется как одно фото без подписи.
 */

import { ImageResponse } from "next/og";

export interface CardData {
  imageUrl: string;
  orderNo: string;     // последние 4
  orderCode: string;   // полный
  originCity: string;
  handoffDate: string;
  displayName: string;
  fabric: string | null;
  code: string | null;
  dopText: string;
}

const W = 600;
const IMG_H = 460;   // фото
const CARD_H = 800;  // 3:4 (600×800)

// ── Шрифт (кириллица) — грузим Roboto TTF через Google Fonts, кешируем ────────────
let fontRegular: ArrayBuffer | null = null;
let fontBold: ArrayBuffer | null = null;
let fontBlack: ArrayBuffer | null = null;

async function loadWeight(weight: number): Promise<ArrayBuffer> {
  // Прямой .woff с Fontsource CDN (Satori понимает woff; woff2 — нет)
  const url = `https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/cyrillic-${weight}-normal.woff`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Шрифт не загрузился: HTTP ${res.status}`);
  return res.arrayBuffer();
}

async function loadFonts(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer; black: ArrayBuffer }> {
  if (!fontRegular) fontRegular = await loadWeight(400);
  if (!fontBold) fontBold = await loadWeight(700);
  if (!fontBlack) fontBlack = await loadWeight(900);
  return { regular: fontRegular, bold: fontBold, black: fontBlack };
}

// Шапка «ЗАКАЗ #5916 (полный)» — крупный чёрный номер
function orderHeader(orderNo: string, orderCode: string) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "#FFFFFF" }}>ЗАКАЗ</div>
      <div style={{ display: "flex", fontSize: 50, fontWeight: 900, color: "#FFFFFF" }}>#{orderNo}</div>
      <div style={{ display: "flex", fontSize: 20, fontWeight: 400, color: "#8A92A0" }}>({orderCode})</div>
    </div>
  );
}

// ── Рендер ────────────────────────────────────────────────────────────────────
export async function renderOrderCard(data: CardData): Promise<Uint8Array> {
  const { regular, bold, black } = await loadFonts();

  const line = (children: React.ReactNode, style: React.CSSProperties = {}) => (
    <div style={{ display: "flex", color: "#E7EAF0", fontSize: 22, lineHeight: 1.35, ...style }}>{children}</div>
  );

  const element = (
    <div style={{ display: "flex", flexDirection: "column", width: W, height: CARD_H, background: "#13161c" }}>
      {/* Фото */}
      <div style={{ display: "flex", width: W, height: IMG_H, background: "#0d0f13" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.imageUrl} width={W} height={IMG_H} style={{ objectFit: "cover" }} />
      </div>

      {/* Панель текста */}
      <div style={{ display: "flex", flexDirection: "column", padding: "20px 26px", gap: 6 }}>
        {orderHeader(data.orderNo, data.orderCode)}
        {line("🚨 Каспи магазин 🚨", { fontWeight: 700, color: "#FF5A5A" })}
        {line(`Отгрузка на Zammler в г. ${data.originCity}`, { color: "#C7CCD6" })}
        {line(`Дата сдачи: ${data.handoffDate} ✅`, { fontWeight: 700, color: "#FFFFFF" })}

        <div style={{ display: "flex", height: 12 }} />

        {line(data.displayName, { fontWeight: 700, color: "#5DCAA5" })}
        {line(`Основная ткань: ${data.fabric ?? "—"}`, { color: "#C7CCD6" })}
        {line(`Артикул изделия: ${data.code ?? "—"}`, { color: "#C7CCD6" })}
        {line(`Доп: ${data.dopText}`, { color: "#C7CCD6" })}
      </div>
    </div>
  );

  const resp = new ImageResponse(element, {
    width: W,
    height: CARD_H,
    emoji: "twemoji",
    fonts: [
      { name: "Roboto", data: regular, weight: 400, style: "normal" },
      { name: "Roboto", data: bold, weight: 700, style: "normal" },
      { name: "Roboto", data: black, weight: 900, style: "normal" },
    ],
  });

  return new Uint8Array(await resp.arrayBuffer());
}

// ── Карточка отмены ─────────────────────────────────────────────────────────────
export interface CancelCardData {
  imageUrl: string;
  orderNo: string;
  orderCode: string;
  type: "in_transit" | "by_customer"; // отмена в пути / отмена клиентом
  originCity: string;
  displayName: string;
  code: string | null;
}

export async function renderCancelCard(data: CancelCardData): Promise<Uint8Array> {
  const { regular, bold, black } = await loadFonts();
  const typeLabel = data.type === "in_transit" ? "Отмена в пути" : "Отмена клиентом";
  const action = data.type === "in_transit"
    ? `Забрать с Zammler в г. ${data.originCity}`
    : "Складировать";

  const line = (children: React.ReactNode, style: React.CSSProperties = {}) => (
    <div style={{ display: "flex", color: "#E7EAF0", fontSize: 22, lineHeight: 1.35, ...style }}>{children}</div>
  );

  const element = (
    <div style={{ display: "flex", flexDirection: "column", width: W, height: CARD_H, background: "#13161c" }}>
      <div style={{ display: "flex", width: W, height: IMG_H, background: "#0d0f13", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.imageUrl} width={W} height={IMG_H} style={{ objectFit: "cover" }} />
        {/* красная плашка ОТМЕНА */}
        <div style={{ display: "flex", position: "absolute", top: 0, left: 0, right: 0, background: "#B3261E", padding: "10px 0", justifyContent: "center" }}>
          <div style={{ display: "flex", color: "#FFFFFF", fontSize: 30, fontWeight: 700 }}>❌ ОТМЕНА ЗАКАЗА</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", padding: "20px 26px", gap: 6 }}>
        {orderHeader(data.orderNo, data.orderCode)}
        {line(`Тип: ${typeLabel}`, { fontWeight: 700, color: "#FF7A7A" })}
        <div style={{ display: "flex", height: 12 }} />
        {line(data.displayName, { fontWeight: 700, color: "#5DCAA5" })}
        {line(`Артикул изделия: ${data.code ?? "—"}`, { color: "#C7CCD6" })}
        <div style={{ display: "flex", height: 12 }} />
        {line(`→ ${action}`, { fontSize: 26, fontWeight: 700, color: "#FFD166" })}
      </div>
    </div>
  );

  const resp = new ImageResponse(element, {
    width: W, height: CARD_H, emoji: "twemoji",
    fonts: [
      { name: "Roboto", data: regular, weight: 400, style: "normal" },
      { name: "Roboto", data: bold, weight: 700, style: "normal" },
      { name: "Roboto", data: black, weight: 900, style: "normal" },
    ],
  });
  return new Uint8Array(await resp.arrayBuffer());
}
