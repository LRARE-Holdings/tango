type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type SendEmailResult = {
  ok: boolean;
  id?: string;
  error?: string;
};

function getResendApiKey() {
  return process.env.RESEND_API_KEY || "";
}

function getFromAddress() {
  return process.env.RECEIPT_FROM_EMAIL || "Receipt <no-reply@getreceipt.co>";
}

export async function sendWithResend(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: getFromAddress(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    const json = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok) {
      return { ok: false, error: json?.message ?? "Resend request failed." };
    }

    return { ok: true, id: json?.id };
  } catch {
    return { ok: false, error: "Resend request failed." };
  }
}
