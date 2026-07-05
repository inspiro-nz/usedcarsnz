"use client";

import { deleteAccountAction } from "./actions";

export function DeleteAccountForm() {
  return (
    <form
      action={deleteAccountAction}
      onSubmit={(e) => {
        if (
          !confirm(
            "Delete your account? This permanently removes your profile, saved cars, and can't be undone.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50"
      >
        Delete my account
      </button>
    </form>
  );
}
