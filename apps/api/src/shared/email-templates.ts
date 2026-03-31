interface EmailTemplate {
	subject: string;
	body: string;
}

const BRAND_COLOR = "#6366f1";
const TEXT_COLOR = "#1f2937";
const MUTED_COLOR = "#6b7280";
const BG_COLOR = "#f9fafb";

function baseLayout(content: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Execution OS</title>
</head>
<body style="margin:0;padding:0;background-color:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_COLOR};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:${TEXT_COLOR};letter-spacing:-0.02em;">
                Execution OS
              </h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:24px 32px 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:${MUTED_COLOR};line-height:1.5;">
                Execution OS &mdash; Ship what matters.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function otpTemplate(code: string): EmailTemplate {
	const spacedCode = code.split("").join(" ");

	const content = `
    <h2 style="margin:0 0 8px;font-size:18px;font-weight:600;color:${TEXT_COLOR};text-align:center;">
      Your verification code
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:${MUTED_COLOR};text-align:center;line-height:1.5;">
      Enter this code to sign in to your account.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <div style="display:inline-block;padding:16px 32px;background-color:${BG_COLOR};border-radius:8px;border:1px solid #e5e7eb;">
        <span style="font-size:32px;font-weight:700;color:${TEXT_COLOR};letter-spacing:0.3em;font-family:'Courier New',monospace;">
          ${spacedCode}
        </span>
      </div>
    </div>
    <p style="margin:0 0 4px;font-size:13px;color:${MUTED_COLOR};text-align:center;line-height:1.5;">
      This code expires in <strong>5 minutes</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:${MUTED_COLOR};text-align:center;line-height:1.5;">
      If you didn't request this, you can safely ignore this email.
    </p>`;

	return {
		subject: "Your Execution OS verification code",
		body: baseLayout(content),
	};
}

export function magicLinkTemplate(url: string): EmailTemplate {
	const content = `
    <h2 style="margin:0 0 8px;font-size:18px;font-weight:600;color:${TEXT_COLOR};text-align:center;">
      Sign in to Execution OS
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:${MUTED_COLOR};text-align:center;line-height:1.5;">
      Click the button below to sign in to your account. No password needed.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 40px;background-color:${BRAND_COLOR};color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;line-height:1;">
        Sign in to Execution OS
      </a>
    </div>
    <p style="margin:0 0 16px;font-size:12px;color:${MUTED_COLOR};text-align:center;line-height:1.5;">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin:0 0 24px;font-size:12px;color:${BRAND_COLOR};text-align:center;line-height:1.5;word-break:break-all;">
      ${url}
    </p>
    <p style="margin:0 0 4px;font-size:13px;color:${MUTED_COLOR};text-align:center;line-height:1.5;">
      This link expires in <strong>15 minutes</strong> and can only be used once.
    </p>
    <p style="margin:0;font-size:13px;color:${MUTED_COLOR};text-align:center;line-height:1.5;">
      If you didn't request this, you can safely ignore this email.
    </p>`;

	return {
		subject: "Sign in to Execution OS",
		body: baseLayout(content),
	};
}
