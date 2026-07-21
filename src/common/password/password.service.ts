import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { Injectable } from "@nestjs/common";

const scryptAsync = promisify(scrypt);
const keyLength = 64;

@Injectable()
export class PasswordService {
  async hash(password: string) {
    const salt = randomBytes(16).toString("hex");
    const key = (await scryptAsync(password, salt, keyLength)) as Buffer;

    return `${salt}:${key.toString("hex")}`;
  }

  async verify(password: string, passwordHash: string) {
    const [salt, storedKey] = passwordHash.split(":");

    if (!salt || !storedKey) {
      return false;
    }

    const storedKeyBuffer = Buffer.from(storedKey, "hex");
    const suppliedKey = (await scryptAsync(password, salt, storedKeyBuffer.length)) as Buffer;

    return storedKeyBuffer.length === suppliedKey.length && timingSafeEqual(storedKeyBuffer, suppliedKey);
  }
}
