import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DialogOverlay } from "../src/components/DialogOverlay";

describe("DialogOverlay", () => {
  it("renders an accessible modal dialog and focuses into it", async () => {
    render(
      <DialogOverlay open onClose={() => {}} label="Test dialog">
        <button>First</button>
      </DialogOverlay>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Test dialog");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "First" })).toHaveFocus(),
    );
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <DialogOverlay open onClose={onClose} label="Test dialog">
        <button>First</button>
      </DialogOverlay>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click but not on a child click", async () => {
    const onClose = vi.fn();
    render(
      <DialogOverlay open onClose={onClose} label="Test dialog">
        <button>First</button>
      </DialogOverlay>,
    );
    await userEvent.click(screen.getByRole("button", { name: "First" }));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps Tab within the dialog", async () => {
    render(
      <DialogOverlay open onClose={() => {}} label="Test dialog">
        <button>One</button>
        <button>Two</button>
      </DialogOverlay>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "One" })).toHaveFocus(),
    );
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Two" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "One" })).toHaveFocus();
  });

  it("renders nothing when closed", () => {
    render(
      <DialogOverlay open={false} onClose={() => {}} label="Test dialog">
        <button>First</button>
      </DialogOverlay>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
