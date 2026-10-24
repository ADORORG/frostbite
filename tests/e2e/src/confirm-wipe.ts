import { createInterface } from "node:readline/promises";

// Asks before the stack's data is deleted, because it can hold things that cannot be made again (a template published on a test
// network, the people who signed in). Only the word "delete" says yes; `--yes` is for a script that has already decided.
export async function confirmWipe(
  yes: boolean,
  ask: (question: string) => Promise<string> = async (question) => {
    const lines = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      return await lines.question(question);
    } finally {
      lines.close();
    }
  },
): Promise<boolean> {
  if (yes) return true;
  const answer = await ask(
    "This deletes the stack's database and stored files, and cannot be undone. Type delete to go on: ",
  );
  return answer.trim() === "delete";
}
