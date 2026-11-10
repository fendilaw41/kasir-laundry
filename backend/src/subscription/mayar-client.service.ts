import { Injectable, Logger } from '@nestjs/common';

export class MayarError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly rawBody?: unknown,
  ) {
    super(message);
    this.name = 'MayarError';
  }
}

export interface MayarInvoiceItem {
  quantity: number;
  rate: number;
  description: string;
}

export interface MayarCreateInvoicePayload {
  name: string;
  email: string;
  mobile: string;
  description: string;
  expiredAt?: string; // ISO 8601 UTC
  items: MayarInvoiceItem[];
  paymentMethod?: string; // 'qris' | 'va/bni' | 'va/bri' | 'va/mandiri' | 'va/cimb' | 'va/permata' | etc.
  extraData?: Record<string, unknown>;
}

export interface MayarCreateInvoiceResponse {
  id: string;
  transactionId: string;
  link: string;
  expiredAt: number;
  extraData?: Record<string, unknown>;
  paymentDetail?: Record<string, unknown>;
}

export interface MayarTransactionDetail {
  id: string;
  status: string; // 'paid', 'unpaid', 'created', 'expired', etc.
  amount: number;
  paymentMethod?: string;
  extraData?: Record<string, unknown> | null;
  createdAt?: number;
  updatedAt?: number;
}

interface MayarEnvelope<T> {
  statusCode?: number;
  messages?: string;
  message?: string;
  data?: T;
}

@Injectable()
export class MayarClientService {
  private readonly logger = new Logger(MayarClientService.name);

  private getBaseUrl(): string {
    return process.env.MAYAR_BASE_URL || 'https://api.mayar.id/hl/v2';
  }

  private getApiKey(): string {
    return process.env.MAYAR_API_KEY || '';
  }

  /**
   * Universal fetcher with Mayar V2 envelope handling and rate-limit guard
   */
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.logger.error('MAYAR_API_KEY belum dikonfigurasi di file .env');
      throw new MayarError(
        'MAYAR_API_KEY belum diisi di file .env backend. Silakan dapatkan API Key di web.mayar.id -> Integrasi -> API Key.',
        401,
      );
    }

    const url = `${this.getBaseUrl()}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...((init.headers as Record<string, string>) || {}),
    };

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers,
      });
    } catch (networkError: unknown) {
      const netMsg =
        networkError instanceof Error
          ? networkError.message
          : String(networkError);
      this.logger.error(`Koneksi ke Mayar API gagal (${url}): ${netMsg}`);
      throw new MayarError(
        `Network failure connecting to Mayar: ${netMsg}`,
        503,
      );
    }

    let body: MayarEnvelope<T> | null = null;
    try {
      body = (await response.json()) as MayarEnvelope<T>;
    } catch {
      body = null;
    }

    const statusCode = Number(body?.statusCode ?? response.status);
    const errorMessage = String(
      body?.messages ??
      body?.message ??
      (response.ok ? 'Unexpected response' : `HTTP ${response.status}`),
    );

    if (!response.ok || statusCode >= 400) {
      this.logger.warn(`Mayar API error [${statusCode}]: ${errorMessage}`);
      throw new MayarError(errorMessage, statusCode, body);
    }

    return (body?.data ?? body) as T;
  }

  /**
   * Membuat tagihan invoice baru di Mayar V2
   */
  async createInvoice(
    payload: MayarCreateInvoicePayload,
  ): Promise<MayarCreateInvoiceResponse> {
    return this.request<MayarCreateInvoiceResponse>('/invoices/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Mengambil detail transaksi untuk bukti sah pembayaran (paid evidence)
   */
  async getTransactionDetail(
    transactionId: string,
  ): Promise<MayarTransactionDetail> {
    return this.request<MayarTransactionDetail>(
      `/transactions/${transactionId}`,
      {
        method: 'GET',
      },
    );
  }
}
