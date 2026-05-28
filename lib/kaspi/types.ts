/**
 * Types for Kaspi Seller Orders API responses + internal DB shapes.
 */

export interface KaspiApiCustomer {
  firstName?: string;
  lastName?: string;
  name?: string;
  cellPhone?: string;
}

export interface KaspiApiAddress {
  town?: string;
  formattedAddress?: string;
  city?: { name?: string };
  address?: { formattedAddress?: string };
}

export interface KaspiApiDelivery {
  waybillNumber?: string;
  express?: boolean;
}

export interface KaspiApiOrderAttrs {
  code?: string;
  creationDate?: number; // ms
  approvedByBankDate?: number;
  totalPrice?: number;
  deliveryCostForSeller?: number;
  deliveryCost?: number;
  status?: string;
  state?: string;
  cancellationReason?: string;
  paymentMode?: string;
  creditTerm?: number;
  deliveryMode?: string;
  isKaspiDelivery?: boolean;
  assembled?: boolean;
  customer?: KaspiApiCustomer;
  deliveryAddress?: KaspiApiAddress;
  originAddress?: KaspiApiAddress;
  kaspiDelivery?: KaspiApiDelivery;
}

export interface KaspiApiOrder {
  id?: string;
  type?: string;
  attributes?: KaspiApiOrderAttrs;
}

export interface KaspiApiMeta {
  totalCount?: number;
  pageCount?: number;
  pageNumber?: number;
  pageSize?: number;
}

export interface KaspiApiOrdersResponse {
  data?: KaspiApiOrder[];
  meta?: KaspiApiMeta;
}

export interface KaspiTokenTestResult {
  valid: boolean;
  totalCount: number;
  error: string | null;
}

export interface SyncChunk {
  from: Date;
  to: Date;
}

export interface SyncProgress {
  storeId: string;
  chunkDone: number;
  totalChunks: number;
  percent: number;
  elapsedSeconds: number;
  etaSeconds: number;
  currentRange: string;
  status: "running" | "done" | "failed" | "idle";
  error?: string;
}
