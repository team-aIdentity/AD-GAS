import type {
  SponsoredTransferRequest,
  SponsoredTransferResponse,
} from "./types";

export interface AdGasClientConfig {
  /** B2B API key from AD-GAS dashboard (sent as Bearer token). */
  apiKey: string;
  /** Relayer base URL, e.g. https://relay.your-domain.com (no trailing slash required). */
  baseUrl: string;
  /** Optional app id registered with the platform. */
  appId?: string;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * B2B client for ad-gated sponsored transfers.
 * Server must validate `Authorization: Bearer <apiKey>` (or implement equivalent).
 */
export class AdGasTransactionClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly appId?: string;

  constructor(config: AdGasClientConfig) {
    if (!config.apiKey?.trim()) {
      throw new Error("AdGasTransactionClient: apiKey is required");
    }
    if (!config.baseUrl?.trim()) {
      throw new Error("AdGasTransactionClient: baseUrl is required");
    }
    this.apiKey = config.apiKey.trim();
    this.baseUrl = normalizeBaseUrl(config.baseUrl.trim());
    this.appId = config.appId?.trim() || undefined;
  }

  /**
   * POST {baseUrl}/relay/transfer — same body as legacy AdWalletRelayerSDK.
   * Platform TODO: enforce API key → quotas / appId on the server.
   */
  async sendSponsoredTransfer(
    payload: SponsoredTransferRequest
  ): Promise<SponsoredTransferResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (this.appId) {
      headers["X-AD-GAS-App-Id"] = this.appId;
    }

    const res = await fetch(`${this.baseUrl}/relay/transfer`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let message = "Sponsored transfer failed.";
      try {
        const data = (await res.json()) as { error?: string };
        if (data?.error) message = data.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const data = (await res.json()) as SponsoredTransferResponse;
    if (!data?.txHash) {
      throw new Error("Sponsored transfer response missing txHash.");
    }
    return data;
  }
}
