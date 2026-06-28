/**
 * Email templates for XLM Code. Each returns { subject, html }. Plain inline
 * styles (email clients ignore <style>/external CSS). Brand: black + #FDDA24.
 * Add new emails here as the product grows.
 */

function shell(title: string, body: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#000000;font-family:'Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#0a0a0a;border:1px solid #1f1f1f;border-radius:18px;overflow:hidden;">
          <tr><td style="padding:30px 32px 8px;">
            <div style="display:inline-block;vertical-align:middle;">
              <span style="display:inline-block;width:20px;height:20px;position:relative;vertical-align:middle;">
                <span style="position:absolute;left:9px;top:1px;width:2px;height:18px;background:#F6F7F8;transform:rotate(45deg);"></span>
                <span style="position:absolute;left:9px;top:1px;width:2px;height:18px;background:#FDDA24;transform:rotate(-45deg);"></span>
              </span>
              <span style="font-size:17px;font-weight:700;color:#fafafa;letter-spacing:-0.01em;vertical-align:middle;margin-left:8px;">XLM<span style="font-weight:400;color:#bdbdbd;"> Code</span></span>
            </div>
          </td></tr>
          <tr><td style="padding:14px 32px 32px;">
            <h1 style="font-size:22px;font-weight:700;color:#fafafa;margin:0 0 14px;letter-spacing:-0.02em;">${title}</h1>
            ${body}
          </td></tr>
        </table>
        <div style="color:#5a5a5a;font-size:12px;margin-top:20px;">© 2026 XLM Code · Runs on Stellar testnet</div>
      </td></tr>
    </table>
  </body>
</html>`
}

export function shareInviteEmail({
  projectName,
  url,
  fromName,
}: {
  projectName: string
  url: string
  fromName?: string
}): { subject: string; html: string } {
  const who = fromName ? `${fromName} shared` : 'Someone shared'
  const body = `
    <p style="font-size:15px;color:#9a9a9a;line-height:1.6;margin:0 0 24px;">
      ${who} the project <span style="color:#fafafa;font-weight:600;">${projectName}</span> with you on XLM Code.
      You can view the code, contracts and live preview — and clone it into your own account to start building.
    </p>
    <a href="${url}" style="display:inline-block;background:#FDDA24;color:#0a0a0a;font-size:15px;font-weight:600;text-decoration:none;padding:13px 26px;border-radius:10px;">Open the project</a>
    <p style="font-size:12.5px;color:#6e6e6e;line-height:1.6;margin:24px 0 0;word-break:break-all;">
      Or paste this link: <a href="${url}" style="color:#FDDA24;">${url}</a>
    </p>`
  return { subject: `${projectName} — shared with you on XLM Code`, html: shell('A project was shared with you', body) }
}
