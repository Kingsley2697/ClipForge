import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(request: Request) {
  try {
    const { email, password } = schema.parse(await request.json());
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return NextResponse.json({ error: "An account already exists for that email." }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash: await hashPassword(password) },
    });
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid details." }, { status: 422 });
    }
    console.error("[POST /api/auth/sign-up]", error);
    return NextResponse.json({ error: "Unable to create your account." }, { status: 500 });
  }
}
