interface ScreenPlaceholderProps {
  title: string
}

/** Schermata provvisoria (step 2): solo il titolo. */
export function ScreenPlaceholder({ title }: ScreenPlaceholderProps) {
  return (
    <section className="px-5 pt-6">
      <h1 className="text-[28px] font-extrabold leading-tight">{title}</h1>
    </section>
  )
}
