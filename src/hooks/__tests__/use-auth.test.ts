import { renderHook, act } from "@testing-library/react";
import { vi, test, expect, beforeEach, describe } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

const mockPush = vi.fn();

import { useAuth } from "../use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAuth initial state", () => {
  test("isLoading is false initially", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn and signUp functions", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

describe("signIn", () => {
  test("calls signInAction with email and password", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });

    expect(signInAction).toHaveBeenCalledWith("user@example.com", "password123");
  });

  test("returns the result from signInAction", async () => {
    const mockResult = { success: false, error: "Invalid credentials" };
    vi.mocked(signInAction).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useAuth());
    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.signIn("user@example.com", "wrong");
    });

    expect(returnValue).toEqual(mockResult);
  });

  test("isLoading is false after signIn completes", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("isLoading is false even when signInAction throws", async () => {
    vi.mocked(signInAction).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("does not call post-sign-in logic when signIn fails", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "wrong");
    });

    expect(getAnonWorkData).not.toHaveBeenCalled();
    expect(getProjects).not.toHaveBeenCalled();
    expect(createProject).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("signUp", () => {
  test("calls signUpAction with email and password", async () => {
    vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Error" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "newpass");
    });

    expect(signUpAction).toHaveBeenCalledWith("new@example.com", "newpass");
  });

  test("returns the result from signUpAction", async () => {
    vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Email taken" });

    const { result } = renderHook(() => useAuth());
    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.signUp("user@example.com", "pass");
    });

    expect(returnValue).toEqual({ success: false, error: "Email taken" });
  });

  test("isLoading is false after signUp completes", async () => {
    vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Error" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "pass");
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("does not call post-sign-in logic when signUp fails", async () => {
    vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Email taken" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("user@example.com", "pass");
    });

    expect(getAnonWorkData).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("handlePostSignIn — with anonymous work", () => {
  test("creates project from anon work and navigates to it", async () => {
    const anonWork = {
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: { "/App.jsx": "export default () => <div/>" },
    };
    vi.mocked(signInAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue(anonWork);
    vi.mocked(createProject).mockResolvedValue({ id: "proj-123" } as never);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      })
    );
    expect(clearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/proj-123");
  });

  test("skips getProjects when anon work has messages", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue({
      messages: [{ role: "user", content: "test" }],
      fileSystemData: {},
    });
    vi.mocked(createProject).mockResolvedValue({ id: "proj-abc" } as never);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(getProjects).not.toHaveBeenCalled();
  });

  test("anon project name includes current time", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue({
      messages: [{ role: "user", content: "hi" }],
      fileSystemData: {},
    });
    vi.mocked(createProject).mockResolvedValue({ id: "proj-t" } as never);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.stringMatching(/^Design from /) })
    );
  });
});

describe("handlePostSignIn — no anonymous work, existing projects", () => {
  test("navigates to the most recent project", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue(null);
    vi.mocked(getProjects).mockResolvedValue([
      { id: "recent", name: "Recent" } as never,
      { id: "older", name: "Older" } as never,
    ]);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockPush).toHaveBeenCalledWith("/recent");
    expect(createProject).not.toHaveBeenCalled();
  });
});

describe("handlePostSignIn — no anonymous work, no projects", () => {
  test("creates a new blank project and navigates to it", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue(null);
    vi.mocked(getProjects).mockResolvedValue([]);
    vi.mocked(createProject).mockResolvedValue({ id: "brand-new" } as never);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/brand-new");
  });

  test("new project name matches 'New Design #<number>'", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue(null);
    vi.mocked(getProjects).mockResolvedValue([]);
    vi.mocked(createProject).mockResolvedValue({ id: "np" } as never);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.stringMatching(/^New Design #\d+$/) })
    );
  });
});

describe("handlePostSignIn — empty anonymous work (no messages)", () => {
  test("falls through to getProjects when anon messages array is empty", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue({ messages: [], fileSystemData: {} });
    vi.mocked(getProjects).mockResolvedValue([{ id: "user-proj" } as never]);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(getProjects).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/user-proj");
  });
});
