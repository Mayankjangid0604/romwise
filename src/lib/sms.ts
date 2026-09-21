export interface SmsProvider {
  send(phone: string, message: string): Promise<{ success: boolean; error?: string }>;
}

class ConsoleSmsProvider implements SmsProvider {
  async send(phone: string, message: string) {
    if (process.env.NODE_ENV === "production") {
      console.warn(`[SMS FAIL] Attempted to send SMS in production without a real provider configured.`);
      return { success: false, error: "SMS sending is currently unavailable." };
    }
    console.log(`[SMS → ${phone}] ${message}`);
    return { success: true };
  }
}

let provider: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (!provider) {
    provider = new ConsoleSmsProvider();
  }
  return provider;
}

export function setSmsProvider(p: SmsProvider) {
  provider = p;
}
