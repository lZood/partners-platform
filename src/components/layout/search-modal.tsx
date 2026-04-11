"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Users,
  Package,
  Building2,
  FileText,
  X,
  Loader2,
  Command,
} from "lucide-react";
import { globalSearch, type SearchResult, type SearchResults } from "@/actions/search";
import { getInitials } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

const categoryConfig = {
  collaborator: { label: "Colaboradores", icon: Users, color: "text-blue-500" },
  product: { label: "Productos", icon: Package, color: "text-violet-500" },
  partner: { label: "Partners", icon: Building2, color: "text-amber-500" },
  report: { label: "Reportes", icon: FileText, color: "text-emerald-500" },
};

export function SearchModal({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Debounced search
  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      setSelectedIndex(0);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (value.trim().length < 2) {
        setResults(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        const res = await globalSearch(value);
        setResults(res);
        setLoading(false);
      }, 300);
    },
    []
  );

  // Flatten results for keyboard navigation
  const allResults: SearchResult[] = results
    ? [
        ...results.collaborators,
        ...results.products,
        ...results.partners,
        ...results.reports,
      ]
    : [];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && allResults[selectedIndex]) {
      onClose();
      router.push(allResults[selectedIndex].link);
    }
  };

  const handleSelect = (result: SearchResult) => {
    onClose();
    router.push(result.link);
  };

  const totalResults =
    (results?.collaborators.length ?? 0) +
    (results?.products.length ?? 0) +
    (results?.partners.length ?? 0) +
    (results?.reports.length ?? 0);

  if (!open) return null;

  let flatIdx = 0;

  const renderCategory = (
    key: keyof typeof categoryConfig,
    items: SearchResult[]
  ) => {
    if (items.length === 0) return null;
    const config = categoryConfig[key];
    const Icon = config.icon;

    return (
      <div key={key}>
        <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {config.label}
        </p>
        {items.map((item) => {
          const idx = flatIdx++;
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={item.id}
              onClick={() => handleSelect(item)}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
              }`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isSelected ? "bg-primary/20" : "bg-muted"}`}>
                {item.avatarUrl ? (
                  <img
                    src={item.avatarUrl}
                    alt={item.title}
                    className="h-full w-full rounded-lg object-cover"
                  />
                ) : (
                  <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : config.color}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {item.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-[15%] z-50 w-full max-w-lg -translate-x-1/2">
        <div className="mx-4 overflow-hidden rounded-xl border bg-card shadow-2xl">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar colaboradores, productos, partners, reportes..."
              className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <button
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {query.length < 2 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Command className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Escribe para buscar...</p>
                <p className="text-xs mt-1">
                  Ctrl+K para abrir esta busqueda
                </p>
              </div>
            ) : loading ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
                <p className="text-sm">Buscando...</p>
              </div>
            ) : totalResults === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">
                  Sin resultados para "{query}"
                </p>
              </div>
            ) : (
              <div className="py-1">
                {renderCategory("collaborator", results!.collaborators)}
                {renderCategory("product", results!.products)}
                {renderCategory("partner", results!.partners)}
                {renderCategory("report", results!.reports)}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 border-t px-4 py-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">↑↓</kbd>
              Navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">↵</kbd>
              Seleccionar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">Esc</kbd>
              Cerrar
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
