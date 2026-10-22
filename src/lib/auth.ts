import "server-only";

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "clipforge_session";
const SESSION_DAYS = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const stored = Buffer.from(hash, "hex");
  return stored.length === derivedKey.length && timingSafeEqual(stored, derivedKey);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

export async function getSubscriptionAccess(user: {
  id: string;
  subscriptionStatus: string;
  subscriptionEndsAt: Date | null;
}) {
  const now = new Date();
  const isActive = user.subscriptionStatus === "active"
    && user.subscriptionEndsAt !== null
    && user.subscriptionEndsAt > now;

  if (!isActive && user.subscriptionEndsAt && user.subscriptionEndsAt <= now && user.subscriptionStatus !== "expired") {
    await prisma.user.update({
      where: { id: user.id },
      data: { subscriptionStatus: "expired" },
    });
  }

  return { isActive, subscriptionEndsAt: user.subscriptionEndsAt };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
