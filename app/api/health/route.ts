import { NextResponse } from "next/server";
import { fernetSelfTest } from "@/lib/kaspi/fernet";

export async function GET() {
  const hasDb = !!(process.env.POSTGRES_URL ?? process.env.DATABASE_URL);
  const hasJwt = !!process.env.JWT_SECRET_KEY;
  const fernetOk = hasJwt ? fernetSelfTest() : false;

  return NextResponse.json({
    status: "ok",
    env: {
      db: hasDb,
      jwt_secret: hasJwt,
      fernet_self_test: fernetOk,
    },
    timestamp: new Date().toISOString(),
  });
}
