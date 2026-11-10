export function PageSkeleton({ variant = "default" }: { variant?: "default" | "board" | "table" }) {
  return <div className="skeleton" role="status" aria-label="Loading your chess lab">
    <span className="bar short"/><span className="bar" style={{ height: 34, width: "62%" }}/>
    {variant === "board" ? <div className="row-a"><span style={{ height: 420 }}/><span style={{ height: 420 }}/></div> : null}
    {variant === "table" ? <><span className="bar"/><div className="row-a"><span style={{ height: 64 }}/><span style={{ height: 64 }}/></div></> : null}
    {variant === "default" ? <><div className="row-a"><span/><span/></div><span className="bar"/><div className="row-a"><span style={{ height: 120 }}/><span style={{ height: 120 }}/><span style={{ height: 120 }}/></div></> : null}
  </div>;
}
