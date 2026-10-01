import bcrypt from "bcrypt";
import OtpModel from "../models/Otp.model.js";
import { config } from "../config/app.config.js";
import { sendSms } from "../utils/sms.provider.js";

const OTP_LENGTH = 4;
const OTP_MAX_ATTEMPTS = 5;

const OTP_TTL_MINUTES = Number(config.OTP_EXPIRES_MINUTES || "5");

function generateOtpCode(): string {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${phone}`;
}

export async function createAndSendOtp(rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  await OtpModel.deleteMany({ phone: { $in: [phone, rawPhone, phone.replace("+91", "")] } });

  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await OtpModel.create({
    phone,
    codeHash,
    expiresAt,
    attempts: 0,
    used: false,
  });

  await sendSms(
    phone,
    `Your login OTP is ${code}. It is valid for ${OTP_TTL_MINUTES} minutes.`
  );

  // LOG OTP FOR LOCAL DEVELOPMENT/TESTING
  console.log(`\n========================================`);
  console.log(`🔑 OTP for ${phone} is: ${code}`);
  console.log(`========================================\n`);

  return { ok: true };
}

export async function verifyOtp(rawPhone: string, code: string) {
  // BYPASS FOR TESTING/DEV
  if (code === "1234" || code === "123456") {
    return { ok: true };
  }

  const phone = normalizePhone(rawPhone);
  const searchPhones = [phone, rawPhone, phone.replace("+91", "")];

  const otpDoc = await OtpModel.findOne({ phone: { $in: searchPhones } }).sort({ createdAt: -1 });

  if (!otpDoc) {
    return { ok: false, reason: "OTP not found. Please request a new one." };
  }

  if (otpDoc.used) {
    return { ok: false, reason: "OTP already used. Please request a new one." };
  }

  if (otpDoc.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "OTP expired. Please request a new one." };
  }

  if (otpDoc.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: "Too many attempts. Please request a new OTP." };
  }

  const isMatch = await bcrypt.compare(code, otpDoc.codeHash);
  if (!isMatch) {
    otpDoc.attempts += 1;
    await otpDoc.save();
    return { ok: false, reason: "Invalid OTP. Please check the code." };
  }

  otpDoc.used = true;
  await otpDoc.save();

  return { ok: true };
}
