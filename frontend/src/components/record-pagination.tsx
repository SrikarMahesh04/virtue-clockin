"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

export function useRecordPageSize() {
  const [size, setSize] = useState(10);
  useEffect(() => {
    const resize = () =>
      setSize(
        Math.max(3, Math.min(100, Math.floor((window.innerHeight - 480) / 54))),
      );
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return size;
}

export function RecordPagination({
  offset,
  count,
  hasMore,
  pageSize,
  onPage,
}: {
  offset: number;
  count: number;
  hasMore: boolean;
  pageSize: number;
  onPage: (offset: number) => void;
}) {
  if (!offset && !hasMore) return null;
  return (
    <nav className="row spread record-pagination" aria-label="Record Pages">
      <button
        type="button"
        aria-label="Previous Records"
        disabled={!offset}
        onClick={() => onPage(Math.max(0, offset - pageSize))}
      >
        <ChevronLeft size={18} />
      </button>
      <small>
        {count
          ? `Records ${offset + 1}–${offset + count}`
          : "No records on this page"}
      </small>
      <button
        type="button"
        aria-label="Next Records"
        disabled={!hasMore}
        onClick={() => onPage(offset + pageSize)}
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
