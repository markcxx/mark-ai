import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

export const { GET } = handler;

export const POST = async (req: Request) => {
  const cloned = req.clone();
  try {
    await cloned.json();
  } catch {
    return new Response(
      JSON.stringify({ code: "INVALID_JSON", message: "Malformed JSON request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  return handler.POST(req);
};
