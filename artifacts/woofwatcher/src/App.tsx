import { useEffect, useRef } from "react";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    import("./vanilla/app-entry.js").then((mod) => {
      mod.initApp(containerRef.current!);
    });
  }, []);

  return (
    <div
      ref={containerRef}
      id="app"
      className="app-shell"
      data-loading="true"
    />
  );
}
