import nodemailer from "nodemailer";

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USERNAME || process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT_SSL || process.env.SMTP_PORT) || 465;
  const secure = port === 465 || process.env.SMTP_SECURE === "true";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: (Number(process.env.SMTP_TIMEOUT_SECONDS) || 20) * 1000,
  });
};

let _transporter: ReturnType<typeof getTransporter> | undefined;

const ensureTransporter = () => {
  if (_transporter === undefined) _transporter = getTransporter();
  return _transporter;
};

const getFromAddress = () =>
  process.env.SMTP_FROM_EMAIL ||
  process.env.SMTP_FROM ||
  process.env.SMTP_USERNAME ||
  process.env.SMTP_USER ||
  "noreply@markai.app";

export const sendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) => {
  const transporter = ensureTransporter();

  if (!transporter) {
    console.warn("[Email] SMTP not configured, skipping email to:", to);
    console.warn("[Email] Subject:", subject);
    return;
  }

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
  });
};

export const sendVerificationCode = async (email: string, code: string) => {
  await sendEmail({
    to: email,
    subject: `MarkAI — 你的验证码是 ${code}`,
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;padding:24px">
        <h2 style="color:#111;margin-bottom:8px">邮箱验证</h2>
        <p style="color:#333">你的验证码是：</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:20px;margin:16px 0;background:#f5f5f5;border-radius:12px;color:#111">${code}</div>
        <p style="color:#666;font-size:14px">验证码将在 10 分钟后失效，请尽快完成验证。</p>
        <p style="color:#999;font-size:12px;margin-top:24px">如果你没有请求此验证码，请忽略此邮件。</p>
      </div>
    `,
  });
};

export const sendVerificationEmail = async (email: string, url: string) => {
  await sendEmail({
    to: email,
    subject: "MarkAI — 验证你的邮箱",
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;padding:24px">
        <h2 style="color:#111">验证你的邮箱</h2>
        <p>点击下方按钮完成邮箱验证：</p>
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:8px;margin:16px 0">
          验证邮箱
        </a>
        <p style="color:#666;font-size:14px">如果按钮无法点击，请复制此链接到浏览器：<br/>${url}</p>
        <p style="color:#999;font-size:12px">此链接将在 1 小时后失效。</p>
      </div>
    `,
  });
};

export const sendResetPasswordEmail = async (email: string, url: string) => {
  await sendEmail({
    to: email,
    subject: "MarkAI — 重置密码",
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;padding:24px">
        <h2 style="color:#111">重置密码</h2>
        <p>点击下方按钮重置你的密码：</p>
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:8px;margin:16px 0">
          重置密码
        </a>
        <p style="color:#666;font-size:14px">如果按钮无法点击，请复制此链接到浏览器：<br/>${url}</p>
        <p style="color:#999;font-size:12px">如果你没有请求重置密码，请忽略此邮件。</p>
      </div>
    `,
  });
};
