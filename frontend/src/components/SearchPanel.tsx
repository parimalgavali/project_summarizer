import { useState, type FormEvent } from "react";
import QueryStatus from "./QueryStatus";
import { useSearch } from "../lib/queries";

interface SearchPanelProps {
  onOpenDocument: (documentId: string, documentFilename: string) => void;
}

export default function SearchPanel({ onOpenDocument }: SearchPanelProps) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const searchQuery = useSearch(query);
  const results = searchQuery.data?.data;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setQuery(input.trim());
  };

  return (
    <section className="search-panel" aria-label="Semantic search">
      <form className="search-form" role="search" onSubmit={submit}>
        <input
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Search document contents by meaning..."
          aria-label="Semantic search query"
        />
        <button type="submit" className="primary-action" disabled={!input.trim()}>
          Search
        </button>
      </form>

      {query && (
        <QueryStatus
          label="search results"
          isPending={searchQuery.isFetching}
          error={searchQuery.error}
          onRetry={() => searchQuery.refetch()}
        />
      )}

      {query && !searchQuery.isFetching && results && (
        results.length === 0 ? (
          <p className="search-empty">No documents match “{query}”.</p>
        ) : (
          <ol className="search-results" aria-label="Search results">
            {results.map((result) => (
              <li key={result.document_id} className="search-result">
                <div className="search-result-heading">
                  <strong>{result.document_filename}</strong>
                  <span className="search-score">
                    {Math.round(result.score * 100)}% match
                  </span>
                </div>
                <p>{result.snippet}</p>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() =>
                    onOpenDocument(result.document_id, result.document_filename)
                  }
                >
                  {result.summary_count > 0
                    ? `View ${result.summary_count} ${
                        result.summary_count === 1 ? "summary" : "summaries"
                      }`
                    : "Open document"}
                </button>
              </li>
            ))}
          </ol>
        )
      )}
    </section>
  );
}
