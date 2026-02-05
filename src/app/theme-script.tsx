export function ThemeScript() {
  const code = `
(function() {
  try {
    var stored = localStorage.getItem("receipt-theme");
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored || (prefersDark ? "dark" : "light");
    var root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  } catch (e) {}
})();
`.trim();

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}