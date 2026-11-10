export interface Shop {
  _id: string;
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  businessAddress: string;
  preferredLanguage: string;
  businessTimezone: string;
}

export interface Product {
  _id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  lowStockThreshold: number;
}

export interface Customer {
  _id: string;
  name: string;
  phone: string;
}

export interface TransactionItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Transaction {
  _id: string;
  type: "SALE" | "PAYMENT" | "STOCK_IN" | "STOCK_ADJUSTMENT";
  customerId?: string | null;
  items: TransactionItem[];
  totalAmount: number;
  amountPaid: number;
  paymentStatus?: "PAID" | "PARTIAL" | "UNPAID";
  paymentMethod?: "CASH" | "UPI" | "CARD" | "OTHER";
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export interface PageData<T> {
  [key: string]: T | Pagination | unknown;
  pagination: Pagination;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface VoicePreview {
  actionId?: string;
  intent?: { intent?: string; [key: string]: unknown };
  requiresConfirmation: boolean;
  clarification?: string;
  transcript?: string;
  transcription?: { transcript: string };
  preview?: {
    customer?: { name?: string; customerId?: string };
    items?: Array<{ name: string; quantity: number; unit: string; unitPrice: number; total: number }>;
    total?: number;
    amountPaid?: number;
    paymentMethod?: string;
    [key: string]: unknown;
  };
  result?: unknown;
  [key: string]: unknown;
}
