import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;
  const body = await req.json() as { to: string; subject: string; text: string };

  if (!body.to || !body.subject || !body.text) {
    return NextResponse.json({ error: "Missing to, subject, or text" }, { status: 400 });
  }

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings?.smtpHost) {
    return NextResponse.json({ error: "SMTP not configured — add host in Settings" }, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: parseInt(settings.smtpPort || "587", 10),
    secure: settings.smtpSecure,
    auth: settings.smtpUser
      ? { user: settings.smtpUser, pass: settings.smtpPassword }
      : undefined,
  });

  try {
    await transporter.sendMail({
      from: settings.smtpFrom || settings.smtpUser || "noreply@dab-meetings",
      to: body.to,
      subject: body.subject,
      text: body.text,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  // Test connection only — sends no email
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    smtpHost: string; smtpPort: string; smtpUser: string;
    smtpPassword: string; smtpSecure: boolean;
  };

  if (!body.smtpHost) {
    return NextResponse.json({ error: "No SMTP host provided" }, { status: 400 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: body.smtpHost,
      port: parseInt(body.smtpPort || "587", 10),
      secure: body.smtpSecure,
      auth: body.smtpUser ? { user: body.smtpUser, pass: body.smtpPassword } : undefined,
    });
    await transporter.verify();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Connection failed";
    return NextResponse.json({ ok: false, error: msg });
  }
}
