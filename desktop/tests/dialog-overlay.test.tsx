import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DialogOverlay } from "../src/components/DialogOverlay";
import { Modal } from "../src/components/Modal";
import { resetDialogStackForTests } from "../src/lib/dialog-stack";

beforeEach(() => {
  resetDialogStackForTests();
  document.body.style.overflow = "";
});
afterEach(() => {
  resetDialogStackForTests();
  document.body.style.overflow = "";
});

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

  it("Escape closes only the topmost dialog, even over a Modal", async () => {
    const closeModal = vi.fn();
    const closeOverlay = vi.fn();
    render(
      <>
        <Modal open onClose={closeModal} title="Base">
          <button>base</button>
        </Modal>
        <DialogOverlay open onClose={closeOverlay} label="Top">
          <button>top</button>
        </DialogOverlay>
      </>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "top" })).toHaveFocus(),
    );
    await userEvent.keyboard("{Escape}");
    expect(closeOverlay).toHaveBeenCalledTimes(1);
    expect(closeModal).not.toHaveBeenCalled();
  });

  it("locks background scroll while open and restores it on close", () => {
    const { rerender } = render(
      <DialogOverlay open onClose={() => {}} label="Test dialog">
        <button>a</button>
      </DialogOverlay>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <DialogOverlay open={false} onClose={() => {}} label="Test dialog">
        <button>a</button>
      </DialogOverlay>,
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps the scroll lock while a nested dialog remains open", () => {
    const { rerender } = render(
      <>
        <Modal open onClose={() => {}} title="Base">
          <button>base</button>
        </Modal>
        <DialogOverlay open onClose={() => {}} label="Top">
          <button>top</button>
        </DialogOverlay>
      </>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    // Close only the overlay: the Modal is still open, so scroll stays locked.
    rerender(
      <Modal open onClose={() => {}} title="Base">
        <button>base</button>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");
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
