export {
  MailDeliveryError,
  mailSettingsSchema,
  smtpEncryptions,
  type MailMessage,
  type MailSender,
  type MailSettings,
  type MailTransport,
  type SmtpMailSettings,
} from "./contracts.ts";
export {
  createCapturingMailbox,
  readCapturedMail,
  type CapturedMail,
} from "./capture.ts";
export { createMailSender } from "./factory.ts";
export {
  createSmtpSender,
  smtpTransportOptions,
  type SmtpTransport,
} from "./smtp.ts";
