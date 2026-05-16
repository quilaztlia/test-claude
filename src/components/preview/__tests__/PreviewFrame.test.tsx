import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { PreviewFrame } from "../PreviewFrame";

vi.mock("@/lib/contexts/file-system-context", () => ({
  useFileSystem: vi.fn(),
}));

vi.mock("@/lib/transform/jsx-transformer", () => ({
  createImportMap: vi.fn(),
  createPreviewHTML: vi.fn(),
}));

import { useFileSystem } from "@/lib/contexts/file-system-context";
import { createImportMap, createPreviewHTML } from "@/lib/transform/jsx-transformer";

const mockGetAllFiles = vi.fn();
let refreshTriggerValue = 0;

beforeEach(() => {
  vi.clearAllMocks();
  refreshTriggerValue = 0;
  (useFileSystem as any).mockReturnValue({
    getAllFiles: mockGetAllFiles,
    get refreshTrigger() { return refreshTriggerValue; },
  });
  mockGetAllFiles.mockReturnValue(new Map());
  (createImportMap as any).mockReturnValue({ importMap: {}, styles: "", errors: [] });
  (createPreviewHTML as any).mockReturnValue("<html><body>preview</body></html>");
});

afterEach(() => {
  cleanup();
});

test("shows welcome screen on first load with no files", () => {
  mockGetAllFiles.mockReturnValue(new Map());
  render(<PreviewFrame />);
  expect(screen.getByText("Welcome to UI Generator")).toBeInTheDocument();
});

test("shows no preview message after initial load with no files", async () => {
  const files = new Map([["/App.jsx", "export default function App() { return <div/>; }"]]);
  mockGetAllFiles.mockReturnValue(files);
  (createImportMap as any).mockReturnValue({ importMap: {}, styles: "", errors: [] });
  (createPreviewHTML as any).mockReturnValue("<html><body>preview</body></html>");

  render(<PreviewFrame />);

  // After files are present, no error screen should show
  expect(screen.queryByText("Welcome to UI Generator")).not.toBeInTheDocument();
  expect(screen.queryByText("No Preview Available")).not.toBeInTheDocument();
});

test("shows error screen when no React component found", () => {
  const files = new Map([["/styles.css", "body { color: red; }"]]);
  mockGetAllFiles.mockReturnValue(files);

  render(<PreviewFrame />);

  expect(screen.getByText("No Preview Available")).toBeInTheDocument();
  expect(
    screen.getByText("No React component found. Create an App.jsx or index.jsx file to get started.")
  ).toBeInTheDocument();
});

test("does not enter infinite render loop when preview throws an error", () => {
  const files = new Map([["/App.jsx", "invalid jsx {{"]]);
  mockGetAllFiles.mockReturnValue(files);
  (createImportMap as any).mockImplementation(() => {
    throw new Error("Parse error");
  });

  let renderCount = 0;
  const OriginalPreviewFrame = PreviewFrame;

  // Count renders by wrapping
  vi.spyOn(console, "error").mockImplementation(() => {});

  render(<PreviewFrame />);

  // Give React time to process any queued updates
  act(() => {});

  // Component should show the error, not be in a loop
  expect(screen.getByText("No Preview Available")).toBeInTheDocument();
  expect(screen.getByText("Parse error")).toBeInTheDocument();

  vi.restoreAllMocks();
});

test("shows error message from caught exception", () => {
  const files = new Map([["/App.jsx", "content"]]);
  mockGetAllFiles.mockReturnValue(files);
  (createImportMap as any).mockImplementation(() => {
    throw new Error("Transformation failed");
  });

  vi.spyOn(console, "error").mockImplementation(() => {});
  render(<PreviewFrame />);

  expect(screen.getByText("Transformation failed")).toBeInTheDocument();
  vi.restoreAllMocks();
});

test("renders iframe when files are valid", () => {
  const files = new Map([["/App.jsx", "export default function App() { return <div>Hello</div>; }"]]);
  mockGetAllFiles.mockReturnValue(files);
  (createImportMap as any).mockReturnValue({ importMap: {}, styles: "", errors: [] });
  (createPreviewHTML as any).mockReturnValue("<html><body>Hello</body></html>");

  render(<PreviewFrame />);

  const iframe = document.querySelector("iframe");
  expect(iframe).toBeInTheDocument();
  expect(iframe?.title).toBe("Preview");
});
