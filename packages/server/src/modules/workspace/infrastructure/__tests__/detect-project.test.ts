/**
 * Tests for project detection utility
 *
 * Tests parsing of git remote URLs and fallback behavior.
 */

import { describe, expect, it } from "vitest";
import { getFolderName, parseGitRemoteUrl } from "../detect-project";

describe("detect-project", () => {
  describe("parseGitRemoteUrl", () => {
    it("parses HTTPS GitHub URL", () => {
      const result = parseGitRemoteUrl("https://github.com/owner/repo.git");
      expect(result).toEqual({ host: "github.com", owner: "owner", repo: "repo" });
    });

    it("parses HTTPS GitHub URL without .git", () => {
      const result = parseGitRemoteUrl("https://github.com/owner/repo");
      expect(result).toEqual({ host: "github.com", owner: "owner", repo: "repo" });
    });

    it("parses SSH GitHub URL", () => {
      const result = parseGitRemoteUrl("git@github.com:owner/repo.git");
      expect(result).toEqual({ host: "github.com", owner: "owner", repo: "repo" });
    });

    it("parses SSH GitHub URL without .git", () => {
      const result = parseGitRemoteUrl("git@github.com:owner/repo");
      expect(result).toEqual({ host: "github.com", owner: "owner", repo: "repo" });
    });

    it("parses SSH GitLab URL", () => {
      const result = parseGitRemoteUrl("git@gitlab.com:owner/repo.git");
      expect(result).toEqual({ host: "gitlab.com", owner: "owner", repo: "repo" });
    });

    it("parses HTTPS GitLab URL", () => {
      const result = parseGitRemoteUrl("https://gitlab.com/owner/repo.git");
      expect(result).toEqual({ host: "gitlab.com", owner: "owner", repo: "repo" });
    });

    it("parses Bitbucket HTTPS URL", () => {
      const result = parseGitRemoteUrl("https://bitbucket.org/owner/repo.git");
      expect(result).toEqual({ host: "bitbucket.org", owner: "owner", repo: "repo" });
    });

    it("parses HTTPS GitLab subgroup URL", () => {
      const result = parseGitRemoteUrl("https://gitlab.com/group/subgroup/repo.git");
      expect(result).toEqual({ host: "gitlab.com", owner: "group/subgroup", repo: "repo" });
    });

    it("parses ssh:// URL", () => {
      const result = parseGitRemoteUrl("ssh://git@github.com/owner/repo.git");
      expect(result).toEqual({ host: "github.com", owner: "owner", repo: "repo" });
    });

    it("returns null for invalid URL", () => {
      const result = parseGitRemoteUrl("not-a-url");
      expect(result).toBeNull();
    });

    it("returns null for empty string", () => {
      const result = parseGitRemoteUrl("");
      expect(result).toBeNull();
    });
  });

  describe("getFolderName", () => {
    it("extracts folder name from Unix path", () => {
      const result = getFolderName("/home/user/projects/my-project");
      expect(result).toBe("my-project");
    });

    it("extracts folder name from Windows path", () => {
      const result = getFolderName("C:\\Users\\user\\projects\\my-project");
      expect(result).toBe("my-project");
    });

    it("handles trailing slash", () => {
      const result = getFolderName("/home/user/projects/my-project/");
      expect(result).toBe("my-project");
    });

    it("handles path without folder", () => {
      const result = getFolderName("/");
      expect(result).toBe("unknown");
    });
  });
});
