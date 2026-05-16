import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { PreviewFrame } from "../PreviewFrame";

// Mock the file system context
const mockGetAllFiles = vi.fn();
const mockUseFileSystem = vi.fn();

vi.mock("@/lib/contexts/file-system-context", () => ({
  useFileSystem: () => mockUseFileSystem(),
}));

// Mock jsx-transformer
const mockCreateImportMap = vi.fn();
const mockCreatePreviewHTML = vi.fn();

vi.mock("@/lib/transform/jsx-transformer", () => ({
  createImportMap: (...args: any[]) => mockCreateImportMap(...args),
  createPreviewHTML: (...args: any[]) => mockCreatePreviewHTML(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseFileSystem.mockReturnValue({
    getAllFiles: mockGetAllFiles,
    refreshTrigger: 0,
  });
});

afterEach(() => {
  cleanup();
});

test("shows welcome screen when no files exist on first load", async () => {
  mockGetAllFiles.mockReturnValue(new Map());

  await act(async () => {
    render(<PreviewFrame />);
  });

  expect(screen.getByText("Welcome to UI Generator")).toBeDefined();
  expect(screen.getByText("Start building React components with AI assistance")).toBeDefined();
});

test("shows error when no React component found after files exist", async () => {
  // Has a file but no jsx/tsx entry point
  mockGetAllFiles.mockReturnValue(new Map([["/styles.css", "body { margin: 0; }"]]));
  mockCreateImportMap.mockReturnValue({ importMap: {}, styles: "", errors: [] });
  mockCreatePreviewHTML.mockReturnValue("<html></html>");

  await act(async () => {
    render(<PreviewFrame />);
  });

  expect(screen.getByText("No Preview Available")).toBeDefined();
  expect(screen.getByText("No React component found. Create an App.jsx or index.jsx file to get started.")).toBeDefined();
});

test("renders iframe when valid files exist", async () => {
  mockGetAllFiles.mockReturnValue(new Map([["/App.jsx", "export default () => <div>Hello</div>"]]));
  mockCreateImportMap.mockReturnValue({ importMap: {}, styles: "", errors: [] });
  mockCreatePreviewHTML.mockReturnValue("<html><body>Hello</body></html>");

  await act(async () => {
    render(<PreviewFrame />);
  });

  const iframe = document.querySelector("iframe");
  expect(iframe).toBeTruthy();
  expect(iframe?.title).toBe("Preview");
});

test("shows error when createImportMap throws", async () => {
  mockGetAllFiles.mockReturnValue(new Map([["/App.jsx", "invalid code"]]));
  mockCreateImportMap.mockImplementation(() => {
    throw new Error("Transform failed");
  });

  await act(async () => {
    render(<PreviewFrame />);
  });

  expect(screen.getByText("No Preview Available")).toBeDefined();
  expect(screen.getByText("Transform failed")).toBeDefined();
});

test("does not enter infinite loop when error occurs", async () => {
  mockGetAllFiles.mockReturnValue(new Map([["/App.jsx", "export default () => <div />"]]));
  mockCreateImportMap.mockImplementation(() => {
    throw new Error("Transform error");
  });

  // If there were an infinite loop, this would hang or call getAllFiles thousands of times
  await act(async () => {
    render(<PreviewFrame />);
  });

  // getAllFiles should have been called a finite number of times (just once per effect run)
  const callCount = mockGetAllFiles.mock.calls.length;
  expect(callCount).toBeLessThan(5);
  expect(screen.getByText("No Preview Available")).toBeDefined();
});

test("updates preview when refreshTrigger changes", async () => {
  mockGetAllFiles.mockReturnValue(new Map([["/App.jsx", "export default () => <div>Hello</div>"]]));
  mockCreateImportMap.mockReturnValue({ importMap: {}, styles: "", errors: [] });
  mockCreatePreviewHTML.mockReturnValue("<html></html>");

  const { rerender } = render(<PreviewFrame />);

  await act(async () => {
    mockUseFileSystem.mockReturnValue({
      getAllFiles: mockGetAllFiles,
      refreshTrigger: 1,
    });
    rerender(<PreviewFrame />);
  });

  // createImportMap should be called again on refresh
  expect(mockCreateImportMap.mock.calls.length).toBeGreaterThan(1);
});
