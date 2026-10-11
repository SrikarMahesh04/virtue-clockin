import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RecordPagination } from "./record-pagination";

it("hides controls for one page and exposes labelled arrows when more records exist", () => {
  const onPage = vi.fn();
  const { rerender } = render(
    <RecordPagination
      offset={0}
      count={3}
      hasMore={false}
      pageSize={3}
      onPage={onPage}
    />,
  );
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  rerender(
    <RecordPagination
      offset={0}
      count={3}
      hasMore
      pageSize={3}
      onPage={onPage}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Previous Records" }),
  ).toBeDisabled();
  const next = screen.getByRole("button", { name: "Next Records" });
  expect(next).toHaveTextContent("");
  fireEvent.click(next);
  expect(onPage).toHaveBeenCalledWith(3);
  rerender(
    <RecordPagination
      offset={3}
      count={2}
      hasMore={false}
      pageSize={3}
      onPage={onPage}
    />,
  );
  expect(screen.getByRole("button", { name: "Next Records" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Previous Records" }));
  expect(onPage).toHaveBeenCalledWith(0);
});
