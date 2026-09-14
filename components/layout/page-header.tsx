/** A page's title bar: a floating rounded panel like the other blocks. */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-card px-4 py-3 ring-1 ring-border">
      <div className="grid min-w-0 gap-0.5">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
