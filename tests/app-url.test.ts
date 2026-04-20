import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { getPublicAppUrl } from "@/lib/app-url";

const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalNextPublicMiniAppUrl = process.env.NEXT_PUBLIC_MINI_APP_URL;
const originalVercelUrl = process.env.VERCEL_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl;
  process.env.NEXT_PUBLIC_MINI_APP_URL = originalNextPublicMiniAppUrl;
  process.env.VERCEL_URL = originalVercelUrl;
});

test("uses public app URL for web deep links", () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://mentor-app-blue.vercel.app/path";
  delete process.env.NEXT_PUBLIC_MINI_APP_URL;
  delete process.env.VERCEL_URL;

  assert.equal(getPublicAppUrl(), "https://mentor-app-blue.vercel.app");
});

test("does not use t.me as web deep link base", () => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_MINI_APP_URL = "https://t.me/mentor_seledchik_app_bot";
  delete process.env.VERCEL_URL;

  assert.equal(getPublicAppUrl(), "https://mentor-app-blue.vercel.app");
});

test("does not use Vercel deployment URL for Telegram-facing web links", () => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_MINI_APP_URL;
  process.env.VERCEL_URL = "mentor-3jpnd9gb-aleksandrs-projects.vercel.app";

  assert.equal(getPublicAppUrl(), "https://mentor-app-blue.vercel.app");
});
