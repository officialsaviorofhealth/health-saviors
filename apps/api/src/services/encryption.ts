import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
export class EncryptionService {
  private key: Buffer;
  constructor(secret: string) { this.key = scryptSync(secret, "h2e-salt", 32); }
  encrypt(text: string): string {
    const iv = randomBytes(16); const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const enc = cipher.update(text, "utf8", "hex") + cipher.final("hex");
    return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${enc}`;
  }
  decrypt(ct: string): string {
    const [ivH, tagH, enc] = ct.split(":");
    const d = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ivH, "hex"));
    d.setAuthTag(Buffer.from(tagH, "hex"));
    return d.update(enc, "hex", "utf8") + d.final("utf8");
  }
}
export const encryptionService = new EncryptionService(process.env.ENCRYPTION_SECRET || "dev-secret");
