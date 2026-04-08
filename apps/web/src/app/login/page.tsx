import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE_NAME,
  getAccessToken,
  isAccessDisabled,
  isAccessGateEnabled,
  sanitizeNextPath,
} from "@/lib/access";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    error?: string;
    disabled?: string;
  }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const cookieStore = await cookies();
  const authenticated = cookieStore.get(ACCESS_COOKIE_NAME)?.value === getAccessToken();
  const disabled = isAccessDisabled() || params.disabled === "1";

  if (!disabled && authenticated) {
    redirect(nextPath);
  }

  if (!disabled && !isAccessGateEnabled()) {
    redirect(nextPath);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          ClipZero private launch
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Access required</h1>
        <p className="mt-2 text-sm text-zinc-400">
          ClipZero is currently limited to private launch users.
        </p>

        {disabled ? (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            Access is temporarily disabled. Clear the off switch to reopen the app.
          </div>
        ) : (
          <form action="/auth/login" method="post" className="mt-6 space-y-4">
            <input type="hidden" name="next" value={nextPath} />
            <label className="block">
              <span className="mb-2 block text-sm text-zinc-300">Launch password</span>
              <input
                name="password"
                type="password"
                required
                className="h-11 w-full rounded-lg border border-zinc-800 bg-black px-3 text-sm text-white outline-none ring-0 transition focus:border-zinc-600"
              />
            </label>
            {params.error === "1" && (
              <p className="text-sm text-red-400">Incorrect password. Try again.</p>
            )}
            <button
              type="submit"
              className="h-11 w-full rounded-lg bg-white text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Enter ClipZero
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
