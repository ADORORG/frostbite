import { createServer, type Socket } from "node:net";
import { SMTPServer } from "smtp-server";

export interface ReceivedMessage {
  readonly data: string;
  readonly from: string;
  readonly to: readonly string[];
  readonly user: string | undefined;
}

// A real SMTP server on a local port: it speaks the protocol, checks the login, records what it was given, and refuses what it is told
// to, so the sender runs against the real thing and not a mock of the library.
export async function startSmtpServer(options: {
  readonly offerStartTls?: boolean;
  readonly password: string;
  readonly refuseRecipient?: string;
  readonly user: string;
}) {
  const received: ReceivedMessage[] = [];
  const server = new SMTPServer({
    allowInsecureAuth: true,
    banner: "stand-in",
    disabledCommands: options.offerStartTls === true ? [] : ["STARTTLS"],
    logger: false,
    onAuth(auth, _session, callback) {
      if (auth.username === options.user && auth.password === options.password)
        callback(null, { user: auth.username });
      else callback(new Error("Invalid login"));
    },
    onData(stream, session, callback) {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        received.push({
          data: Buffer.concat(chunks).toString("utf8"),
          from:
            session.envelope.mailFrom === false
              ? ""
              : session.envelope.mailFrom.address,
          to: session.envelope.rcptTo.map(({ address }) => address),
          user: session.user === undefined ? undefined : String(session.user),
        });
        callback();
      });
    },
    onRcptTo(address, _session, callback) {
      if (address.address === options.refuseRecipient)
        callback(new Error("Mailbox unavailable"));
      else callback();
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.server.address();
  if (address === null || typeof address === "string")
    throw new Error("The SMTP stand-in has no port.");
  return {
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    port: address.port,
    received,
  };
}

// A server that accepts connections and never says anything: a provider that has hung.
export async function startSilentServer(): Promise<{
  readonly close: () => Promise<void>;
  readonly port: number;
}> {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("The silent server has no port.");
  return {
    close: () => {
      for (const socket of sockets) socket.destroy();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
    port: address.port,
  };
}
