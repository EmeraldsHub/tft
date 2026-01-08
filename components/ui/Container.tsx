type ContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export function Container({ children, className }: ContainerProps) {
  const classes = className
    ? `mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`
    : "mx-auto w-full max-w-6xl px-4 sm:px-6";

  return <div className={classes}>{children}</div>;
}
