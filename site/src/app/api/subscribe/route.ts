import { Resend } from "resend";
import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({ email: null }));

  if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;

  if (!apiKey || !audienceId) {
    console.error("Missing RESEND_API_KEY or RESEND_AUDIENCE_ID env vars");
    return NextResponse.json(
      { error: "Signup is not configured yet. Try again later." },
      { status: 500 }
    );
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.contacts.create({
      email,
      audienceId,
      unsubscribed: false,
    });

    if (error) {
      // Resend returns an error for duplicate contacts — treat that as success.
      const alreadyExists = /already exists|duplicate/i.test(error.message ?? "");
      if (!alreadyExists) {
        console.error("Resend error:", error);
        return NextResponse.json({ error: "Could not save your email. Try again." }, { status: 502 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Subscribe route failed:", err);
    return NextResponse.json({ error: "Could not save your email. Try again." }, { status: 500 });
  }
}
