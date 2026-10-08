interface ConfigErrorScreenProps {
  problems: string[]
}

/** Mostrata quando mancano le variabili di Supabase: niente crash, una spiegazione. */
export function ConfigErrorScreen({ problems }: ConfigErrorScreenProps) {
  return (
    <main className="mx-auto max-w-[480px] px-5 pt-[calc(env(safe-area-inset-top)+48px)]">
      <h1 className="text-[28px] font-extrabold leading-tight">App non configurata</h1>
      <p className="mt-3 text-[15px] text-ink-2">
        Mancano le impostazioni per collegarsi al database, quindi l’app non può partire.
      </p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-[15px] text-ink-2">
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] text-muted">
        Su Vercel: Settings → Environment Variables, poi un nuovo deploy. In locale: file .env.local (vedi .env.example).
      </p>
    </main>
  )
}
