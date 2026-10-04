function App() {
  return (
    <main className="kefe-embed" data-testid="kefe-app">
      <iframe
        className="kefe-embed-frame"
        src={`${import.meta.env.BASE_URL}legacy/index.html`}
        title="KEFE music visualiser and lyric video editor"
        data-testid="kefe-editor-frame"
      />
    </main>
  );
}

export default App;
