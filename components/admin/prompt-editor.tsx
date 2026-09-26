"use client";

type PromptField = {
  key: string;
  label: string;
  help: string;
  value: string;
};

export function PromptEditor({ prompts }: { prompts: PromptField[] }) {
  return (
    <form
      action="/api/admin/ai/prompts"
      method="post"
      className="mt-4 space-y-5"
    >
      {prompts.map((p) => (
        <div key={p.key}>
          <label
            htmlFor={`prompt-${p.key}`}
            className="text-sm font-medium text-primary"
          >
            {p.label}
          </label>
          <p className="text-xs text-muted">{p.help}</p>
          <textarea
            id={`prompt-${p.key}`}
            name={p.key}
            defaultValue={p.value}
            rows={5}
            className="mt-2 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm leading-relaxed text-primary outline-none ring-accent focus:ring-2"
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-sm bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Save prompts
        </button>
        <span className="text-xs text-muted">
          Leave a field blank to revert it to the default.
        </span>
      </div>
    </form>
  );
}
