export default function ApiDocsPage() {
  return (
    <main
      style={{
        margin: 0,
        minHeight: "100vh",
        width: "100vw",
        maxWidth: "100vw",
        background: "#f4f6fb",
      }}
    >
      <iframe
        src="/swagger-ui/index.html"
        title="MobiDuka API Docs"
        style={{
          width: "100vw",
          minHeight: "100vh",
          height: "100vh",
          border: "none",
          background: "#f4f6fb",
          display: "block",
        }}
      />
    </main>
  );
}
